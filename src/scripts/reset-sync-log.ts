import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { db } = await import('../lib/db');
  const { syncLog } = await import('../lib/db/schema');
  const { eq } = await import('drizzle-orm');

  const entity = process.argv[2];
  if (!entity) {
    console.error('Usage: npx tsx src/scripts/reset-sync-log.ts <entity>');
    process.exit(1);
  }

  await db.delete(syncLog).where(eq(syncLog.entity, entity));
  console.log(`Deleted sync_log entry for '${entity}'`);
  process.exit(0);
}

main();
