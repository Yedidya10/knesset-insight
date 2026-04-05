import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { db } = await import('../lib/db');
  const { sql } = await import('drizzle-orm');

  // Find Michel Buskila
  const buskila = await db.execute(sql.raw(`
    SELECT m.id, m.first_name, m.last_name, m.vip_id, m.knesset_id,
      (SELECT count(*) FROM member_votes WHERE member_id = m.id) as vote_count,
      (SELECT count(*) FROM bill_initiators WHERE member_id = m.id) as bill_count
    FROM members m
    WHERE m.last_name LIKE '%בוסקילה%'
  `));
  console.log('Buskila:', JSON.stringify(buskila, null, 2));

  // Count members with 0 votes from current knesset
  const zeroVotes = await db.execute(sql.raw(`
    SELECT count(*) as cnt
    FROM members m
    WHERE m.is_current = true
    AND NOT EXISTS (SELECT 1 FROM member_votes mv WHERE mv.member_id = m.id)
  `));
  console.log('Current members with 0 votes:', zeroVotes[0]);

  // Sample of current members with 0 votes
  const sample = await db.execute(sql.raw(`
    SELECT m.id, m.first_name, m.last_name, m.vip_id, m.knesset_id
    FROM members m
    WHERE m.is_current = true
    AND NOT EXISTS (SELECT 1 FROM member_votes mv WHERE mv.member_id = m.id)
    LIMIT 10
  `));
  console.log('Sample current members with 0 votes:', JSON.stringify(sample, null, 2));

  // Check if Buskila has a vipId but no votes
  const buskilaVip = await db.execute(sql.raw(`
    SELECT m.id, m.first_name, m.last_name, m.vip_id, m.knesset_id, m.knesset_num
    FROM members m
    WHERE m.last_name LIKE '%בוסקילה%'
  `));
  console.log('Buskila details:', JSON.stringify(buskilaVip, null, 2));

  process.exit(0);
}

main();
