import { sql } from 'drizzle-orm';
import { db } from '../../lib/db';
import { bills } from '../../lib/db/schema';
import { fetchOData, fetchODataSince } from '../../lib/knesset/odata-client';
import { getLastSyncTime, runSyncJob } from '../utils';

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
 */
async function syncBillRecords(): Promise<number> {
  const lastSync = await getLastSyncTime('bills');

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

  const rows = rawBills.map((raw) => ({
    knessetId: raw.BillID,
    name: raw.Name,
    status: String(raw.StatusID),
    billType: raw.SubTypeDesc || null,
    knessetNum: raw.KnessetNum,
    proposedDate: raw.PublicationDate ? raw.PublicationDate.split('T')[0] : null,
    lastUpdate: raw.LastUpdatedDate ? new Date(raw.LastUpdatedDate) : null,
  }));

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

  return rows.length;
}

export async function syncBills(): Promise<void> {
  await runSyncJob('bills', syncBillRecords);
}
