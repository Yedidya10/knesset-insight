import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { db } = await import('../lib/db');
  const { votes } = await import('../lib/db/schema');
  const { eq, desc } = await import('drizzle-orm');

  const billId = Number(process.argv[2] || 2126);
  console.log(`Votes for bill ${billId}:\n`);

  const rows = await db
    .select({
      id: votes.id,
      title: votes.title,
      billStage: votes.billStage,
      isAccepted: votes.isAccepted,
      forCount: votes.forCount,
      againstCount: votes.againstCount,
      voteDate: votes.voteDate,
    })
    .from(votes)
    .where(eq(votes.billId, billId))
    .orderBy(desc(votes.billStage), desc(votes.voteDate));

  for (const r of rows) {
    console.log(
      `[stage=${r.billStage}] ${r.isAccepted ? 'V' : 'X'} f=${r.forCount} a=${r.againstCount} | ${r.title.substring(0, 100)}`,
    );
  }
  console.log(`\nTotal: ${rows.length} votes`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
