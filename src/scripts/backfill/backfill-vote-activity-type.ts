/**
 * One-shot backfill: populate votes.activity_type for existing rows.
 *
 * After this runs, the votes filter page can use the indexed column
 * directly instead of the 5-branch title regex.
 *
 * Re-runnable: only updates rows where activity_type IS NULL (default) or
 *   the computed value differs (when called with --force).
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const force = process.argv.includes('--force');

  const { db } = await import('../../lib/db');
  const { votes } = await import('../../lib/db/schema');
  const { classifyVoteActivity } =
    await import('../../lib/votes/activity-type');
  const { sql, inArray } = await import('drizzle-orm');

  const BATCH = 2000;
  let processed = 0;
  let updated = 0;
  let lastId = 0;

  console.log(
    `[backfill-vote-activity] starting (${force ? 'force all' : 'only NULL'})`,
  );

  // Stream rows by ascending id; do not rely on WHERE activity_type IS NULL
  // inside the loop because we update rows as we go.
  for (;;) {
    const rows = await db
      .select({
        id: votes.id,
        title: votes.title,
        billId: votes.billId,
        activityType: votes.activityType,
      })
      .from(votes)
      .where(
        force
          ? sql`${votes.id} > ${lastId}`
          : sql`${votes.id} > ${lastId} AND ${votes.activityType} IS NULL`,
      )
      .orderBy(votes.id)
      .limit(BATCH);

    if (rows.length === 0) break;

    // Bucket by target activity type for batched UPDATE WHERE id = ANY
    const buckets = new Map<string, number[]>();
    for (const r of rows) {
      const target = classifyVoteActivity(r.title, r.billId);
      if (!force && r.activityType === target) continue;
      const list = buckets.get(target) ?? [];
      list.push(r.id);
      buckets.set(target, list);
    }

    const CHUNK = 500;
    for (const [target, ids] of buckets) {
      for (let j = 0; j < ids.length; j += CHUNK) {
        const chunk = ids.slice(j, j + CHUNK);
        await db
          .update(votes)
          .set({ activityType: target })
          .where(inArray(votes.id, chunk));
      }
      updated += ids.length;
    }

    processed += rows.length;
    lastId = rows[rows.length - 1].id;
    process.stdout.write(
      `  processed ${processed.toLocaleString()} (updated ${updated.toLocaleString()}) · lastId=${lastId}\r`,
    );
  }

  console.log(
    `\n[backfill-vote-activity] ✓ done · processed=${processed} updated=${updated}`,
  );

  // Sanity summary
  const counts = await db
    .select({
      activityType: votes.activityType,
      n: sql<number>`count(*)::int`,
    })
    .from(votes)
    .groupBy(votes.activityType)
    .orderBy(sql`count(*) DESC`);
  console.log('── activity_type distribution ──');
  for (const c of counts) {
    console.log(`  ${c.activityType ?? '(null)'}: ${c.n.toLocaleString()}`);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
