/**
 * Knessets where committee data (members, attendance, sessions) is synced and
 * considered trustworthy. Committees outside this range exist in the DB but
 * are hidden from the UI to avoid showing partial/misleading info.
 */
export const SUPPORTED_COMMITTEE_KNESSETS = [22, 23, 24, 25] as const;

/** OData PositionID → display priority (lower = shown first / primary role). */
const POSITION_PRIORITY: Record<number, number> = {
  41: 0, // chair (יו"ר)
  67: 1, // deputy / acting chair (מ"מ יו"ר)
  66: 2, // member (חבר ועדה)
  42: 2, // member (alt code)
  663: 3, // observer (משקיף)
};

export function positionPriority(positionId: number | null): number {
  if (positionId == null) return 99;
  return POSITION_PRIORITY[positionId] ?? 50;
}

/**
 * Aggregate duplicate committee_members rows (same memberId) into one entry,
 * keeping the highest-priority position as primary and collecting secondary
 * role labels. Handles the case where the Knesset OData has multiple active
 * PersonToPosition rows for the same MK in the same committee (e.g. chair + member).
 */
export interface RawCommitteeMember {
  memberId: number;
  positionId: number | null;
  dutyDesc: string | null;
  isCurrent: boolean | null;
  startDate: Date | null;
  finishDate: Date | null;
  attendedMeetings: number | null;
  protocolMeetings: number | null;
  attendancePercent: number | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  factionName: string | null;
}

export interface MemberStint {
  start: Date | null;
  finish: Date | null;
}

export interface DedupedCommitteeMember extends RawCommitteeMember {
  /** All distinct role labels for this member in this committee (primary first). */
  roleLabels: string[];
  /** True if primary position is chair (41). */
  isChair: boolean;
  /** True if primary position is deputy / acting chair (67). */
  isDeputy: boolean;
  /** Earliest start date across all active rows for this member. */
  earliestStart: Date | null;
  /** Merged active stints — multiple entries indicate the member left and returned. */
  stints: MemberStint[];
}

const POSITION_LABEL_KEYS: Record<number, string> = {
  41: 'chair',
  67: 'deputy',
  66: 'member',
  42: 'member',
  663: 'observer',
};

/**
 * Group committee members by memberId, keeping the primary (highest-priority)
 * role and merging other roles as labels. Sorted so chair and deputies come first.
 */
export function dedupeCommitteeMembers(
  rows: RawCommitteeMember[],
  labelFor: (key: string) => string,
): DedupedCommitteeMember[] {
  const byMember = new Map<number, RawCommitteeMember[]>();
  for (const r of rows) {
    if (!byMember.has(r.memberId)) byMember.set(r.memberId, []);
    byMember.get(r.memberId)!.push(r);
  }

  const deduped: DedupedCommitteeMember[] = [];
  for (const [memberId, group] of byMember) {
    // Separate current from historical rows. Use current rows for position
    // and role-label determination; use ALL rows for earliestStart.
    const currentRows = group.filter((r) => r.isCurrent === true);
    const rowsForPosition = currentRows.length > 0 ? currentRows : group;

    const sorted = [...rowsForPosition].sort(
      (a, b) => positionPriority(a.positionId) - positionPriority(b.positionId),
    );
    const primary = sorted[0];

    const seenLabels = new Set<string>();
    const roleLabels: string[] = [];
    for (const r of sorted) {
      const key =
        r.positionId != null ? POSITION_LABEL_KEYS[r.positionId] : null;
      const label = key ? labelFor(key) : r.dutyDesc;
      if (label && !seenLabels.has(label)) {
        seenLabels.add(label);
        roleLabels.push(label);
      }
    }

    // Earliest start across ALL stints (including historical)
    const earliestStart =
      group
        .map((r) => r.startDate)
        .filter((d): d is Date => d != null)
        .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

    // Build merged stints from all rows to detect gaps (left & returned).
    // Sort by start, merge overlapping/adjacent, keep non-overlapping separate.
    const rawStints: MemberStint[] = group
      .map((r) => ({
        start: r.startDate,
        finish: r.isCurrent === true || !r.finishDate ? null : r.finishDate,
      }))
      .sort((a, b) => {
        if (!a.start && !b.start) return 0;
        if (!a.start) return -1;
        if (!b.start) return 1;
        return a.start.getTime() - b.start.getTime();
      });

    const stints: MemberStint[] =
      rawStints.length > 0 ? [{ ...rawStints[0] }] : [];
    for (let i = 1; i < rawStints.length; i++) {
      const prev = stints[stints.length - 1];
      const curr = rawStints[i];
      // Open-ended absorbs everything
      if (prev.finish === null) continue;
      // Overlapping or adjacent → merge
      if (!curr.start || curr.start.getTime() <= prev.finish.getTime()) {
        prev.finish =
          curr.finish === null
            ? null
            : curr.finish.getTime() > prev.finish.getTime()
              ? curr.finish
              : prev.finish;
      } else {
        stints.push({ ...curr });
      }
    }

    deduped.push({
      ...primary,
      memberId,
      roleLabels,
      isChair: primary.positionId === 41,
      isDeputy: primary.positionId === 67,
      earliestStart,
      stints,
    });
  }

  return deduped.sort((a, b) => {
    const pa = positionPriority(a.positionId);
    const pb = positionPriority(b.positionId);
    if (pa !== pb) return pa - pb;
    return (a.lastName ?? '').localeCompare(b.lastName ?? '', 'he');
  });
}
