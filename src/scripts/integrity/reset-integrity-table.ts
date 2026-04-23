/**
 * Truncates integrity_cases so the pipeline can repopulate from scratch.
 * Run with: pnpm tsx src/scripts/integrity/reset-integrity-table.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { db } = await import('../../lib/db');
  const { integrityCases } = await import('../../lib/db/schema');
  const before = await db
    .select({ id: integrityCases.id })
    .from(integrityCases);
  await db.delete(integrityCases);
  console.log(
    `[reset-integrity] Deleted ${before.length} rows from integrity_cases`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
