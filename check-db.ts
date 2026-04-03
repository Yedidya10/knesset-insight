import { config } from 'dotenv';
config({ path: '.env.local' });
import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
  
  try {
    const test = await sql`SELECT 1 as test`;
    console.log('DB connected:', test[0]);
  } catch (e: any) {
    console.error('DB connection failed:', e.message);
    process.exit(1);
  }

  const voteCount = await sql`SELECT count(*)::int as count FROM votes WHERE knesset_num = 25`;
  console.log('K25 vote headers:', voteCount[0].count);

  const withTallies = await sql`SELECT count(*)::int as count FROM votes WHERE knesset_num = 25 AND for_count > 0`;
  console.log('K25 votes with tallies:', withTallies[0].count);

  const mvCount = await sql`SELECT count(*)::int as count FROM member_votes mv JOIN votes v ON mv.vote_id = v.id WHERE v.knesset_num = 25`;
  console.log('K25 member votes:', mvCount[0].count);

  const sample = await sql`SELECT knesset_id, for_count, against_count, abstain_count, substring(title, 1, 60) as title FROM votes WHERE knesset_num = 25 AND for_count > 0 LIMIT 3`;
  if (sample.length > 0) {
    console.log('\nSample votes with tallies:');
    for (const v of sample) {
      console.log(`  ID=${v.knesset_id} for=${v.for_count} against=${v.against_count} abstain=${v.abstain_count} "${v.title}"`);
    }
  }

  await sql.end();
  process.exit(0);
}
main();
