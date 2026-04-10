/**
 * Targeted test: sync + summarize bill 2222852
 * (הצעת חוק העמדה לדין של משתתפי אירועי טבח 7 באוקטובר)
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { db } = await import('../lib/db');
  const { bills, billDocuments, billStageSummaries } =
    await import('../lib/db/schema');
  const { eq, sql, count } = await import('drizzle-orm');
  const { appConfig } = await import('../../app.config');

  const KNESSET_BILL_ID = 2222852;

  // 1. Find the bill
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
    .where(eq(bills.knessetId, KNESSET_BILL_ID));

  if (!bill) {
    console.error(`❌ Bill ${KNESSET_BILL_ID} not found in DB`);
    process.exit(1);
  }
  console.log(`\n📜 Bill: ${bill.name}`);
  console.log(`   ID: ${bill.id}, KnessetID: ${bill.knessetId}`);
  console.log(`   Knesset: ${bill.knessetNum}, Status: ${bill.status}\n`);

  // 2. Check existing docs
  let docs = await db
    .select({
      id: billDocuments.id,
      groupTypeId: billDocuments.groupTypeId,
      groupTypeDesc: billDocuments.groupTypeDesc,
      filePath: billDocuments.filePath,
    })
    .from(billDocuments)
    .where(eq(billDocuments.billId, bill.id));

  console.log(`📄 Existing docs for this bill: ${docs.length}`);
  for (const d of docs)
    console.log(
      `   Type ${d.groupTypeId} — ${d.groupTypeDesc} — ${d.filePath.slice(0, 80)}`,
    );

  // 3. If no docs (or only background), sync from OData v4
  const hasOfficialDocs = docs.some((d) =>
    [1, 2, 3, 4, 17, 60].includes(d.groupTypeId),
  );
  if (!hasOfficialDocs) {
    console.log(
      `\n🔄 Syncing documents for bill ${KNESSET_BILL_ID} from OData v4...`,
    );

    // Use a targeted OData v4 query filtering by BillID
    const ODATA_V4_BASE = appConfig.dataSources.knessetOdataV4;
    const qs = [
      `$filter=BillID eq ${KNESSET_BILL_ID}`,
      `$select=Id,BillID,GroupTypeID,GroupTypeDesc,ApplicationDesc,FilePath,LastUpdatedDate`,
      `$format=json`,
    ].join('&');
    const url = `${ODATA_V4_BASE}/KNS_DocumentBill?${qs}`;
    console.log(`   URL: ${url}`);

    const resp = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      console.error(
        `❌ OData fetch failed: ${resp.status} — ${body.slice(0, 200)}`,
      );
      process.exit(1);
    }
    const data = (await resp.json()) as { value: any[] };
    const billDocs = data.value;
    console.log(`   Fetched ${billDocs.length} documents`);

    for (const d of billDocs) {
      const rawPath = (d.FilePath ?? '').replace(/\\/g, '/').replace(/^\//, '');
      const filePath = rawPath.startsWith('http')
        ? rawPath
        : `https://fs.knesset.gov.il/${rawPath}`;
      console.log(
        `   📎 Type ${d.GroupTypeID} — ${d.GroupTypeDesc} — ${d.ApplicationDesc} — ${filePath.slice(0, 80)}`,
      );

      await db
        .insert(billDocuments)
        .values({
          knessetDocId: d.Id,
          billId: bill.id,
          knessetBillId: KNESSET_BILL_ID,
          groupTypeId: d.GroupTypeID,
          groupTypeDesc: d.GroupTypeDesc ?? '',
          applicationTypeId: null,
          applicationDesc: d.ApplicationDesc ?? '',
          filePath,
          lastUpdated: d.LastUpdatedDate ? new Date(d.LastUpdatedDate) : null,
        })
        .onConflictDoNothing();
    }

    // Refresh docs list
    docs = await db
      .select({
        id: billDocuments.id,
        groupTypeId: billDocuments.groupTypeId,
        groupTypeDesc: billDocuments.groupTypeDesc,
        filePath: billDocuments.filePath,
      })
      .from(billDocuments)
      .where(eq(billDocuments.billId, bill.id));
    console.log(`\n📄 Docs after sync: ${docs.length}`);
    for (const d of docs)
      console.log(
        `   Type ${d.groupTypeId} — ${d.groupTypeDesc} — ${d.filePath.slice(0, 80)}`,
      );
  }

  // 4. Generate summary
  console.log(`\n🤖 Generating summary...`);
  const { generateBillSummary } =
    await import('../lib/ai/legislation/summary-generator');

  const startTime = Date.now();
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

  console.log(`\n${'═'.repeat(60)}`);
  console.log(
    `⏱  Completed in ${elapsed.toFixed(1)}s (${result.tokensUsed} tokens)`,
  );
  console.log(
    `📌 Stage: ${result.stage} (from doc type ${result.sourceDocType})`,
  );

  if (result.summary) {
    console.log(`\n✅ Summary (he):\n${result.summary.he}`);
    console.log(`\n✅ Summary (en):\n${result.summary.en}`);
    if (result.topics?.he)
      console.log(`\n🏷  Topics (he): ${result.topics.he.join(', ')}`);
    if (result.topics?.en)
      console.log(`🏷  Topics (en): ${result.topics.en.join(', ')}`);

    // Save stage summary
    await db
      .insert(billStageSummaries)
      .values({
        billId: bill.id,
        stage: result.stage ?? 0,
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
    console.log(`💾 Stage summary saved`);
  } else {
    console.log(`\n❌ NO_SUMMARY — AI could not generate a summary`);
  }

  process.exit(0);
}
main();
