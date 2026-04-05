import { sql } from 'drizzle-orm';
import { db } from '../../lib/db';
import { bills } from '../../lib/db/schema';
import { fetchOData, fetchODataSince } from '../../lib/knesset/odata-client';
import { getLastSyncTime, runSyncJob, type SyncCheckpoint } from '../utils';

const BATCH_SIZE = 50;
const PAGE_SIZE = 100;

interface ODataBill {
  BillID: number;
  KnessetNum: number;
  Name: string;
  SubTypeDesc: string;
  StatusID: number;
  PublicationDate: string | null;
  LastUpdatedDate: string;
}

/**
 * Sync bills from OData, Knesset 25 first then backwards.
 * Uses checkpoint-based incremental sync: picks up from the max LastUpdatedDate
 * of previously processed bills rather than the wall-clock sync start time.
 */
async function syncBillRecords(prevCheckpoint: SyncCheckpoint | null): Promise<{ count: number; checkpoint: SyncCheckpoint }> {
  // Prefer checkpoint's item timestamp over the sync start time for incremental
  const checkpointDate = prevCheckpoint?.lastItemTimestamp
    ? new Date(prevCheckpoint.lastItemTimestamp as string)
    : null;
  const lastSync = checkpointDate ?? await getLastSyncTime('bills');

  let rawBills: ODataBill[];
  if (lastSync) {
    rawBills = await fetchODataSince<ODataBill>(
      'ParliamentInfo',
      'KNS_Bill',
      lastSync,
      'LastUpdatedDate',
      { $select: 'BillID,KnessetNum,Name,SubTypeDesc,StatusID,PublicationDate,LastUpdatedDate' },
    );
  } else {
    rawBills = [];
    const knessets = [25, 24, 23];
    for (const kn of knessets) {
      let skip = 0;
      while (true) {
        const page = await fetchOData<ODataBill>('ParliamentInfo', 'KNS_Bill', {
          $filter: `KnessetNum eq ${kn}`,
          $orderby: 'LastUpdatedDate desc',
          $select: 'BillID,KnessetNum,Name,SubTypeDesc,StatusID,PublicationDate,LastUpdatedDate',
          $top: PAGE_SIZE,
          $skip: skip,
        });
        rawBills.push(...page);
        console.log(`  [bills] Knesset ${kn}: page ${skip / PAGE_SIZE + 1}, +${page.length} (total: ${rawBills.length})`);
        if (page.length < PAGE_SIZE) break;
        skip += PAGE_SIZE;
      }
    }
  }

  // Track the max LastUpdatedDate from processed items for the checkpoint
  let maxLastUpdated = prevCheckpoint?.lastItemTimestamp as string | undefined;
  const rows = rawBills.map((raw) => {
    if (raw.LastUpdatedDate && (!maxLastUpdated || raw.LastUpdatedDate > maxLastUpdated)) {
      maxLastUpdated = raw.LastUpdatedDate;
    }
    return {
      knessetId: raw.BillID,
      name: raw.Name,
      status: String(raw.StatusID),
      billType: raw.SubTypeDesc || null,
      knessetNum: raw.KnessetNum,
      proposedDate: raw.PublicationDate ? raw.PublicationDate.split('T')[0] : null,
      lastUpdate: raw.LastUpdatedDate ? new Date(raw.LastUpdatedDate) : null,
    };
  });

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await db
      .insert(bills)
      .values(batch)
      .onConflictDoUpdate({
        target: bills.knessetId,
        set: {
          name: sql`excluded.name`,
          status: sql`excluded.status`,
          billType: sql`excluded.bill_type`,
          knessetNum: sql`excluded.knesset_num`,
          proposedDate: sql`excluded.proposed_date`,
          lastUpdate: sql`excluded.last_update`,
          updatedAt: new Date(),
        },
      });
  }

  const maxBillId = rawBills.reduce((max, b) => Math.max(max, b.BillID), prevCheckpoint?.lastItemId as number ?? 0);
  const checkpoint: SyncCheckpoint = {
    lastItemId: maxBillId,
    lastItemTimestamp: maxLastUpdated,
  };

  return { count: rows.length, checkpoint };
}

export async function syncBills(): Promise<void> {
  await runSyncJob('bills', syncBillRecords);
}
