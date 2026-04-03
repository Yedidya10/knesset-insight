/**
 * Standalone sync script — run with: pnpm sync
 * Loads .env.local and runs the sync pipeline directly.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

const job = process.argv[2] as 'members' | 'votes' | 'bills' | 'committees' | 'images' | 'parties' | 'elections' | 'links' | 'all' | undefined;

async function main() {
  // Dynamic imports so env vars are loaded before DB module initializes
  const { syncMembers } = await import('../pipeline/jobs/sync-members');
  const { syncVotes } = await import('../pipeline/jobs/sync-votes');
  const { syncBills } = await import('../pipeline/jobs/sync-bills');
  const { syncCommittees } = await import('../pipeline/jobs/sync-committees');
  const { syncMemberImages } = await import('../pipeline/jobs/sync-images');
  const { syncRegisteredParties } = await import('../pipeline/jobs/sync-registered-parties');
  const { syncElectoralLists } = await import('../pipeline/jobs/sync-electoral-lists');
  const { syncPoliticalLinks } = await import('../pipeline/jobs/sync-political-links');

  const target = job ?? 'all';
  console.log(`Starting sync: ${target}`);
  const start = Date.now();

  if (target === 'members' || target === 'all') {
    await syncMembers();
  }

  if (target === 'votes' || target === 'all') {
    await syncVotes();
  }

  if (target === 'bills' || target === 'all') {
    await syncBills();
  }

  if (target === 'committees' || target === 'all') {
    await syncCommittees();
  }

  if (target === 'images' || target === 'all') {
    await syncMemberImages();
  }

  if (target === 'parties' || target === 'all') {
    await syncRegisteredParties();
  }

  if (target === 'elections' || target === 'all') {
    await syncElectoralLists();
  }

  if (target === 'links' || target === 'all') {
    await syncPoliticalLinks();
  }

  console.log(`Sync complete in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});
