/**
 * Run ONLY the member_votes sync phase (skipping vote headers).
 * Useful when vote headers are already in DB and you just need to
 * re-sync the member vote records.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  // Dynamic import so env vars are loaded before DB module initializes
  const { syncMemberVotesOnly } =
    await import('../../pipeline/jobs/sync-votes');
  console.log('Starting member_votes-only sync...');
  await syncMemberVotesOnly();
  console.log('Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
