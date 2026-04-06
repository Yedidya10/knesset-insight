import { sql } from 'drizzle-orm';
import { db } from '../../lib/db';
import { bills, billNames } from '../../lib/db/schema';
import { fetchAllOData, fetchODataSince } from '../../lib/knesset/odata-client';
import { getLastSyncTime, runSyncJob, type SyncCheckpoint } from '../utils';

const BATCH_SIZE = 500;

interface ODataBillName {
  BillNameID: number;
  BillID: number;
  Name: string;
  NameHistoryTypeID: number;
  NameHistoryTypeDesc: string;
  LastUpdatedDate: string;
}

async function syncBillNameRecords(
  prevCheckpoint: SyncCheckpoint | null,
): Promise<{ count: number; checkpoint: SyncCheckpoint }> {
  const checkpointDate = prevCheckpoint?.lastItemTimestamp
    ? new Date(prevCheckpoint.lastItemTimestamp as string)
    : null;
  const lastSync = checkpointDate ?? (await getLastSyncTime('bill_names'));

  let rawNames: ODataBillName[];
  if (lastSync) {
    rawNames = await fetchODataSince<ODataBillName>(
      'ParliamentInfo',
      'KNS_BillName',
      lastSync,
      'LastUpdatedDate',
    );
  } else {
    rawNames = await fetchAllOData<ODataBillName>(
      'ParliamentInfo',
      'KNS_BillName',
      { $orderby: 'LastUpdatedDate desc' },
      100,
      'bill_names',
    );
  }

  console.log(`  [bill_names] Fetched ${rawNames.length} name records`);

  const allBills = await db
    .select({ id: bills.id, knessetId: bills.knessetId })
    .from(bills);
  const billMap = new Map(allBills.map((b) => [b.knessetId, b.id]));

  let maxLastUpdated = prevCheckpoint?.lastItemTimestamp as string | undefined;
  let unmapped = 0;

  const rows = rawNames
    .map((raw) => {
      if (raw.LastUpdatedDate && (!maxLastUpdated || raw.LastUpdatedDate > maxLastUpdated)) {
        maxLastUpdated = raw.LastUpdatedDate;
      }
      const billId = billMap.get(raw.BillID);
      if (!billId) {
        unmapped++;
        return null;
      }
      return {
        knessetId: raw.BillNameID,
        billId,
        name: raw.Name,
        nameHistoryTypeId: raw.NameHistoryTypeID ?? null,
        nameHistoryTypeDesc: raw.NameHistoryTypeDesc || null,
        lastUpdated: raw.LastUpdatedDate ? new Date(raw.LastUpdatedDate) : null,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (unmapped > 0) {
    console.log(`  [bill_names] ${unmapped} records skipped (bill not in DB)`);
  }

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await db
      .insert(billNames)
      .values(batch)
      .onConflictDoUpdate({
        target: billNames.knessetId,
        set: {
          billId: sql`excluded.bill_id`,
          name: sql`excluded.name`,
          nameHistoryTypeId: sql`excluded.name_history_type_id`,
          nameHistoryTypeDesc: sql`excluded.name_history_type_desc`,
          lastUpdated: sql`excluded.last_updated`,
        },
      });
  }

  const checkpoint: SyncCheckpoint = {
    lastItemTimestamp: maxLastUpdated,
  };

  return { count: rows.length, checkpoint };
}

export async function syncBillNames(): Promise<void> {
  await runSyncJob('bill_names', syncBillNameRecords);
}
