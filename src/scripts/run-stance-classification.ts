/**
 * Phase 1 Part B — Classify votes into policy stances using AI.
 *
 * Usage: npx tsx src/scripts/run-stance-classification.ts
 *
 * The classifyVoteStances job:
 * - Picks votes on bills with AI summaries first (rich context)
 * - Uses Claude Sonnet to classify vote → policy stance alignment
 * - Creates new stances dynamically from AI suggestions
 * - Caches document text in bill_classification_context
 * - batchSize=15 per run (from appConfig)
 * - dailyTokenBudget caps at 500k tokens per run
 *
 * Run multiple times to process more votes.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { classifyVoteStances } =
    await import('../pipeline/jobs/classify-vote-stances');

  console.log('=== Phase 1 Part B: Vote → Stance Classification ===');
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Batch size: 15 (from config)`);
  console.log(`Target: Votes on bills with AI summaries, not yet classified`);
  console.log('');

  const start = Date.now();
  await classifyVoteStances();
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log('');
  console.log(`=== Batch complete in ${elapsed}s ===`);
  process.exit(0);
}

main().catch((e) => {
  console.error('Pipeline failed:', e);
  process.exit(1);
});
