import { config } from 'dotenv';
config({ path: '.env.local' });

/**
 * Re-sync committee member attendance stats by clearing the checkpoint
 * so the next sync does a full refresh including attendance CSV data.
 */
async function main() {
  const { db } = await import('../../lib/db');
  const { sql } = await import('drizzle-orm');

  // Clear the committee-members checkpoint so next sync is full (includes attendance)
  await db.execute(
    sql.raw(
      `UPDATE sync_log SET last_checkpoint = NULL WHERE entity = 'committee-members'`,
    ),
  );
  console.log('Cleared committee-members checkpoint');

  // Run the sync
  const { syncCommitteeMembers } =
    await import('../../pipeline/jobs/sync-committee-members');
  await syncCommitteeMembers();

  console.log('Done!');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
