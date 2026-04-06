import { sql } from 'drizzle-orm';
import { db } from '../../lib/db';
import { bills, billUnions } from '../../lib/db/schema';
import { fetchAllOData, fetchODataSince } from '../../lib/knesset/odata-client';
import { getLastSyncTime, runSyncJob, type SyncCheckpoint } from '../utils';

const BATCH_SIZE = 500;

interface ODataBillUnion {
  BillUnionID: number;
  MainBillID: number;
  UnionBillID: number;
  LastUpdatedDate: string;
}

async function syncBillUnionRecords(
  prevCheckpoint: SyncCheckpoint | null,
): Promise<{ count: number; checkpoint: SyncCheckpoint }> {
  const checkpointDate = prevCheckpoint?.lastItemTimestamp
    ? new Date(prevCheckpoint.lastItemTimestamp as string)
    : null;
  const lastSync = checkpointDate ?? (await getLastSyncTime('bill_unions'));

  let rawUnions: ODataBillUnion[];
  if (lastSync) {
    rawUnions = await fetchODataSince<ODataBillUnion>(
      'ParliamentInfo',
      'KNS_BillUnion',
      lastSync,
      'LastUpdatedDate',
    );
  } else {
    rawUnions = await fetchAllOData<ODataBillUnion>(
      'ParliamentInfo',
      'KNS_BillUnion',
      { $orderby: 'LastUpdatedDate desc' },
      100,
      'bill_unions',
    );
  }

  console.log(`  [bill_unions] Fetched ${rawUnions.length} union records`);

  // Pre-load bill FK map
  const allBills = await db
    .select({ id: bills.id, knessetId: bills.knessetId })
    .from(bills);
  const billMap = new Map(allBills.map((b) => [b.knessetId, b.id]));

  let maxLastUpdated = prevCheckpoint?.lastItemTimestamp as string | undefined;
  let unmapped = 0;

  const rows = rawUnions
    .map((raw) => {
      if (raw.LastUpdatedDate && (!maxLastUpdated || raw.LastUpdatedDate > maxLastUpdated)) {
        maxLastUpdated = raw.LastUpdatedDate;
      }
      const mainBillId = billMap.get(raw.MainBillID);
      const unionBillId = billMap.get(raw.UnionBillID);
      if (!mainBillId || !unionBillId) {
        unmapped++;
        return null;
      }
      return {
        knessetId: raw.BillUnionID,
        mainBillId,
        unionBillId,
        lastUpdated: raw.LastUpdatedDate ? new Date(raw.LastUpdatedDate) : null,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (unmapped > 0) {
    console.log(`  [bill_unions] ${unmapped} records skipped (bill not in DB)`);
  }

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await db
      .insert(billUnions)
      .values(batch)
      .onConflictDoUpdate({
        target: billUnions.knessetId,
        set: {
          mainBillId: sql`excluded.main_bill_id`,
          unionBillId: sql`excluded.union_bill_id`,
          lastUpdated: sql`excluded.last_updated`,
        },
      });
  }

  const checkpoint: SyncCheckpoint = {
    lastItemTimestamp: maxLastUpdated,
  };

  return { count: rows.length, checkpoint };
}

export async function syncBillUnions(): Promise<void> {
  await runSyncJob('bill_unions', syncBillUnionRecords);
}
