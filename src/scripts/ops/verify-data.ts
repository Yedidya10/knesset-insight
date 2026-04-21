import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { db } = await import('../../lib/db');
  const { sql } = await import('drizzle-orm');

  const result = await db.execute(
    sql.raw(`
    SELECT 
      (SELECT count(*) FROM member_votes WHERE member_id = 1132) as vote_count,
      (SELECT count(*) FROM bill_initiators WHERE member_id = 1132) as bill_count,
      (SELECT count(*) FROM member_votes) as total_member_votes,
      (SELECT count(*) FROM bill_initiators) as total_bill_initiators
  `),
  );
  console.log('Dan Illouz (id=1132):', result[0]);

  // Also check a few more members for sanity
  const topVoters = await db.execute(
    sql.raw(`
    SELECT m.first_name_he, m.last_name_he, count(*) as vote_count
    FROM member_votes mv
    JOIN members m ON mv.member_id = m.id
    GROUP BY m.id, m.first_name_he, m.last_name_he
    ORDER BY vote_count DESC
    LIMIT 5
  `),
  );
  console.log('\nTop 5 members by votes:');
  for (const r of topVoters) {
    console.log(
      `  ${r.first_name_he} ${r.last_name_he}: ${r.vote_count} votes`,
    );
  }

  process.exit(0);
}

main();
