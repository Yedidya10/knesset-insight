/**
 * Targeted sync script for specific Knesset numbers.
 * Usage: npx tsx src/scripts/sync-knessets.ts 25 24 23
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

const knessetNums = process.argv.slice(2).map(Number).filter((n) => !isNaN(n) && n > 0);

if (knessetNums.length === 0) {
  console.error('Usage: npx tsx src/scripts/sync-knessets.ts <knesset_num> [knesset_num...]');
  console.error('Example: npx tsx src/scripts/sync-knessets.ts 25 24 23');
  process.exit(1);
}

async function main() {
  const { syncVotesForKnessets } = await import('../pipeline/jobs/sync-votes');

  console.log(`\nStarting targeted votes sync for Knessets: ${knessetNums.join(', ')}`);
  console.log(`Time: ${new Date().toISOString()}\n`);
  const start = Date.now();

  await syncVotesForKnessets(knessetNums);

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\nSync completed in ${elapsed}s`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});
