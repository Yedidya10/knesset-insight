import { sql, eq, and, inArray } from 'drizzle-orm';
import { db } from '../../lib/db';
import { committees, committeeMembers, members } from '../../lib/db/schema';
import { fetchV4CommitteeMembers } from '../../lib/knesset/knesset-api-client';
import { fetchOKnessetCSV } from '../../lib/knesset/oknesset-client';
import { runSyncJob, type SyncCheckpoint } from '../utils';
import { appConfig } from '../../../app.config';

const BATCH_SIZE = 50;

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
 * Sync aggregated attendance stats from Open Knesset CSV.
 * Uses committee_meetings_attendees_mks_full_stats.csv which has
 * pre-aggregated per-MK per-committee per-knesset attendance.
 */
async function syncAttendanceStats(
  committeeMap: Map<number, number>,
  memberMap: Map<number, number>,
): Promise<void> {
  let csvRows: Record<string, string>[];
  try {
    csvRows = await fetchOKnessetCSV<Record<string, string>>(
      'people/committees/meeting_attendees_mks_full_stats/committee_meetings_attendees_mks_full_stats.csv',
    );
  } catch (err) {
    console.warn(
      '  [committee-members] Failed to fetch attendance stats CSV, skipping:',
      err instanceof Error ? err.message : err,
    );
    return;
  }

  console.log(
    `  [committee-members] Loaded ${csvRows.length} attendance stat rows from Open Knesset`,
  );

  // Filter to synced knessets and aggregate: sum across plenum/assembly/pagra
  const syncKnessets = new Set(appConfig.knesset.syncKnessets);
  const statsMap = new Map<string, { attended: number; protocol: number }>();

  for (const row of csvRows) {
    const kn = Number(row.knesset);
    if (!syncKnessets.has(kn)) continue;

    const committeeKnessetId = Number(row.committee_id);
    const mkId = Number(row.mk_id);
    const committeeId = committeeMap.get(committeeKnessetId);
    const memberId = memberMap.get(mkId);
    if (!committeeId || !memberId) continue;

    const key = `${committeeId}:${memberId}:${kn}`;
    const existing = statsMap.get(key) ?? { attended: 0, protocol: 0 };
    existing.attended += Number(row.attended_meetings) || 0;
    existing.protocol += Number(row.protocol_meetings) || 0;
    statsMap.set(key, existing);
  }

  console.log(
    `  [committee-members] Aggregated ${statsMap.size} attendance stat entries`,
  );

  // Update existing committee_members rows with attendance stats
  let updated = 0;
  for (const [key, stats] of statsMap) {
    const [committeeIdStr, memberIdStr, knStr] = key.split(':');
    const committeeId = Number(committeeIdStr);
    const memberId = Number(memberIdStr);
    const knessetNum = Number(knStr);
    const percent =
      stats.protocol > 0
        ? Math.round((stats.attended / stats.protocol) * 10000) / 100
        : null;

    await db
      .update(committeeMembers)
      .set({
        attendedMeetings: stats.attended,
        protocolMeetings: stats.protocol,
        attendancePercent: percent,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(committeeMembers.committeeId, committeeId),
          eq(committeeMembers.memberId, memberId),
          eq(committeeMembers.knessetNum, knessetNum),
        ),
      );

    updated++;
  }

  console.log(
    `  [committee-members] Updated attendance stats for ${updated} members`,
  );
}

export async function syncCommitteeMembers(): Promise<void> {
  await runSyncJob('committee-members', syncCommitteeMemberRecords);
}
