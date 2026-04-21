/**
 * Test script: test the bill document pipeline on individual bills at each
 * legislative stage. Finds real bills from the DB that have known documents
 * at each stage, reads their documents, generates summaries, and verifies
 * the per-stage storage works correctly.
 *
 * Usage:
 *   pnpm tsx src/scripts/test-bill-doc-pipeline.ts
 *   pnpm tsx src/scripts/test-bill-doc-pipeline.ts --stage preliminary
 *   pnpm tsx src/scripts/test-bill-doc-pipeline.ts --stage first-reading
 *   pnpm tsx src/scripts/test-bill-doc-pipeline.ts --stage second-third
 *   pnpm tsx src/scripts/test-bill-doc-pipeline.ts --sync-only
 *   pnpm tsx src/scripts/test-bill-doc-pipeline.ts --read-only
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

const args = process.argv.slice(2);
const stageFilter =
  args.find((a) => a.startsWith('--stage='))?.split('=')[1] ??
  (args.includes('--stage') ? args[args.indexOf('--stage') + 1] : null);
const syncOnly = args.includes('--sync-only');
const readOnly = args.includes('--read-only');

async function main() {
  const { db } = await import('../../lib/db');
  const { sql, eq, and, isNull, isNotNull, inArray, count } =
    await import('drizzle-orm');
  const { bills, billDocuments, billStageSummaries } =
    await import('../../lib/db/schema');
  const { BillStage } = await import('../../lib/knesset/bill-stages');

  // ─── Step 0: Ensure tables exist ─────────────────────────────
  console.log('\n🔍 Checking database tables...');
  const tables = await db.execute(
    sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('bill_documents', 'bill_stage_summaries')`,
  );
  const tableRows = Array.isArray(tables)
    ? tables
    : ((tables as any).rows ?? []);
  const existingTables = new Set(tableRows.map((r: any) => r.table_name));

  if (
    !existingTables.has('bill_documents') ||
    !existingTables.has('bill_stage_summaries')
  ) {
    console.log('⚠️  Missing tables. Running migration 0011_bill_documents...');
    const fs = await import('fs');
    const migrationSql = fs.readFileSync(
      'drizzle/0011_bill_documents.sql',
      'utf-8',
    );
    for (const stmt of migrationSql
      .split(';')
      .filter((s: string) => s.trim())) {
      try {
        await db.execute(sql.raw(stmt));
        console.log('  ✓', stmt.trim().slice(0, 80));
      } catch (e: any) {
        if (
          e.message?.includes('already exists') ||
          e.message?.includes('duplicate')
        ) {
          console.log('  ⏩ already applied:', stmt.trim().slice(0, 80));
        } else {
          console.error('  ✗ Migration error:', e.message);
        }
      }
    }
  } else {
    console.log('  ✓ bill_documents table exists');
    console.log('  ✓ bill_stage_summaries table exists');
  }

  // ─── Step 1: Count existing documents ────────────────────────
  const [docCount] = await db.select({ count: count() }).from(billDocuments);
  console.log(`\n📄 Bill documents in DB: ${docCount.count}`);

  // ─── Step 2: Sync documents (if needed or --sync-only) ──────
  if (docCount.count === 0 || syncOnly) {
    console.log('\n🔄 Syncing bill documents from OData v4...');
    const { syncBillDocuments } =
      await import('../../pipeline/jobs/sync-bill-documents');
    await syncBillDocuments();

    const [newCount] = await db.select({ count: count() }).from(billDocuments);
    console.log(`✅ After sync: ${newCount.count} documents`);

    if (syncOnly) {
      // Show type distribution
      const typeStats = await db.execute(
        sql`SELECT group_type_id, group_type_desc, COUNT(*) as cnt 
            FROM bill_documents GROUP BY group_type_id, group_type_desc 
            ORDER BY cnt DESC`,
      );
      const typeRows = Array.isArray(typeStats)
        ? typeStats
        : ((typeStats as any).rows ?? []);
      console.log('\n📊 Document type distribution:');
      for (const row of typeRows) {
        console.log(
          `  Type ${(row as any).group_type_id}: ${(row as any).group_type_desc} — ${(row as any).cnt}`,
        );
      }
      process.exit(0);
    }
  }

  if (readOnly) {
    await testDocumentReading(db, billDocuments);
    process.exit(0);
  }

  // ─── Step 3: Test per-stage document pipeline ────────────────
  console.log('\n🧪 Testing per-stage document pipeline...\n');

  const stageTests: Array<{
    name: string;
    key: string;
    docType: number;
    stage: number;
  }> = [
    {
      name: 'Preliminary (דיון מוקדם)',
      key: 'preliminary',
      docType: 1,
      stage: BillStage.PRELIMINARY,
    },
    {
      name: 'First Reading (קריאה ראשונה)',
      key: 'first-reading',
      docType: 2,
      stage: BillStage.FIRST_READING,
    },
    {
      name: "2nd+3rd Reading (קריאה ב'+ג')",
      key: 'second-third',
      docType: 4,
      stage: BillStage.SECOND_THIRD_READING,
    },
    {
      name: 'Committee (נוסח לוועדה)',
      key: 'committee',
      docType: 60,
      stage: BillStage.COMMITTEE_SECOND,
    },
    {
      name: 'Background (חומר רקע)',
      key: 'background',
      docType: 59,
      stage: BillStage.SUBMITTED,
    },
  ];

  const filteredTests = stageFilter
    ? stageTests.filter((t) => t.key === stageFilter)
    : stageTests;

  if (filteredTests.length === 0) {
    console.error(
      `❌ Unknown stage: "${stageFilter}". Valid: ${stageTests.map((t) => t.key).join(', ')}`,
    );
    process.exit(1);
  }

  const { generateBillSummary } =
    await import('../../lib/ai/legislation/summary-generator');

  for (const test of filteredTests) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(
      `📋 Stage: ${test.name} (DocType ${test.docType} → BillStage ${test.stage})`,
    );
    console.log('═'.repeat(60));

    // Find a bill that has a document of this type
    const docsOfType = await db
      .select({
        docId: billDocuments.id,
        billId: billDocuments.billId,
        knessetBillId: billDocuments.knessetBillId,
        filePath: billDocuments.filePath,
        groupTypeDesc: billDocuments.groupTypeDesc,
        applicationDesc: billDocuments.applicationDesc,
      })
      .from(billDocuments)
      .where(
        and(
          eq(billDocuments.groupTypeId, test.docType),
          isNotNull(billDocuments.billId),
        ),
      )
      .limit(3);

    if (docsOfType.length === 0) {
      console.log(
        `  ⏩ No documents of type ${test.docType} found in DB. Skipping.`,
      );
      continue;
    }

    // Pick the first bill that exists
    const doc = docsOfType[0];
    console.log(`  📄 Document: ${doc.groupTypeDesc} (${doc.applicationDesc})`);
    console.log(`  🔗 URL: ${doc.filePath}`);

    // Get bill info
    const [bill] = await db
      .select({
        id: bills.id,
        knessetId: bills.knessetId,
        name: bills.name,
        knessetNum: bills.knessetNum,
        billType: bills.billType,
        status: bills.status,
        proposedDate: bills.proposedDate,
      })
      .from(bills)
      .where(eq(bills.id, doc.billId!));

    if (!bill) {
      console.log(`  ⏩ Bill ${doc.billId} not found in DB. Skipping.`);
      continue;
    }

    console.log(`  📜 Bill: ${bill.name}`);
    console.log(`  🏛  Knesset: ${bill.knessetNum}, Status: ${bill.status}`);
    console.log(`  🆔 KnessetID: ${bill.knessetId}, Internal ID: ${bill.id}`);

    // Generate summary (includes document reading + web search + AI)
    console.log(`\n  🤖 Generating summary...`);
    const startTime = Date.now();

    try {
      const result = await generateBillSummary({
        id: bill.id,
        knessetId: bill.knessetId,
        name: bill.name,
        knessetNum: bill.knessetNum,
        billType: bill.billType,
        status: bill.status,
        proposedDate: bill.proposedDate,
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(
        `  ⏱  Completed in ${elapsed}s (${result.tokensUsed} tokens)`,
      );

      if (result.summary) {
        console.log(
          `\n  ✅ Summary (he): ${result.summary.he?.slice(0, 200)}...`,
        );
        if (result.topics?.he) {
          console.log(`  🏷  Topics (he): ${result.topics.he.join(', ')}`);
        }
        console.log(
          `  📌 Stage: ${result.stage} (from doc type ${result.sourceDocType})`,
        );
        console.log(`  📄 Source doc ID: ${result.sourceDocId}`);

        // Verify: write stage summary to DB
        const { billStageSummaries: bss } = await import('../../lib/db/schema');
        await db
          .insert(bss)
          .values({
            billId: bill.id,
            stage: result.stage ?? test.stage,
            summary: result.summary,
            topics: result.topics ?? undefined,
            sourceDocType: result.sourceDocType,
            sourceDocId: result.sourceDocId,
          })
          .onConflictDoUpdate({
            target: [bss.billId, bss.stage],
            set: {
              summary: sql`excluded.summary`,
              topics: sql`excluded.topics`,
              sourceDocType: sql`excluded.source_doc_type`,
              sourceDocId: sql`excluded.source_doc_id`,
              generatedAt: new Date(),
            },
          });
        console.log(`  💾 Stage summary saved to bill_stage_summaries`);

        // Verify what's stored
        const stored = await db
          .select()
          .from(bss)
          .where(eq(bss.billId, bill.id));
        console.log(
          `  📊 Total stage summaries for this bill: ${stored.length}`,
        );
        for (const s of stored) {
          console.log(
            `     Stage ${s.stage}: ${(s.summary as any)?.he?.slice(0, 80)}...`,
          );
        }
      } else {
        console.log(`  ⚠️  No summary generated (NO_SUMMARY)`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`  ❌ Error: ${msg}`);
    }
  }

  // ─── Step 4: Summary ──────────────────────────────────────────
  console.log(`\n${'═'.repeat(60)}`);
  console.log('📊 FINAL STATUS');
  console.log('═'.repeat(60));

  const [totalStageSummaries] = await db
    .select({ count: count() })
    .from(billStageSummaries);
  console.log(`Total stage summaries in DB: ${totalStageSummaries.count}`);

  const stageDistrib = await db.execute(
    sql`SELECT stage, COUNT(*) as cnt FROM bill_stage_summaries GROUP BY stage ORDER BY stage`,
  );
  const stageRows = Array.isArray(stageDistrib)
    ? stageDistrib
    : ((stageDistrib as any).rows ?? []);
  const stageNames: Record<number, string> = {
    0: 'SUBMITTED',
    1: 'PRELIMINARY',
    2: 'COMMITTEE_FIRST',
    3: 'FIRST_READING',
    4: 'COMMITTEE_SECOND',
    5: 'SECOND_THIRD_READING',
    6: 'PASSED',
  };
  for (const row of stageRows) {
    const r = row as any;
    console.log(
      `  Stage ${r.stage} (${stageNames[r.stage] ?? '?'}): ${r.cnt} summaries`,
    );
  }

  process.exit(0);
}

/**
 * Test document reading only (no AI generation).
 * Tries reading one document of each type.
 */
