import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { db } = await import('../../lib/db');
  const { sql, eq } = await import('drizzle-orm');
  const { bills } = await import('../../lib/db/schema');

  // Find bad summaries from old Anthropic web search runs
  const bad = await db
    .select({ id: bills.id, knessetId: bills.knessetId })
    .from(bills)
    .where(
      sql`ai_summary IS NOT NULL AND (
        (ai_summary->>'he') LIKE 'Based on%' 
        OR (ai_summary->>'he') LIKE 'I''ll search%'
        OR (ai_summary->>'he') LIKE 'I will search%'
      )`,
    );

  console.log(`Found ${bad.length} bad summaries to reset`);
  for (const b of bad) {
    await db
      .update(bills)
      .set({ aiSummary: null, aiTopics: null })
      .where(eq(bills.id, b.id));
    console.log(`  Reset bill ${b.knessetId}`);
  }

  process.exit(0);
}
main();
