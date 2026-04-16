/**
 * Phase 1 Batch Runner — Generate AI summaries for K25 bills with documents.
 *
 * Usage: npx tsx src/scripts/run-bill-summaries.ts
 *
 * The generateBillSummaries job:
 * - Picks bills WITH documents first (docs-first ordering)
 * - Uses unpdf/officeparser to extract text locally ($0)
 * - Falls back to Tavily only for bills without docs
 * - Respects dailyTokenBudget (5M tokens)
 * - batchSize=100 per run
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { generateBillSummaries } =
    await import('../pipeline/jobs/generate-bill-summaries');

  console.log('=== Phase 1: Starting bill summary generation ===');
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Batch size: 100 (from config)`);
  console.log(`Target: K25 bills with documents (docs-first ordering)`);
  console.log('');

  const start = Date.now();
  await generateBillSummaries();
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log('');
  console.log(`=== Batch complete in ${elapsed}s ===`);
  process.exit(0);
}

main().catch((e) => {
  console.error('Pipeline failed:', e);
  process.exit(1);
});
