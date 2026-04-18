import { and, eq, sql, gte, lte, isNull, or, inArray } from 'drizzle-orm';
import { db } from '../db';
import {
  memberVotes,
  memberPresence,
  committeeSessions,
  committeeMembers,
  governmentPositions,
  votes,
} from '../db/schema';

/**
 * Absence classification categories.
 *
 * - `absent_justified` — MK was in the Knesset building (presence hours > 0)
 *   or in a committee session overlapping the vote, or holds a government position.
 * - `absent_unjustified` — No justification signal found.
 * - `present` — MK was marked "present" (ResultCode=6) but did not vote.
 * - `voted` — Secret ballot (ResultCode=11) — counted separately.
 */
export type AbsenceCategory =
  | 'absent_justified'
  | 'absent_unjustified'
  | 'present'
  | 'voted';

export interface MemberAbsenceStats {
  memberId: number;
  totalVotes: number;
  votedFor: number;
  votedAgainst: number;
  votedAbstain: number;
  markedPresent: number;
  secretBallot: number;
  absentJustified: number;
  absentUnjustified: number;
}

/**
 * Compute absence stats for all members in a given knesset number.
 * Cross-references:
 *  1. voteValue='present' → classified as 'present' (was there, didn't vote)
 *  2. voteValue='voted' → classified as 'voted' (secret ballot)
 *  3. voteValue='absent' + government position at that date → 'absent_justified'
 *  4. voteValue='absent' + committee session on same day with membership → 'absent_justified'
 *  5. voteValue='absent' + presence hours > 0 on that date → 'absent_justified'
 *  6. voteValue='absent' + none of the above → 'absent_unjustified'
 */
