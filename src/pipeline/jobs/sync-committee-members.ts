import { sql, eq } from 'drizzle-orm';
import { db } from '../../lib/db';
import { committees, committeeMembers, members } from '../../lib/db/schema';
import { fetchV4CommitteeMembers } from '../../lib/knesset/knesset-api-client';
import { fetchOKnessetCSV } from '../../lib/knesset/oknesset-client';
import { runSyncJob, type SyncCheckpoint } from '../utils';
import { appConfig } from '../../../app.config';

const BATCH_SIZE = 50;
const ATTENDANCE_UPDATE_BATCH_SIZE = 500;

/**
 * Sync committee membership from OData v4 KNS_PersonToPosition +
 * attendance stats from Open Knesset CSV.
 */
async function syncCommitteeMemberRecords(
  prevCheckpoint: SyncCheckpoint | null,
): Promise<{ count: number; checkpoint: SyncCheckpoint }> {
  const knessetNums = appConfig.knesset.syncKnessets;

  // ── Step 1: Fetch committee membership from OData v4 ──
  const sinceDate = prevCheckpoint?.lastItemTimestamp
    ? new Date(prevCheckpoint.lastItemTimestamp as string)
    : undefined;

  const raw = await fetchV4CommitteeMembers(knessetNums, sinceDate);
  console.log(
    `  [committee-members] Fetched ${raw.length} membership records from OData v4`,
  );

  // ── Step 2: Build lookup maps ──
  // Map knessetId → DB id for committees
  const allCommittees = await db
    .select({ id: committees.id, knessetId: committees.knessetId })
    .from(committees);
  const committeeMap = new Map(allCommittees.map((c) => [c.knessetId, c.id]));

  // Map PersonID (knessetId) → DB id for members
  const allMembers = await db
    .select({ id: members.id, knessetId: members.knessetId })
    .from(members);
  const memberMap = new Map(allMembers.map((m) => [m.knessetId, m.id]));

  // ── Step 3: Transform and upsert ──
  let maxLastUpdated = prevCheckpoint?.lastItemTimestamp as string | undefined;
  let skipped = 0;

  const rows = raw
    .map((r) => {
      const committeeId = committeeMap.get(r.CommitteeID);
      const memberId = memberMap.get(r.PersonID);
      if (!committeeId || !memberId) {
        skipped++;
        return null;
      }

      if (
        r.LastUpdatedDate &&
        (!maxLastUpdated || r.LastUpdatedDate > maxLastUpdated)
      ) {
        maxLastUpdated = r.LastUpdatedDate;
      }

      return {
        committeeId,
        memberId,
        positionId: r.PositionID,
        dutyDesc: r.DutyDesc ?? null,
        knessetNum: r.KnessetNum,
        isCurrent: r.IsCurrent,
        startDate: r.StartDate ? new Date(r.StartDate) : null,
        finishDate: r.FinishDate ? new Date(r.FinishDate) : null,
        knessetPositionId: r.Id,
      };
    })
    .filter(Boolean) as Array<{
    committeeId: number;
    memberId: number;
    positionId: number;
    dutyDesc: string | null;
    knessetNum: number;
    isCurrent: boolean;
    startDate: Date | null;
    finishDate: Date | null;
    knessetPositionId: number;
  }>;

  if (skipped > 0) {
    console.log(
      `  [committee-members] Skipped ${skipped} records (missing committee or member reference)`,
    );
  }

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await db
      .insert(committeeMembers)
      .values(batch)
      .onConflictDoUpdate({
        target: committeeMembers.knessetPositionId,
        set: {
          positionId: sql`excluded.position_id`,
          dutyDesc: sql`excluded.duty_desc`,
          isCurrent: sql`excluded.is_current`,
          startDate: sql`excluded.start_date`,
          finishDate: sql`excluded.finish_date`,
          updatedAt: new Date(),
        },
      });
  }

  console.log(
    `  [committee-members] Upserted ${rows.length} membership records`,
  );

  // ── Step 4: Sync attendance stats from Open Knesset CSV ──
  // Only on full sync (no checkpoint) to avoid downloading 8MB every incremental run
  if (!sinceDate) {
    await syncAttendanceStats(committeeMap, memberMap);
  }

  // ── Step 5: Populate committees.chairmanId from current chair position ──
  await syncCommitteeChairs();

  const checkpoint: SyncCheckpoint = {
    lastItemId: rows.reduce(
      (max, r) => Math.max(max, r.knessetPositionId),
      (prevCheckpoint?.lastItemId as number) ?? 0,
    ),
    lastItemTimestamp: maxLastUpdated,
  };

  return { count: rows.length, checkpoint };
}

