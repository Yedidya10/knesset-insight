import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { db } = await import('../lib/db/index.ts');
  const { votes } = await import('../lib/db/schema.ts');
  const { sql } = await import('drizzle-orm');

  // Fix misclassified votes: "כהצעת הוועדה" and "הסתייגות" are always 2nd+3rd reading
  const SECOND_THIRD_READING = 5;

  const result = await db.execute<{ id: number }>(sql`
    UPDATE votes
    SET bill_stage = ${SECOND_THIRD_READING}::int
    WHERE bill_id IS NOT NULL
      AND bill_stage IS DISTINCT FROM ${SECOND_THIRD_READING}::int
      AND title ~* 'כהצעת הוועדה|הסתייגות|הסתייגויות'
    RETURNING id
  `);

  console.log(`Fixed ${result.length} misclassified votes`);

  // Show sample of fixed votes
  if (result.length > 0) {
    const fixedIds = result.slice(0, 5).map((r) => r.id);
    const { inArray } = await import('drizzle-orm');
    const samples = await db
      .select({ id: votes.id, title: votes.title, billStage: votes.billStage })
      .from(votes)
      .where(inArray(votes.id, fixedIds));
    for (const s of samples) {
      console.log(
        `  id=${s.id} stage=${s.billStage} title=${s.title?.substring(0, 80)}`,
      );
    }
  }

  process.exit(0);
}
main();
