import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '../../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Applying migration: add legacy_vip_id and last_checkpoint...');
  await db.execute(
    sql.raw(
      'ALTER TABLE members ADD COLUMN IF NOT EXISTS legacy_vip_id integer',
    ),
  );
  console.log('  Added members.legacy_vip_id');
  await db.execute(
    sql.raw(
      'ALTER TABLE sync_log ADD COLUMN IF NOT EXISTS last_checkpoint text',
    ),
  );
  console.log('  Added sync_log.last_checkpoint');
  console.log('Migration applied successfully');
  process.exit(0);
}

main().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