/**
 * Sync attendance stats from Open Knesset per-session attendance CSV.
 * Uses committee-meeting-attendees-mks-stats/mk_attendance.csv which has
 * one row per MK per meeting attended. We aggregate to get:
 *   - attended_meetings: count of meetings the MK attended
 *   - protocol_meetings: total meetings for that committee+knesset
 *   - attendance_percent: attended / protocol * 100
 *
 * The CSV uses mk_id (= mk_individual_id) which equals PersonID for newer MKs
 * but differs for older ones. We use mk_individual.csv to bridge.
 * The CSV committee_id matches the Knesset API CommitteeID stored in our DB.
 */
async function syncAttendanceStats(
  committeeMap: Map<number, number>,
  memberMap: Map<number, number>,
): Promise<void> {
  // Build mk_individual_id → PersonID mapping from OKnesset member data
  let mkMembers: Record<string, string>[];
  try {
    mkMembers = await fetchOKnessetCSV<Record<string, string>>(
      'members/mk_individual/mk_individual.csv',
    );
  } catch (err) {
    console.warn(
      '  [committee-members] Failed to fetch mk_individual.csv, skipping attendance:',
      err instanceof Error ? err.message : err,
    );
    return;
  }

  const mkIdToPersonId = new Map<number, number>();
  for (const m of mkMembers) {
    const mkId = Number(m.mk_individual_id);
    const personId = Number(m.PersonID);
    if (mkId && personId) mkIdToPersonId.set(mkId, personId);
  }
  console.log(
    `  [committee-members] Built mk_individual_id → PersonID mapping: ${mkIdToPersonId.size} entries`,
  );

  let csvRows: Record<string, string>[];
  try {
    csvRows = await fetchOKnessetCSV<Record<string, string>>(
      'people/committees/committee-meeting-attendees-mks-stats/mk_attendance.csv',
    );
  } catch (err) {
    console.warn(
      '  [committee-members] Failed to fetch mk_attendance.csv, skipping:',
      err instanceof Error ? err.message : err,
    );
    return;
  }

  console.log(
    `  [committee-members] Loaded ${csvRows.length} attendance rows from Open Knesset`,
  );

  const syncKnessets = new Set(appConfig.knesset.syncKnessets);

  // Fetch per-member date ranges so attendance can be scoped to when the member
  // was actually on the committee (prevents unfairly low % for recent joiners
  // and unfairly high % for members who left early).
  const memberRanges = await db
    .select({
      committeeId: committeeMembers.committeeId,
      memberId: committeeMembers.memberId,
      knessetNum: committeeMembers.knessetNum,
      startDate: committeeMembers.startDate,
      finishDate: committeeMembers.finishDate,
      isCurrent: committeeMembers.isCurrent,
    })
    .from(committeeMembers);

  // For the same (committee, member, knesset) there can be multiple rows (different
  // positions / re-assignments). Collect all active ranges per member so we can
  // correctly handle gaps (e.g. member left and later rejoined the committee).
  // Overlapping/adjacent ranges are merged; non-overlapping ones are kept separate
  // so meetings during a gap are excluded from the denominator.
  interface Range {
    start: string | null;
    finish: string | null;
  }
  const memberRangesMap = new Map<string, Range[]>();
  for (const r of memberRanges) {
    if (r.knessetNum == null) continue;
    const key = `${r.committeeId}:${r.memberId}:${r.knessetNum}`;
    const start = r.startDate ? r.startDate.toISOString().slice(0, 10) : null;
    const finish =
      r.isCurrent || !r.finishDate
        ? null
        : r.finishDate.toISOString().slice(0, 10);
    if (!memberRangesMap.has(key)) memberRangesMap.set(key, []);
    memberRangesMap.get(key)!.push({ start, finish });
  }

  // Merge overlapping/adjacent ranges per member, keep non-overlapping ones separate
  function mergeRanges(ranges: Range[]): Range[] {
    if (ranges.length <= 1) return ranges;
    // Sort by start date (null = earliest)
    const sorted = [...ranges].sort((a, b) => {
      if (!a.start && !b.start) return 0;
      if (!a.start) return -1;
      if (!b.start) return 1;
      return a.start.localeCompare(b.start);
    });
    const merged: Range[] = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      const prev = merged[merged.length - 1];
      const curr = sorted[i];
      // If prev has no end (open-ended), it absorbs everything after it
      if (prev.finish === null) continue;
      // If curr starts before or at prev's finish, merge them
      if (!curr.start || curr.start <= prev.finish) {
        prev.finish =
          curr.finish === null
            ? null
            : prev.finish > curr.finish
              ? prev.finish
              : curr.finish;
      } else {
        merged.push(curr);
      }
    }
    return merged;
  }

  const memberWindows = new Map<string, Range[]>();
  for (const [key, ranges] of memberRangesMap) {
    memberWindows.set(key, mergeRanges(ranges));
  }

  // Collect all distinct meeting dates per committee+knesset for denominators
  const totalMeetings = new Map<string, Set<string>>();
  // Track attended meetings per MK+committee+knesset (distinct dates)
  const attendedMeetings = new Map<string, Set<string>>();

  for (const row of csvRows) {
    const kn = Number(row.knesset_num);
    if (!syncKnessets.has(kn)) continue;

    const committeeKnessetId = Number(row.committee_id);
    const committeeId = committeeMap.get(committeeKnessetId);
    if (!committeeId) continue;

    const meetingDate = row.meeting_start_date;
    const ckKey = `${committeeId}:${kn}`;

    if (!totalMeetings.has(ckKey)) totalMeetings.set(ckKey, new Set());
    totalMeetings.get(ckKey)!.add(meetingDate);

    const mkId = Number(row.mk_id);
    const personId = mkIdToPersonId.get(mkId);
    const memberId = personId ? memberMap.get(personId) : undefined;
    if (!memberId) continue;

    const key = `${committeeId}:${memberId}:${kn}`;
    if (!attendedMeetings.has(key)) attendedMeetings.set(key, new Set());
    attendedMeetings.get(key)!.add(meetingDate);
  }

  // Build final stats, scoping the denominator to the member's active ranges.
  // Attended is already naturally scoped (a member can't attend before joining).
  function countInRanges(
    dates: Set<string>,
    ranges: Range[] | undefined,
  ): number {
    if (!ranges || ranges.length === 0) return dates.size;
    let n = 0;
    for (const d of dates) {
      for (const range of ranges) {
        if (range.start && d < range.start) continue;
        if (range.finish && d > range.finish) continue;
        n++;
        break; // date matched one range, no need to check others
      }
    }
    return n;
  }

  const statsMap = new Map<string, { attended: number; protocol: number }>();

  for (const [key, dates] of attendedMeetings) {
    const [committeeIdStr, , knStr] = key.split(':');
    const ckKey = `${committeeIdStr}:${knStr}`;
    const allDates = totalMeetings.get(ckKey);
    const ranges = memberWindows.get(key);
    const protocol = allDates ? countInRanges(allDates, ranges) : 0;
    statsMap.set(key, { attended: dates.size, protocol });
  }

  console.log(
    `  [committee-members] Aggregated ${statsMap.size} attendance stat entries`,
  );

  // Fill in 0-attendance for current members whose committee had sessions but
  // who never appear in the attendance CSV (i.e. attended 0 meetings in their
  // active window). Scope denominator to their window too.
  const committeeKnSet = new Set(totalMeetings.keys());
  const currentMembers = await db
    .select({
      committeeId: committeeMembers.committeeId,
      memberId: committeeMembers.memberId,
      knessetNum: committeeMembers.knessetNum,
    })
    .from(committeeMembers)
    .where(eq(committeeMembers.isCurrent, true));

  let zeroFilled = 0;
  for (const cm of currentMembers) {
    const ckKey = `${cm.committeeId}:${cm.knessetNum}`;
    if (!committeeKnSet.has(ckKey)) continue;
    const key = `${cm.committeeId}:${cm.memberId}:${cm.knessetNum}`;
    if (statsMap.has(key)) continue;
    const ranges = memberWindows.get(key);
    const protocol = countInRanges(totalMeetings.get(ckKey)!, ranges);
    statsMap.set(key, { attended: 0, protocol });
    zeroFilled++;
  }

  console.log(
    `  [committee-members] Zero-filled attendance for ${zeroFilled} non-attending current members`,
  );

  // Update existing committee_members rows with attendance stats in batches
  // to avoid thousands of round-trips to the database.
  const updates = Array.from(statsMap.entries()).map(([key, stats]) => {
    const [committeeIdStr, memberIdStr, knStr] = key.split(':');
    const percent =
      stats.protocol > 0
        ? Math.min(
            Math.round((stats.attended / stats.protocol) * 10000) / 100,
            100,
          )
        : null;

    return {
      committee_id: Number(committeeIdStr),
      member_id: Number(memberIdStr),
      knesset_num: Number(knStr),
      attended_meetings: stats.attended,
      protocol_meetings: stats.protocol,
      attendance_percent: percent,
    };
  });

  let updated = 0;
  for (let i = 0; i < updates.length; i += ATTENDANCE_UPDATE_BATCH_SIZE) {
    const batch = updates.slice(i, i + ATTENDANCE_UPDATE_BATCH_SIZE);
    const payload = JSON.stringify(batch);

    await db.execute(sql`
      WITH data AS (
        SELECT *
        FROM json_to_recordset(${payload}::json) AS x(
          committee_id int,
          member_id int,
          knesset_num int,
          attended_meetings int,
          protocol_meetings int,
          attendance_percent real
        )
      )
      UPDATE committee_members AS cm
      SET
        attended_meetings = data.attended_meetings,
        protocol_meetings = data.protocol_meetings,
        attendance_percent = data.attendance_percent,
        updated_at = NOW()
      FROM data
      WHERE cm.committee_id = data.committee_id
        AND cm.member_id = data.member_id
        AND cm.knesset_num = data.knesset_num
    `);

    updated += batch.length;
  }

  console.log(
    `  [committee-members] Updated attendance stats for ${updated} members`,
  );
}

