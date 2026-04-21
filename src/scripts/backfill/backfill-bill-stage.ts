/**
 * One-shot backfill: populate bills.current_stage + bills.stage_special_status.
 *
 * Uses computeBillStage() from src/lib/knesset/bill-stages.ts — same logic the
 * UI already runs per-render. After backfill, bill stage can be filtered /
 * sorted server-side via the bills_current_stage_knesset_idx index.
 *
 * Re-runnable: updates everything on each run (cheap — ~thousands of rows).
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { db } = await import('../../lib/db');
  const { bills } = await import('../../lib/db/schema');
  const { computeBillStage } = await import('../../lib/knesset/bill-stages');
  const { sql, inArray } = await import('drizzle-orm');

  const BATCH = 2000;
  let lastId = 0;
  let processed = 0;
  let updated = 0;

  console.log('[backfill-bill-stage] starting');

  for (;;) {
    const rows = await db
      .select({
        id: bills.id,
        status: bills.status,
        subTypeId: bills.subTypeId,
        billType: bills.billType,
        currentStage: bills.currentStage,
        stageSpecialStatus: bills.stageSpecialStatus,
      })
      .from(bills)
      .where(sql`${bills.id} > ${lastId}`)
      .orderBy(bills.id)
      .limit(BATCH);

    if (rows.length === 0) break;

    // Bucket rows by (stage, special) pair to allow batched updates
    const buckets = new Map<
      string,
      { stage: number; special: string | null; ids: number[] }
    >();
    for (const r of rows) {
      const computed = computeBillStage(r.status, r.subTypeId, r.billType);
      const stage = computed.currentStage;
      const special = computed.specialStatus ?? null;
      if (r.currentStage === stage && r.stageSpecialStatus === special)
        continue;
      const key = `${stage}|${special ?? ''}`;
      const b = buckets.get(key) ?? { stage, special, ids: [] };
      b.ids.push(r.id);
      buckets.set(key, b);
    }
    const CHUNK = 500;
    for (const { stage, special, ids } of buckets.values()) {
      for (let j = 0; j < ids.length; j += CHUNK) {
        const chunk = ids.slice(j, j + CHUNK);
        await db
          .update(bills)
          .set({ currentStage: stage, stageSpecialStatus: special })
          .where(inArray(bills.id, chunk));
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
    `\n[backfill-bill-stage] ✓ done · processed=${processed} updated=${updated}`,
  );

  const counts = await db
    .select({
      stage: bills.currentStage,
      special: bills.stageSpecialStatus,
      n: sql<number>`count(*)::int`,
    })
    .from(bills)
    .groupBy(bills.currentStage, bills.stageSpecialStatus)
    .orderBy(bills.currentStage);
  console.log('── (current_stage, special_status) distribution ──');
  for (const c of counts) {
    console.log(
      `  stage=${c.stage ?? '(null)'} special=${c.special ?? '(null)'}: ${c.n.toLocaleString()}`,
    );
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
