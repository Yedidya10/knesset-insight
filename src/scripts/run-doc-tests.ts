/**
 * Quick targeted test: fetch a small number of documents per type from
 * OData v4, insert them, test reading + AI summary generation.
 * Much faster than --sync-only which fetches all 15K+ documents.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

const args = process.argv.slice(2);
const stageFilter =
  args.find((a) => a.startsWith('--stage='))?.split('=')[1] ??
  (args.includes('--stage') ? args[args.indexOf('--stage') + 1] : null);
const readOnly = args.includes('--read-only');

interface TestResult {
  stage: string;
  docType: number;
  billName: string;
  billId: number;
  knessetBillId: number;
  docUrl: string;
  readMethod: string;
  charsExtracted: number;
  textPreview: string;
  summaryHe?: string;
  summaryEn?: string;
  topicsHe?: string[];
  topicsEn?: string[];
  tokensUsed?: number;
  elapsedSec: number;
  resultStage?: number;
  sourceDocType?: number;
  success: boolean;
  error?: string;
}

async function main() {
  const { db } = await import('../lib/db');
  const { sql, eq, and, isNotNull, count } = await import('drizzle-orm');
  const { bills, billDocuments, billStageSummaries } =
    await import('../lib/db/schema');
  const { appConfig } = await import('../../app.config');

  const results: TestResult[] = [];

  // ─── Ensure tables exist ─────────────────────────────
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
    console.log('⚠️  Missing tables. Running migration 0011...');
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
          console.log('  ⏩ already applied');
        } else {
          console.error('  ✗', e.message);
        }
      }
    }
  } else {
    console.log('  ✓ Tables exist');
  }

  // ─── Check doc count ─────────────────────────────────
  const [docCount] = await db.select({ count: count() }).from(billDocuments);
  console.log(`📄 Bill documents in DB: ${docCount.count}`);

  // ─── Quick sync: fetch a few docs per type ────────────
  const targetTypes = [
    { id: 1, name: 'דיון מוקדם', ext: 'doc' },
    { id: 2, name: 'קריאה ראשונה', ext: 'pdf' },
    { id: 4, name: 'קריאה שנייה ושלישית', ext: 'pdf' },
    { id: 59, name: 'חומר רקע', ext: 'pdf' },
    { id: 60, name: 'נוסח לוועדה', ext: 'pdf' },
  ];

  const ODATA_V4_BASE = appConfig.dataSources.knessetOdataV4;

  for (const dt of targetTypes) {
    // Check if we already have docs of this type
    const [existing] = await db
      .select({ count: count() })
      .from(billDocuments)
      .where(eq(billDocuments.groupTypeId, dt.id));

    if (existing.count > 0) {
      console.log(
        `  ✅ Type ${dt.id} (${dt.name}): ${existing.count} docs already in DB`,
      );
      continue;
    }

    console.log(`  🔄 Fetching type ${dt.id} (${dt.name}) from OData v4...`);
    const filterParts = [`GroupTypeID eq ${dt.id}`];
    const params = new Map([
      [
        '$select',
        'Id,BillID,GroupTypeID,GroupTypeDesc,ApplicationDesc,FilePath,LastUpdatedDate',
      ],
      ['$filter', filterParts.join(' and ')],
      ['$orderby', 'LastUpdatedDate desc'],
      ['$top', '10'],
      ['$format', 'json'],
    ]);
    const qs = [...params]
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
    const url = `${ODATA_V4_BASE}/KNS_DocumentBill?${qs}`;

    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const docs = data.value ?? [];
      console.log(`    Got ${docs.length} documents`);

      if (docs.length === 0) continue;

      // Lookup bill IDs
      const knessetBillIds = [
        ...new Set(docs.map((d: any) => d.BillID)),
      ] as number[];
      const billRows = await db
        .select({ id: bills.id, knessetId: bills.knessetId })
        .from(bills)
        .where(
          sql`${bills.knessetId} IN (${sql.join(
            knessetBillIds.map((id: number) => sql`${id}`),
            sql`, `,
          )})`,
        );
      const billLookup = new Map(billRows.map((r) => [r.knessetId, r.id]));

      // Upsert
      for (const doc of docs) {
        const raw = doc.FilePath;
        if (!raw) continue;
        const cleaned = raw.replace(/\\/g, '/').replace(/^\//, '');
        const filePath =
          cleaned.startsWith('http://') || cleaned.startsWith('https://')
            ? cleaned
            : `https://fs.knesset.gov.il/${cleaned}`;

        await db
          .insert(billDocuments)
          .values({
            knessetDocId: doc.Id,
            billId: billLookup.get(doc.BillID) ?? null,
            knessetBillId: doc.BillID,
            groupTypeId: doc.GroupTypeID,
            groupTypeDesc: doc.GroupTypeDesc ?? '',
            applicationDesc: doc.ApplicationDesc ?? '',
            filePath,
            lastUpdated: doc.LastUpdatedDate
              ? new Date(doc.LastUpdatedDate)
              : null,
          })
          .onConflictDoNothing();
      }

      const [newCount] = await db
        .select({ count: count() })
        .from(billDocuments)
        .where(eq(billDocuments.groupTypeId, dt.id));
      console.log(`    Inserted: ${newCount.count} docs`);
    } catch (err: any) {
      console.error(`    ❌ Error fetching type ${dt.id}: ${err.message}`);
    }
  }

  // ─── Show type distribution ───────────────────────────
  const [totalDocs] = await db.select({ count: count() }).from(billDocuments);
  console.log(`\n📊 Total docs in DB: ${totalDocs.count}`);
  const typeStats = await db.execute(
    sql`SELECT group_type_id, group_type_desc, COUNT(*) as cnt FROM bill_documents GROUP BY group_type_id, group_type_desc ORDER BY cnt DESC`,
  );
  const typeRows = Array.isArray(typeStats)
    ? typeStats
    : ((typeStats as any).rows ?? []);
  for (const row of typeRows) {
    console.log(
      `  Type ${(row as any).group_type_id}: ${(row as any).group_type_desc} — ${(row as any).cnt}`,
    );
  }

  // ─── Read-only test ───────────────────────────────────
  if (readOnly) {
    console.log('\n📖 Testing document reading (no AI)...\n');
    const { readDocument } =
      await import('../lib/ai/legislation/document-reader');

    for (const dt of targetTypes) {
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
        const elapsed = (Date.now() - startTime) / 1000;
        if (text) {
          console.log(
            `    ✅ Read ${text.length} chars in ${elapsed.toFixed(1)}s`,
          );
          console.log(
            `    Preview: ${text.slice(0, 200).replace(/\n/g, ' ')}...`,
          );
          results.push({
            stage: dt.name,
            docType: dt.id,
            billName: '',
            billId: doc.billId!,
            knessetBillId: doc.knessetBillId,
            docUrl: doc.filePath!,
            readMethod: dt.ext === 'doc' ? 'officeparser' : 'unpdf',
            charsExtracted: text.length,
            textPreview: text.slice(0, 300).replace(/\n/g, ' '),
            elapsedSec: elapsed,
            success: true,
          });
        } else {
          console.log(`    ⚠️ No text extracted (${elapsed.toFixed(1)}s)`);
          results.push({
            stage: dt.name,
            docType: dt.id,
            billName: '',
            billId: doc.billId!,
            knessetBillId: doc.knessetBillId,
            docUrl: doc.filePath!,
            readMethod: dt.ext === 'doc' ? 'officeparser' : 'unpdf',
            charsExtracted: 0,
            textPreview: 'N/A',
            elapsedSec: elapsed,
            success: false,
            error: 'No text extracted',
          });
        }
      } catch (error: any) {
        console.error(`    ❌ Error: ${error.message}`);
        results.push({
          stage: dt.name,
          docType: dt.id,
          billName: '',
          billId: doc.billId!,
          knessetBillId: doc.knessetBillId,
          docUrl: doc.filePath!,
          readMethod: dt.ext === 'doc' ? 'officeparser' : 'unpdf',
          charsExtracted: 0,
          textPreview: 'N/A',
          elapsedSec: 0,
          success: false,
          error: error.message,
        });
      }
    }

    writeResultsMd(results);
    process.exit(0);
  }

  // ─── Stage tests ──────────────────────────────────────
  const { BillStage } = await import('../lib/knesset/bill-stages');
  const { generateBillSummary } =
    await import('../lib/ai/legislation/summary-generator');

  const stageTests = [
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

  for (const test of filteredTests) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(
      `📋 Stage: ${test.name} (DocType ${test.docType} → BillStage ${test.stage})`,
    );
    console.log('═'.repeat(60));

    // Find a bill with this doc type
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
      console.log(`  ⏩ No docs of type ${test.docType}. Skipping.`);
      results.push({
        stage: test.name,
        docType: test.docType,
        billName: 'N/A',
        billId: 0,
        knessetBillId: 0,
        docUrl: '',
        readMethod: '',
        charsExtracted: 0,
        textPreview: '',
        elapsedSec: 0,
        success: false,
        error: 'No documents found',
      });
      continue;
    }

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
      console.log(`  ⏩ Bill ${doc.billId} not found`);
      continue;
    }

    console.log(`  📜 Bill: ${bill.name}`);
    console.log(`  🏛  Knesset: ${bill.knessetNum}, Status: ${bill.status}`);

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

      const elapsed = (Date.now() - startTime) / 1000;
      console.log(
        `  ⏱  Completed in ${elapsed.toFixed(1)}s (${result.tokensUsed} tokens)`,
      );

      if (result.summary) {
        console.log(
          `\n  ✅ Summary (he): ${result.summary.he?.slice(0, 200)}...`,
        );
        console.log(
          `  ✅ Summary (en): ${result.summary.en?.slice(0, 200)}...`,
        );
        if (result.topics?.he)
          console.log(`  🏷  Topics (he): ${result.topics.he.join(', ')}`);
        if (result.topics?.en)
          console.log(`  🏷  Topics (en): ${result.topics.en.join(', ')}`);
        console.log(
          `  📌 Stage: ${result.stage} (from doc type ${result.sourceDocType})`,
        );

        // Write to bill_stage_summaries
        await db
          .insert(billStageSummaries)
          .values({
            billId: bill.id,
            stage: result.stage ?? test.stage,
            summary: result.summary,
            topics: result.topics ?? undefined,
            sourceDocType: result.sourceDocType,
            sourceDocId: result.sourceDocId,
          })
          .onConflictDoUpdate({
            target: [billStageSummaries.billId, billStageSummaries.stage],
            set: {
              summary: sql`excluded.summary`,
              topics: sql`excluded.topics`,
              sourceDocType: sql`excluded.source_doc_type`,
              sourceDocId: sql`excluded.source_doc_id`,
              generatedAt: new Date(),
            },
          });
        console.log(`  💾 Stage summary saved`);

        results.push({
          stage: test.name,
          docType: test.docType,
          billName: bill.name,
          billId: bill.id,
          knessetBillId: bill.knessetId,
          docUrl: doc.filePath!,
          readMethod: test.docType === 1 ? 'officeparser' : 'unpdf',
          charsExtracted: 0, // will be filled by document reader stats
          textPreview: '',
          summaryHe: result.summary.he?.slice(0, 500),
          summaryEn: result.summary.en?.slice(0, 500),
          topicsHe: result.topics?.he,
          topicsEn: result.topics?.en,
          tokensUsed: result.tokensUsed,
          elapsedSec: elapsed,
          resultStage: result.stage,
          sourceDocType: result.sourceDocType,
          success: true,
        });
      } else {
        console.log(`  ⚠️ No summary generated`);
        results.push({
          stage: test.name,
          docType: test.docType,
          billName: bill.name,
          billId: bill.id,
          knessetBillId: bill.knessetId,
          docUrl: doc.filePath!,
          readMethod: '',
          charsExtracted: 0,
          textPreview: '',
          elapsedSec: (Date.now() - startTime) / 1000,
          success: false,
          error: 'No summary generated',
        });
      }
    } catch (error: any) {
      console.error(`  ❌ Error: ${error.message}`);
      results.push({
        stage: test.name,
        docType: test.docType,
        billName: bill.name,
        billId: bill.id,
        knessetBillId: bill.knessetId,
        docUrl: doc.filePath!,
        readMethod: '',
        charsExtracted: 0,
        textPreview: '',
        elapsedSec: (Date.now() - startTime) / 1000,
        success: false,
        error: error.message.slice(0, 300),
      });
    }
  }

  // ─── Final status ──────────────────────────────────────
  console.log(`\n${'═'.repeat(60)}`);
  console.log('📊 FINAL STATUS');
  console.log('═'.repeat(60));

  const [totalStageSummaries] = await db
    .select({ count: count() })
    .from(billStageSummaries);
  console.log(`Total stage summaries: ${totalStageSummaries.count}`);

  writeResultsMd(results);
  process.exit(0);
}

function writeResultsMd(results: TestResult[]) {
  const fs = require('fs');
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');

  let md = `# Bill Document Pipeline — Test Results\n\n`;
  md += `**Date**: ${now}\n\n`;
  md += `## Summary\n\n`;
  md += `| # | Stage | DocType | Bill Name | Success | Tokens | Time (s) |\n`;
  md += `|---|-------|---------|-----------|---------|--------|----------|\n`;

  results.forEach((r, i) => {
    md += `| ${i + 1} | ${r.stage} | ${r.docType} | ${r.billName?.slice(0, 40) || '—'} | ${r.success ? '✅' : '❌'} | ${r.tokensUsed ?? '—'} | ${r.elapsedSec.toFixed(1)} |\n`;
  });

  md += `\n## Detailed Results\n\n`;

  for (const r of results) {
    md += `### ${r.stage}\n\n`;
    md += `- **Bill**: ${r.billName || '—'} (ID: ${r.billId}, Knesset Bill ID: ${r.knessetBillId})\n`;
    md += `- **Document URL**: ${r.docUrl || '—'}\n`;
    md += `- **Read Method**: ${r.readMethod || '—'}\n`;
    md += `- **Chars Extracted**: ${r.charsExtracted || '—'}\n`;
    md += `- **Success**: ${r.success ? '✅' : '❌'}\n`;

    if (r.error) {
      md += `- **Error**: ${r.error}\n`;
    }

    if (r.summaryHe) {
      md += `\n#### Hebrew Summary\n\n> ${r.summaryHe.replace(/\n/g, '\n> ')}\n`;
    }
    if (r.summaryEn) {
      md += `\n#### English Summary\n\n> ${r.summaryEn.replace(/\n/g, '\n> ')}\n`;
    }
    if (r.topicsHe?.length) {
      md += `\n#### Topics (Hebrew)\n\n${r.topicsHe.map((t) => `- ${t}`).join('\n')}\n`;
    }
    if (r.topicsEn?.length) {
      md += `\n#### Topics (English)\n\n${r.topicsEn.map((t) => `- ${t}`).join('\n')}\n`;
    }

    md += `\n- **Tokens Used**: ${r.tokensUsed ?? '—'}\n`;
    md += `- **Elapsed**: ${r.elapsedSec.toFixed(1)}s\n`;
    md += `- **Stage Detected**: ${r.resultStage ?? '—'}\n`;
    md += `- **Source Doc Type**: ${r.sourceDocType ?? '—'}\n`;
    md += `\n---\n\n`;
  }

  // Comparison section
  if (results.filter((r) => r.success).length > 1) {
    md += `## Comparison\n\n`;
    md += `### Performance\n\n`;
    md += `| Stage | Tokens | Time (s) | Method |\n`;
    md += `|-------|--------|----------|--------|\n`;
    for (const r of results.filter((r) => r.success)) {
      md += `| ${r.stage} | ${r.tokensUsed ?? '—'} | ${r.elapsedSec.toFixed(1)} | ${r.readMethod} |\n`;
    }

    md += `\n### Topic Coverage\n\n`;
    for (const r of results.filter((r) => r.topicsHe?.length)) {
      md += `**${r.stage}**: ${r.topicsHe!.join(', ')}\n\n`;
    }
  }

  const outPath = 'docs/test-results-bill-documents.md';
  fs.writeFileSync(outPath, md, 'utf-8');
  console.log(`\n📝 Results written to ${outPath}`);
}

main();