export async function computeMemberAbsenceStats(
  knessetNum: number,
): Promise<MemberAbsenceStats[]> {
  // ── Fetch all member vote records for this knesset ──
  const allMemberVotes = await db
    .select({
      memberId: memberVotes.memberId,
      voteValue: memberVotes.voteValue,
      voteId: memberVotes.voteId,
    })
    .from(memberVotes)
    .innerJoin(votes, eq(memberVotes.voteId, votes.id))
    .where(eq(votes.knessetNum, knessetNum));

  // Get vote dates for absent records
  const voteIdSet = new Set<number>();
  for (const mv of allMemberVotes) {
    if (mv.voteValue === 'absent') voteIdSet.add(mv.voteId);
  }

  const voteDates = new Map<number, Date>();
  if (voteIdSet.size > 0) {
    const voteIds = [...voteIdSet];
    // Fetch in chunks to avoid exceeding query limits
    for (let i = 0; i < voteIds.length; i += 1000) {
      const chunk = voteIds.slice(i, i + 1000);
      const rows = await db
        .select({ id: votes.id, voteDate: votes.voteDate })
        .from(votes)
        .where(inArray(votes.id, chunk));
      for (const r of rows) {
        if (r.voteDate) voteDates.set(r.id, r.voteDate);
      }
    }
  }

  // ── Collect absent member IDs for justification lookup ──
  const absentMemberIds = new Set<number>();
  for (const mv of allMemberVotes) {
    if (mv.voteValue === 'absent') absentMemberIds.add(mv.memberId);
  }

  // ── Justification data sources ──

  // 1. Government positions: memberId → date ranges
  const govPositionRows = await db
    .select({
      memberId: governmentPositions.memberId,
      startDate: governmentPositions.startDate,
      endDate: governmentPositions.endDate,
    })
    .from(governmentPositions)
    .where(sql`${governmentPositions.memberId} IS NOT NULL`);

  const govPositionsByMember = new Map<
    number,
    Array<{ start: string | null; end: string | null }>
  >();
  for (const gp of govPositionRows) {
    if (!gp.memberId) continue;
    if (!govPositionsByMember.has(gp.memberId)) {
      govPositionsByMember.set(gp.memberId, []);
    }
    govPositionsByMember.get(gp.memberId)!.push({
      start: gp.startDate,
      end: gp.endDate,
    });
  }

  // 2. Committee sessions: date → set of committee IDs that had sessions
  const sessionRows = await db
    .select({
      committeeId: committeeSessions.committeeId,
      sessionDate: committeeSessions.sessionDate,
    })
    .from(committeeSessions);

  // dateStr → Set<committeeId>
  const sessionsByDate = new Map<string, Set<number>>();
  for (const s of sessionRows) {
    if (!s.sessionDate) continue;
    const dateStr = s.sessionDate.toISOString().slice(0, 10);
    if (!sessionsByDate.has(dateStr)) sessionsByDate.set(dateStr, new Set());
    sessionsByDate.get(dateStr)!.add(s.committeeId);
  }

  // 3. Committee memberships: memberId → [{ committeeId, start, finish }]
  const cmRows = await db
    .select({
      memberId: committeeMembers.memberId,
      committeeId: committeeMembers.committeeId,
      startDate: committeeMembers.startDate,
      finishDate: committeeMembers.finishDate,
    })
    .from(committeeMembers);

  const committeeMembershipsByMember = new Map<
    number,
    Array<{ committeeId: number; start: Date | null; finish: Date | null }>
  >();
  for (const cm of cmRows) {
    if (!committeeMembershipsByMember.has(cm.memberId)) {
      committeeMembershipsByMember.set(cm.memberId, []);
    }
    committeeMembershipsByMember.get(cm.memberId)!.push({
      committeeId: cm.committeeId,
      start: cm.startDate,
      finish: cm.finishDate,
    });
  }

  // 4. Presence data: (memberId, dateStr) → hours
  const presenceRows = await db
    .select({
      memberId: memberPresence.memberId,
      date: memberPresence.date,
      totalAttendedHours: memberPresence.totalAttendedHours,
    })
    .from(memberPresence);

  const presenceMap = new Map<string, number>();
  for (const p of presenceRows) {
    presenceMap.set(`${p.memberId}:${p.date}`, p.totalAttendedHours);
  }

  // ── Classify each member vote ──
  const statsMap = new Map<number, MemberAbsenceStats>();

  function getStats(memberId: number): MemberAbsenceStats {
    let s = statsMap.get(memberId);
    if (!s) {
      s = {
        memberId,
        totalVotes: 0,
        votedFor: 0,
        votedAgainst: 0,
        votedAbstain: 0,
        markedPresent: 0,
        secretBallot: 0,
        absentJustified: 0,
        absentUnjustified: 0,
      };
      statsMap.set(memberId, s);
    }
    return s;
  }

  for (const mv of allMemberVotes) {
    const stats = getStats(mv.memberId);
    stats.totalVotes++;

    switch (mv.voteValue) {
      case 'for':
        stats.votedFor++;
        break;
      case 'against':
        stats.votedAgainst++;
        break;
      case 'abstain':
        stats.votedAbstain++;
        break;
      case 'present':
        stats.markedPresent++;
        break;
      case 'voted':
        stats.secretBallot++;
        break;
      case 'absent': {
        const voteDate = voteDates.get(mv.voteId);
        if (!voteDate) {
          stats.absentUnjustified++;
          break;
        }
        const dateStr = voteDate.toISOString().slice(0, 10);

        // Check justification signals
        const justified = isAbsenceJustified(
          mv.memberId,
          dateStr,
          voteDate,
          govPositionsByMember,
          sessionsByDate,
          committeeMembershipsByMember,
          presenceMap,
        );

        if (justified) {
          stats.absentJustified++;
        } else {
          stats.absentUnjustified++;
        }
        break;
      }
    }
  }

  return [...statsMap.values()];
}

/**
 * Check whether an absence has any justification signal.
 */
function isAbsenceJustified(
  memberId: number,
  dateStr: string,
  voteDate: Date,
  govPositions: Map<
    number,
    Array<{ start: string | null; end: string | null }>
  >,
  sessionsByDate: Map<string, Set<number>>,
  committeeMemberships: Map<
    number,
    Array<{ committeeId: number; start: Date | null; finish: Date | null }>
  >,
  presenceMap: Map<string, number>,
): boolean {
  // 1. Government position at that date
  const positions = govPositions.get(memberId);
  if (positions) {
    for (const pos of positions) {
      const afterStart = !pos.start || dateStr >= pos.start;
      const beforeEnd = !pos.end || dateStr <= pos.end;
      if (afterStart && beforeEnd) return true;
    }
  }

  // 2. Committee session on the same day where member is a member
  const sessionsOnDate = sessionsByDate.get(dateStr);
  if (sessionsOnDate) {
    const memberships = committeeMemberships.get(memberId);
    if (memberships) {
      for (const cm of memberships) {
        if (!sessionsOnDate.has(cm.committeeId)) continue;
        // Check if membership was active on that date
        const afterStart = !cm.start || voteDate >= cm.start;
        const beforeEnd = !cm.finish || voteDate <= cm.finish;
        if (afterStart && beforeEnd) return true;
      }
    }
  }

  // 3. Presence data — MK was in the building that day
  const hours = presenceMap.get(`${memberId}:${dateStr}`);
  if (hours !== undefined && hours > 0) return true;

  return false;
}
