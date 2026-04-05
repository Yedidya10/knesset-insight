import { config } from 'dotenv';
config({ path: '.env.local' });

import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);
  try {
    await sql.unsafe('ALTER TABLE members ADD COLUMN IF NOT EXISTS vip_id integer');
    console.log('Migration done: vip_id column added to members table');

    // Verify Dan Illouz (PersonID=30839) got vipId=34520
    const rows = await sql.unsafe(`SELECT id, knesset_id, vip_id, first_name, last_name FROM members WHERE knesset_id = 30839`);
    console.log('Dan Illouz:', rows[0]);

    // Count members with vipId populated
    const counts = await sql.unsafe(`SELECT count(*) as total, count(vip_id) as with_vip_id FROM members`);
    console.log('Member vipId coverage:', counts[0]);

    // Reset member_votes sync timestamp to force full re-sync
    await sql.unsafe(`DELETE FROM sync_log WHERE entity = 'member_votes'`);
    console.log('Reset member_votes sync timestamp');

    // Clear existing member_votes (will be repopulated with correct FKs)
    const deleted = await sql.unsafe(`DELETE FROM member_votes`);
    console.log(`Cleared ${deleted.count} existing member_votes rows`);
  } finally {
    await sql.end();
  }
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
