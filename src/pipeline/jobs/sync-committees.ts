import { sql } from 'drizzle-orm';
import { db } from '../../lib/db';
import { committees } from '../../lib/db/schema';
import { fetchOData, fetchODataSince } from '../../lib/knesset/odata-client';
import { getLastSyncTime, runSyncJob } from '../utils';

const BATCH_SIZE = 50;
const PAGE_SIZE = 100;

interface ODataCommittee {
  CommitteeID: number;
  Name: string;
  CategoryDesc: string;
  KnessetNum: number;
  CommitteeTypeDesc: string;
  IsCurrent: boolean;
  StartDate: string;
  FinishDate: string | null;
  LastUpdatedDate: string;
}

/**
 * Sync committees from OData, Knesset 25 first.
 */
async function syncCommitteeRecords(): Promise<number> {
  const lastSync = await getLastSyncTime('committees');

  let rawCommittees: ODataCommittee[];
  if (lastSync) {
    rawCommittees = await fetchODataSince<ODataCommittee>(
      'ParliamentInfo',
      'KNS_Committee',
      lastSync,
      'LastUpdatedDate',
    );
  } else {
    rawCommittees = [];
    const knessets = [25, 24, 23];
    for (const kn of knessets) {
      let skip = 0;
      while (true) {
        const page = await fetchOData<ODataCommittee>('ParliamentInfo', 'KNS_Committee', {
          $filter: `KnessetNum eq ${kn}`,
          $top: PAGE_SIZE,
          $skip: skip,
        });
        rawCommittees.push(...page);
        console.log(`  [committees] Knesset ${kn}: +${page.length} (total: ${rawCommittees.length})`);
        if (page.length < PAGE_SIZE) break;
        skip += PAGE_SIZE;
      }
    }
  }

  const rows = rawCommittees.map((raw) => ({
    knessetId: raw.CommitteeID,
    name: raw.Name,
    committeeType: raw.CommitteeTypeDesc || null,
    knessetNum: raw.KnessetNum,
    isActive: raw.IsCurrent,
  }));

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await db
      .insert(committees)
      .values(batch)
      .onConflictDoUpdate({
        target: committees.knessetId,
        set: {
          name: sql`excluded.name`,
          committeeType: sql`excluded.committee_type`,
          knessetNum: sql`excluded.knesset_num`,
          isActive: sql`excluded.is_active`,
          updatedAt: new Date(),
        },
      });
  }

  return rows.length;
}

export async function syncCommittees(): Promise<void> {
  await runSyncJob('committees', syncCommitteeRecords);
}
