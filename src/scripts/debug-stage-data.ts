import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { db } = await import('../lib/db/index.ts');
  const { votes, billNames } = await import('../lib/db/schema.ts');
  const { eq, desc, sql, and, isNotNull } = await import('drizzle-orm');

  // 1. All bill_names for bill 27 with their typeIds
  const names = await db
    .select()
    .from(billNames)
    .where(eq(billNames.billId, 27));

  console.log('=== BILL NAMES FOR BILL 27 ===');
  for (const n of names) {
    console.log(
      `typeId: ${n.nameHistoryTypeId} | typeDesc: ${n.nameHistoryTypeDesc} | len: ${n.name?.length} | name: ${n.name}`,
    );
  }

  // 2. Votes for bill 27 with their current stage assignment
  const v = await db
    .select({
      id: votes.id,
      title: votes.title,
      billStage: votes.billStage,
      voteDate: votes.voteDate,
    })
    .from(votes)
    .where(eq(votes.billId, 27))
    .orderBy(votes.voteDate);

  console.log('\n=== VOTES FOR BILL 27 (by date) ===');
  for (const x of v) {
    console.log(
      `stage: ${x.billStage} | ${x.voteDate?.toISOString().slice(0, 10)} | ${x.title}`,
    );
  }

  // 3. Total votes by stage for bill 27
  const stageCounts = await db.execute(sql`
    SELECT bill_stage, count(*) as cnt
    FROM votes WHERE bill_id = 27
    GROUP BY bill_stage ORDER BY bill_stage
  `);
  console.log('\n=== STAGE DISTRIBUTION ===');
  console.log(JSON.stringify(stageCounts));

  // 4. Check the vote sync: what fields do we have?
  const sampleVote = await db
    .select()
    .from(votes)
    .where(eq(votes.billId, 27))
    .limit(1);
  console.log('\n=== VOTE COLUMNS ===');
  console.log(Object.keys(sampleVote[0] ?? {}));

  // 5. Check: how many votes across ALL bills have billStage set vs null
  const globalStages = await db.execute(sql`
    SELECT
      count(*) FILTER (WHERE bill_stage IS NOT NULL) as has_stage,
      count(*) FILTER (WHERE bill_stage IS NULL) as no_stage,
      count(*) FILTER (WHERE bill_id IS NOT NULL) as has_bill
    FROM votes
  `);
  console.log('\n=== GLOBAL STAGE STATS ===');
  console.log(JSON.stringify(globalStages));

  process.exit(0);
}
main();
