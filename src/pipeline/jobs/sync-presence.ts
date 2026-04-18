import { sql } from 'drizzle-orm';
import { db } from '../../lib/db';
import { memberPresence, members } from '../../lib/db/schema';
import { fetchOKnessetCSV } from '../../lib/knesset/oknesset-client';
import { appConfig } from '../../../app.config';
import { runSyncJob } from '../utils';

const BATCH_SIZE = 500;

/**
 * Ping interval in minutes — Open Knesset samples presence every ~7 minutes.
 */
const PING_INTERVAL_MINUTES = 7;

/**
 * Sync daily MK presence data from Open Knesset's presence.txt.
 *
 * presence.txt is a raw ping file — each line is:
 *   timestamp, mk_individual_id1, mk_individual_id2, ...
 * listing which MKs were physically present at each ~7-min sample.
 *
 * We aggregate pings per mk_id per date to compute total_attended_hours,
 * then bridge mk_individual_id → PersonID → DB member id.
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

  // ── Step 3: Fetch presence.txt raw ping data ──
  const baseUrl = appConfig.dataSources.oknessetData;
  const url = `${baseUrl}/members/presence/presence.txt`;
  let rawText: string;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    rawText = await res.text();
  } catch (err) {
    console.warn(
      '  [presence] Failed to fetch presence.txt, aborting:',
      err instanceof Error ? err.message : err,
    );
    return 0;
  }

  const lines = rawText.trim().split('\n');
  console.log(
    `  [presence] Loaded ${lines.length} ping lines from presence.txt`,
  );

  // ── Step 4: Aggregate pings per mk_individual_id per date ──
  // Key: "mkId:date", Value: number of pings
  const pingCounts = new Map<string, number>();
  let skippedLines = 0;

  for (const line of lines) {
    const parts = line.split(',').map((s) => s.trim());
    const timestamp = parts[0];
    if (!timestamp) {
      skippedLines++;
      continue;
    }

    // Extract date (YYYY-MM-DD) from timestamp (YYYY-MM-DD HH:MM:SS)
    const date = timestamp.substring(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      skippedLines++;
      continue;
    }

    // Remaining parts are mk_individual_ids
    for (let i = 1; i < parts.length; i++) {
      const mkId = Number(parts[i]);
      if (!mkId) continue;
      const key = `${mkId}:${date}`;
      pingCounts.set(key, (pingCounts.get(key) || 0) + 1);
    }
  }

  console.log(
    `  [presence] Aggregated ${pingCounts.size} mk-date pairs (${skippedLines} lines skipped)`,
  );

  // ── Step 5: Transform to DB rows ──
  const rows: { memberId: number; date: string; totalAttendedHours: number }[] =
    [];
  let unmapped = 0;

  for (const [key, pings] of pingCounts) {
    const [mkIdStr, date] = key.split(':');
    const mkId = Number(mkIdStr);

    const personId = mkIdToPersonId.get(mkId);
    if (!personId) {
      unmapped++;
      continue;
    }
    const memberId = memberMap.get(personId);
    if (!memberId) {
      unmapped++;
      continue;
    }

    const hours = Math.round((pings * PING_INTERVAL_MINUTES) / 60);
    rows.push({ memberId, date, totalAttendedHours: hours });
  }

  if (unmapped > 0) {
    console.log(
      `  [presence] ${unmapped} mk-date pairs unmapped (no DB member)`,
    );
  }
  console.log(`  [presence] ${rows.length} rows to upsert`);

  // ── Step 6: Batch upsert into member_presence ──
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
