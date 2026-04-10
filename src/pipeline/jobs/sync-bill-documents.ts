import { sql, eq } from 'drizzle-orm';
import { db } from '../../lib/db';
import { bills, billDocuments } from '../../lib/db/schema';
import { fetchV4DocumentBills } from '../../lib/knesset/knesset-api-client';
import { runSyncJob, getLastSyncTime, type SyncCheckpoint } from '../utils';

const BATCH_SIZE = 200;

/**
 * Normalize FilePath from OData (backslash → forward slash).
 * OData v4 returns full URLs like "https://fs.knesset.gov.il/25/law/..."
 * or relative paths like "\25\law\...". Handle both.
 */
function normalizeFilePath(raw: string): string {
  const cleaned = raw.replace(/\\/g, '/').replace(/^\//, '');
  if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
    return cleaned;
  }
  return `https://fs.knesset.gov.il/${cleaned}`;
}

/**
 * Sync bill documents from OData v4 KNS_DocumentBill.
 * Links documents to our bills table via KnessetBillId → bills.knessetId.
 */
export async function syncBillDocuments(): Promise<void> {
  await runSyncJob('bill-documents', async (prevCheckpoint) => {
    const lastSync = await getLastSyncTime('bill-documents');

    console.log(
      `[sync-bill-documents] Fetching from OData v4${lastSync ? ` (since ${lastSync.toISOString()})` : ' (full)'}...`,
    );

    const rawDocs = await fetchV4DocumentBills(lastSync ?? undefined);
    console.log(`[sync-bill-documents] Got ${rawDocs.length} documents`);

    if (rawDocs.length === 0) {
      return { count: 0, checkpoint: prevCheckpoint ?? {} };
    }

    // Build a lookup of knessetBillId → our bills.id for FK linking
    const knessetBillIds = [...new Set(rawDocs.map((d) => d.BillID))];
    const billLookup = new Map<number, number>();

    // Fetch in batches to avoid SQL parameter limits
    for (let i = 0; i < knessetBillIds.length; i += 500) {
      const batch = knessetBillIds.slice(i, i + 500);
      const rows = await db
        .select({ id: bills.id, knessetId: bills.knessetId })
        .from(bills)
        .where(
          sql`${bills.knessetId} IN (${sql.join(
            batch.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        );
      for (const row of rows) {
        billLookup.set(row.knessetId, row.id);
      }
    }

    console.log(
      `[sync-bill-documents] Matched ${billLookup.size}/${knessetBillIds.length} bills in DB`,
    );

    // Upsert documents in batches
    let upserted = 0;
    for (let i = 0; i < rawDocs.length; i += BATCH_SIZE) {
      const batch = rawDocs.slice(i, i + BATCH_SIZE);
      const values = batch.map((doc) => ({
        knessetDocId: doc.Id,
        billId: billLookup.get(doc.BillID) ?? null,
        knessetBillId: doc.BillID,
        groupTypeId: doc.GroupTypeID,
        groupTypeDesc: doc.GroupTypeDesc ?? '',
        applicationDesc: doc.ApplicationDesc ?? '',
        filePath: normalizeFilePath(doc.FilePath),
        lastUpdated: doc.LastUpdatedDate ? new Date(doc.LastUpdatedDate) : null,
      }));

      await db
        .insert(billDocuments)
        .values(values)
        .onConflictDoUpdate({
          target: billDocuments.knessetDocId,
          set: {
            billId: sql`excluded.bill_id`,
            groupTypeId: sql`excluded.group_type_id`,
            groupTypeDesc: sql`excluded.group_type_desc`,
            applicationDesc: sql`excluded.application_desc`,
            filePath: sql`excluded.file_path`,
            lastUpdated: sql`excluded.last_updated`,
          },
        });

      upserted += batch.length;
    }

    // Track max timestamp for incremental sync
    const maxTimestamp = rawDocs
      .filter((d) => d.LastUpdatedDate)
      .reduce((max, d) => {
        const t = new Date(d.LastUpdatedDate!).getTime();
        return t > max ? t : max;
      }, 0);

    const checkpoint: SyncCheckpoint = {
      lastItemTimestamp: maxTimestamp
        ? new Date(maxTimestamp).toISOString()
        : prevCheckpoint?.lastItemTimestamp,
    };

    console.log(`[sync-bill-documents] Upserted ${upserted} documents`);

    return { count: upserted, checkpoint };
  });
}
