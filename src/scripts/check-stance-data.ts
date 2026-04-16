import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { db } = await import('../lib/db');
  const { sql } = await import('drizzle-orm');

  // Count votes linked to bills
  const [votesBills] = await db.execute(sql`
    SELECT 
      count(DISTINCT v.id) as votes_with_bills,
      count(DISTINCT v.bill_id) as bills_with_votes
    FROM votes v 
    WHERE v.bill_id IS NOT NULL
  `);
  console.log('Votes linked to bills:', votesBills);

  // Count bills with AI summaries
  const [aiSummaries] = await db.execute(sql`
    SELECT count(*) as count FROM bills WHERE ai_summary IS NOT NULL
  `);
  console.log('Bills with AI summaries:', aiSummaries);

  // Count bills with topics
  const [aiTopics] = await db.execute(sql`
    SELECT count(*) as count FROM bills WHERE ai_topics IS NOT NULL AND ai_topics != '{}'::jsonb
  `);
  console.log('Bills with AI topics:', aiTopics);

  // Sample vote data structure
  const sampleVotes = await db.execute(sql`
    SELECT v.id, v.knesset_id, v.title, v.vote_date, v.bill_id, v.for_count, v.against_count,
           b.name as bill_name, b.ai_topics
    FROM votes v
    JOIN bills b ON b.id = v.bill_id
    WHERE b.ai_summary IS NOT NULL AND b.ai_topics IS NOT NULL AND b.ai_topics != '{}'::jsonb
    ORDER BY v.vote_date DESC
    LIMIT 5
  `);
  console.log('\nSample votes with bill summaries + topics:');
  for (const v of sampleVotes) {
    console.log(
      `  Vote ${v.id}: "${(v.title as string)?.slice(0, 80)}" → Bill: "${(v.bill_name as string)?.slice(0, 60)}"`,
    );
    console.log(`    Topics: ${JSON.stringify(v.ai_topics)}`);
  }

  // Policy stances table count
  const [stances] = await db.execute(
    sql`SELECT count(*) as count FROM policy_stances`,
  );
  console.log('\nPolicy stances:', stances);

  // Knesset 25 votes with bills
  const [k25] = await db.execute(sql`
    SELECT count(DISTINCT v.id) as votes_count, count(DISTINCT v.bill_id) as bills_count
    FROM votes v
    JOIN bills b ON b.id = v.bill_id
    WHERE b.knesset_num = 25
  `);
  console.log('K25 votes/bills:', k25);

  // Total member_votes for votes with bills
  const [memberVotes] = await db.execute(sql`
    SELECT count(*) as count FROM member_votes mv
    JOIN votes v ON v.id = mv.vote_id
    WHERE v.bill_id IS NOT NULL
  `);
  console.log('Member votes on bill-linked votes:', memberVotes);

  // How many votes have bills with AI summaries
  const [votesWithSummaries] = await db.execute(sql`
    SELECT count(DISTINCT v.id) as count
    FROM votes v
    JOIN bills b ON b.id = v.bill_id
    WHERE b.ai_summary IS NOT NULL
  `);
  console.log('Votes where bill has AI summary:', votesWithSummaries);

  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
