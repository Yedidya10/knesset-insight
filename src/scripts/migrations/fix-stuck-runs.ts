import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { db } = await import('../../lib/db');
  const { sql } = await import('drizzle-orm');

  const result = await db.execute(
    sql`UPDATE pipeline_run_log SET run_status = 'failed', completed_at = NOW(), error_summary = 'Manually cancelled' WHERE run_status = 'running' AND job_name = 'classify-vote-stances'`,
  );
  console.log('Fixed stuck runs');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
