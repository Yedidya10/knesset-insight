import { sql } from 'drizzle-orm';
import { db } from '../../lib/db';
import { bills, billSplits } from '../../lib/db/schema';
import { fetchAllOData, fetchODataSince } from '../../lib/knesset/odata-client';
import { getLastSyncTime, runSyncJob, type SyncCheckpoint } from '../utils';

const BATCH_SIZE = 500;

interface ODataBillSplit {
  BillSplitID: number;
  MainBillID: number;
  SplitBillID: number;
  Name: string;
  LastUpdatedDate: string;
}

async function syncBillSplitRecords(
  prevCheckpoint: SyncCheckpoint | null,
): Promise<{ count: number; checkpoint: SyncCheckpoint }> {
  const checkpointDate = prevCheckpoint?.lastItemTimestamp
    ? new Date(prevCheckpoint.lastItemTimestamp as string)
    : null;
  const lastSync = checkpointDate ?? (await getLastSyncTime('bill_splits'));

  let rawSplits: ODataBillSplit[];
  if (lastSync) {
    rawSplits = await fetchODataSince<ODataBillSplit>(
      'ParliamentInfo',
      'KNS_BillSplit',
      lastSync,
      'LastUpdatedDate',
    );
  } else {
    rawSplits = await fetchAllOData<ODataBillSplit>(
      'ParliamentInfo',
      'KNS_BillSplit',
      { $orderby: 'LastUpdatedDate desc' },
      100,
      'bill_splits',
    );
  }

  console.log(`  [bill_splits] Fetched ${rawSplits.length} split records`);

  const allBills = await db
    .select({ id: bills.id, knessetId: bills.knessetId })
    .from(bills);
  const billMap = new Map(allBills.map((b) => [b.knessetId, b.id]));

  let maxLastUpdated = prevCheckpoint?.lastItemTimestamp as string | undefined;
  let unmapped = 0;

  const rows = rawSplits
    .map((raw) => {
      if (raw.LastUpdatedDate && (!maxLastUpdated || raw.LastUpdatedDate > maxLastUpdated)) {
        maxLastUpdated = raw.LastUpdatedDate;
      }
      const mainBillId = billMap.get(raw.MainBillID);
      const splitBillId = billMap.get(raw.SplitBillID);
      if (!mainBillId || !splitBillId) {
        unmapped++;
        return null;
      }
      return {
        knessetId: raw.BillSplitID,
        mainBillId,
        splitBillId,
        name: raw.Name || null,
        lastUpdated: raw.LastUpdatedDate ? new Date(raw.LastUpdatedDate) : null,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (unmapped > 0) {
    console.log(`  [bill_splits] ${unmapped} records skipped (bill not in DB)`);
  }

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await db
      .insert(billSplits)
      .values(batch)
      .onConflictDoUpdate({
        target: billSplits.knessetId,
        set: {
          mainBillId: sql`excluded.main_bill_id`,
          splitBillId: sql`excluded.split_bill_id`,
          name: sql`excluded.name`,
          lastUpdated: sql`excluded.last_updated`,
        },
      });
  }

  const checkpoint: SyncCheckpoint = {
    lastItemTimestamp: maxLastUpdated,
  };

  return { count: rows.length, checkpoint };
}

export async function syncBillSplits(): Promise<void> {
  await runSyncJob('bill_splits', syncBillSplitRecords);
}