async function testDocumentReading(db: any, billDocuments: any) {
  const { readDocument } =
    await import('../../lib/ai/legislation/document-reader');
  const { eq, and, isNotNull } = await import('drizzle-orm');

  console.log('\n📖 Testing document reading (no AI summary)...\n');

  const docTypes = [
    { id: 1, name: 'דיון מוקדם (DOC)' },
    { id: 2, name: 'קריאה ראשונה (PDF)' },
    { id: 4, name: "קריאה ב'+ג' (PDF)" },
    { id: 59, name: 'חומר רקע (PDF)' },
  ];

  for (const dt of docTypes) {
    console.log(`\n  Type ${dt.id}: ${dt.name}`);

    const [doc] = await db
      .select()
      .from(billDocuments)
      .where(
        and(
          eq(billDocuments.groupTypeId, dt.id),
          isNotNull(billDocuments.billId),
        ),
      )
      .limit(1);

    if (!doc) {
      console.log('    ⏩ No documents found');
      continue;
    }

    console.log(`    URL: ${doc.filePath}`);
    const startTime = Date.now();

    try {
      const text = await readDocument(doc);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      if (text) {
        console.log(`    ✅ Read ${text.length} chars in ${elapsed}s`);
        console.log(
          `    Preview: ${text.slice(0, 200).replace(/\n/g, ' ')}...`,
        );
      } else {
        console.log(`    ⚠️  No text extracted (${elapsed}s)`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`    ❌ Error: ${msg}`);
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
