/**
 * Test script: generate AI summaries for a batch of bills.
 * Usage: BILL_SUMMARY_BATCH_SIZE=5 pnpm tsx src/scripts/test-bill-summaries.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { db } = await import('../lib/db');
  const { sql, count, isNull, and, inArray } = await import('drizzle-orm');
  const { bills } = await import('../lib/db/schema');

  // 1. Check DB schema
  const cols = await db.execute(
    sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'bills' AND column_name IN ('ai_summary', 'ai_topics') ORDER BY column_name`,
  );
  const colRows = Array.isArray(cols) ? cols : ((cols as any).rows ?? []);
  console.log('DB columns:', colRows);

  // If migration hasn't been applied, run it
  if (
    colRows.length === 0 ||
    !colRows.find((r: any) => r.column_name === 'ai_topics')
  ) {
    console.log('Running migration 0010...');
    const fs = await import('fs');
    const migrationSql = fs.readFileSync(
      'drizzle/0010_bill_ai_topics.sql',
      'utf-8',
    );
    for (const stmt of migrationSql
      .split(';')
      .filter((s: string) => s.trim())) {
      try {
        await db.execute(sql.raw(stmt));
        console.log('  ✓', stmt.trim().slice(0, 60));
      } catch (e: any) {
        // Column may already exist
        if (
          e.message?.includes('already exists') ||
          e.message?.includes('duplicate')
        ) {
          console.log('  ⏩ already applied:', stmt.trim().slice(0, 60));
        } else {
          console.error('  ✗ Migration error:', e.message);
        }
      }
    }
  }

  // 2. Count candidates
  const [total] = await db.select({ count: count() }).from(bills);
  console.log(`\nTotal bills in DB: ${total.count}`);

  const [noSummary] = await db
    .select({ count: count() })
    .from(bills)
    .where(
      and(
        isNull(bills.summary),
        inArray(bills.knessetNum, [25, 24, 23]),
        isNull(bills.aiSummary),
      ),
    );
  console.log(`Bills needing AI summary (K23-25): ${noSummary.count}`);

  // 3. Run the pipeline
  console.log('\n--- Running generate-bill-summaries pipeline ---\n');
  const { generateBillSummaries } =
    await import('../pipeline/jobs/generate-bill-summaries');
  await generateBillSummaries();

  // 4. Show results
  const [generated] = await db
    .select({ count: count() })
    .from(bills)
    .where(sql`${bills.aiSummary} IS NOT NULL`);
  console.log(`\nBills with AI summary after run: ${generated.count}`);

  // Show a sample
  const samples = await db
    .select({
      knessetId: bills.knessetId,
      name: bills.name,
      aiSummary: bills.aiSummary,
      aiTopics: bills.aiTopics,
    })
    .from(bills)
    .where(sql`${bills.aiSummary} IS NOT NULL`)
    .limit(3);

  for (const s of samples) {
    console.log(`\n--- Bill ${s.knessetId}: ${s.name} ---`);
    const summary = s.aiSummary as Record<string, string> | null;
    const topics = s.aiTopics as Record<string, string[]> | null;
    if (summary) {
      console.log('  HE:', summary.he?.slice(0, 120));
      console.log('  EN:', summary.en?.slice(0, 120));
    }
    if (topics) {
      console.log('  Topics (HE):', topics.he?.join(', '));
      console.log('  Topics (EN):', topics.en?.join(', '));
    }
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