/**
 * Populate committees.chairmanId from current committee_members rows.
 * Priority: positionId=41 (chair) > positionId=67 (deputy / acting chair).
 * Clears chairmanId if no current chair/deputy is found so stale data doesn't linger.
 */
async function syncCommitteeChairs(): Promise<void> {
  const updated = await db.execute(sql`
    WITH ranked AS (
      SELECT
        cm.committee_id,
        cm.member_id,
        ROW_NUMBER() OVER (
          PARTITION BY cm.committee_id
          ORDER BY
            CASE cm.position_id WHEN 41 THEN 0 WHEN 67 THEN 1 ELSE 2 END,
            cm.start_date DESC NULLS LAST
        ) AS rn
      FROM committee_members cm
      WHERE cm.is_current = true
        AND cm.position_id IN (41, 67)
    ),
    picks AS (
      SELECT committee_id, member_id FROM ranked WHERE rn = 1
    )
    UPDATE committees c
    SET chairman_id = p.member_id,
        updated_at = NOW()
    FROM picks p
    WHERE c.id = p.committee_id
      AND (c.chairman_id IS DISTINCT FROM p.member_id)
    RETURNING c.id
  `);
  console.log(
    `  [committee-members] Updated chairman_id for ${updated.length} committees`,
  );

  // Clear stale chairman_id where no current chair/deputy exists
  const cleared = await db.execute(sql`
    UPDATE committees c
    SET chairman_id = NULL, updated_at = NOW()
    WHERE c.chairman_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM committee_members cm
        WHERE cm.committee_id = c.id
          AND cm.is_current = true
          AND cm.position_id IN (41, 67)
      )
    RETURNING c.id
  `);
  if (cleared.length > 0) {
    console.log(
      `  [committee-members] Cleared chairman_id for ${cleared.length} committees with no current chair`,
    );
  }
}

export async function syncCommitteeMembers(): Promise<void> {
  await runSyncJob('committee-members', syncCommitteeMemberRecords);
}
