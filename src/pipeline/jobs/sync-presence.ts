import { sql } from 'drizzle-orm';
import { db } from '../../lib/db';
import { memberPresence, members } from '../../lib/db/schema';
import { fetchOKnessetCSV } from '../../lib/knesset/oknesset-client';
import { runSyncJob } from '../utils';

const BATCH_SIZE = 500;

/**
 * Sync daily MK presence data from Open Knesset's presence.csv.
 *
 * CSV fields: mk_id, mk_name, date, year, month, day, year_week_number, total_attended_hours
 * mk_id is mk_individual_id — we use mk_individual.csv to bridge to PersonID → DB member id.
 */
async function syncPresenceRecords(): Promise<number> {
  // ── Step 1: Build mk_individual_id → PersonID mapping ──
  let mkMembers: Record<string, string>[];
  try {
    mkMembers = await fetchOKnessetCSV<Record<string, string>>(
      'members/mk_individual/mk_individual.csv',
    );
  } catch (err) {
    console.warn(
      '  [presence] Failed to fetch mk_individual.csv, aborting:',
      err instanceof Error ? err.message : err,
    );
    return 0;
  }

  const mkIdToPersonId = new Map<number, number>();
  for (const m of mkMembers) {
    const mkId = Number(m.mk_individual_id);
    const personId = Number(m.PersonID);
    if (mkId && personId) mkIdToPersonId.set(mkId, personId);
  }
  console.log(
    `  [presence] Built mk_individual_id → PersonID mapping: ${mkIdToPersonId.size} entries`,
  );

  // ── Step 2: Build PersonID → DB member id mapping ──
  const allMembers = await db
    .select({ id: members.id, knessetId: members.knessetId })
    .from(members);
  const memberMap = new Map(allMembers.map((m) => [m.knessetId, m.id]));

  // ── Step 3: Fetch presence CSV ──
  let csvRows: Record<string, string>[];
  try {
    csvRows = await fetchOKnessetCSV<Record<string, string>>(
      'members/presence/presence.csv',
    );
  } catch (err) {
    console.warn(
      '  [presence] Failed to fetch presence.csv, aborting:',
      err instanceof Error ? err.message : err,
    );
    return 0;
  }
  console.log(
    `  [presence] Loaded ${csvRows.length} presence rows from Open Knesset`,
  );

  // ── Step 4: Transform rows ──
  const rows: { memberId: number; date: string; totalAttendedHours: number }[] =
    [];
  let skipped = 0;

  for (const row of csvRows) {
    const mkId = Number(row.mk_id);
    const personId = mkIdToPersonId.get(mkId);
    if (!personId) {
      skipped++;
      continue;
    }
    const memberId = memberMap.get(personId);
    if (!memberId) {
      skipped++;
      continue;
    }

    const dateStr = row.date;
    const hours = Number(row.total_attended_hours);
    if (!dateStr || isNaN(hours)) {
      skipped++;
      continue;
    }

    rows.push({
      memberId,
      date: dateStr,
      totalAttendedHours: Math.round(hours),
    });
  }

  if (skipped > 0) {
    console.log(`  [presence] Skipped ${skipped} rows (unmapped or invalid)`);
  }

  // ── Step 5: Batch upsert into member_presence ──
  let upserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    await db
      .insert(memberPresence)
      .values(batch)
      .onConflictDoUpdate({
        target: [memberPresence.memberId, memberPresence.date],
        set: {
          totalAttendedHours: sql`excluded.total_attended_hours`,
        },
      });

    upserted += batch.length;
  }

  console.log(`  [presence] Upserted ${upserted} presence records`);
  return upserted;
}

/**
 * Public entry point — wraps with runSyncJob for logging/checkpointing.
 */
export async function syncPresence(): Promise<void> {
  await runSyncJob('presence', async () => {
    const count = await syncPresenceRecords();
    return count;
  });
}
