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

  // Pass 1: Count total meetings per committee+knesset (distinct meeting dates)
  const totalMeetings = new Map<string, Set<string>>();
  // Pass 2: Count attended meetings per MK (distinct meeting dates)
  const attendedMeetings = new Map<string, Set<string>>();

  for (const row of csvRows) {
    const kn = Number(row.knesset_num);
    if (!syncKnessets.has(kn)) continue;

    const committeeKnessetId = Number(row.committee_id);
    const committeeId = committeeMap.get(committeeKnessetId);
    if (!committeeId) continue;

    const meetingDate = row.meeting_start_date;
    const ckKey = `${committeeId}:${kn}`;

    // Track distinct meetings per committee+knesset
    if (!totalMeetings.has(ckKey)) totalMeetings.set(ckKey, new Set());
    totalMeetings.get(ckKey)!.add(meetingDate);

    // Track attended meetings per MK+committee+knesset (distinct dates)
    const mkId = Number(row.mk_id);
    const personId = mkIdToPersonId.get(mkId);
    const memberId = personId ? memberMap.get(personId) : undefined;
    if (!memberId) continue;

    const key = `${committeeId}:${memberId}:${kn}`;
    if (!attendedMeetings.has(key)) attendedMeetings.set(key, new Set());
    attendedMeetings.get(key)!.add(meetingDate);
  }

  // Build final stats
  const statsMap = new Map<string, { attended: number; protocol: number }>();

  for (const [key, dates] of attendedMeetings) {
    const [committeeIdStr, , knStr] = key.split(':');
    const ckKey = `${committeeIdStr}:${knStr}`;
    const protocol = totalMeetings.get(ckKey)?.size ?? 0;
    statsMap.set(key, { attended: dates.size, protocol });
  }

  console.log(
    `  [committee-members] Aggregated ${statsMap.size} attendance stat entries`,
  );

  // Fill in 0-attendance for current members whose committee had sessions but
  // who never appear in the attendance CSV (i.e. they attended 0 meetings).
  // Without this, those members would show null (no bar) instead of 0%.
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
    if (!committeeKnSet.has(ckKey)) continue; // committee had no tracked meetings
    const key = `${cm.committeeId}:${cm.memberId}:${cm.knessetNum}`;
    if (statsMap.has(key)) continue; // already has data from CSV
    statsMap.set(key, {
      attended: 0,
      protocol: totalMeetings.get(ckKey)!.size,
    });
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
        ? Math.round((stats.attended / stats.protocol) * 10000) / 100
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

export async function syncCommitteeMembers(): Promise<void> {
  await runSyncJob('committee-members', syncCommitteeMemberRecords);
}
