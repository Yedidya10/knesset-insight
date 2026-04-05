import { sql } from 'drizzle-orm';
import { db } from '../../lib/db';
import { bills, billInitiators, members } from '../../lib/db/schema';
import { fetchAllOData, fetchODataSince } from '../../lib/knesset/odata-client';
import { getLastSyncTime, runSyncJob, type SyncCheckpoint } from '../utils';

const BATCH_SIZE = 500;

interface ODataBillInitiator {
  BillInitiatorID: number;
  BillID: number;
  PersonID: number;
  IsInitiator: boolean;
  Ordinal: number;
  LastUpdatedDate: string;
}

/**
 * Sync bill initiators from KNS_BillInitiator OData entity.
 * Maps PersonID → members.knessetId and BillID → bills.knessetId to resolve FKs.
 * Uses checkpoint-based incremental sync from the max LastUpdatedDate.
 */
async function syncBillInitiatorRecords(prevCheckpoint: SyncCheckpoint | null): Promise<{ count: number; checkpoint: SyncCheckpoint }> {
  const checkpointDate = prevCheckpoint?.lastItemTimestamp
    ? new Date(prevCheckpoint.lastItemTimestamp as string)
    : null;
  const lastSync = checkpointDate ?? await getLastSyncTime('bill_initiators');

  let rawInitiators: ODataBillInitiator[];
  if (lastSync) {
    rawInitiators = await fetchODataSince<ODataBillInitiator>(
      'ParliamentInfo',
      'KNS_BillInitiator',
      lastSync,
      'LastUpdatedDate',
    );
  } else {
    rawInitiators = await fetchAllOData<ODataBillInitiator>(
      'ParliamentInfo',
      'KNS_BillInitiator',
      { $orderby: 'LastUpdatedDate desc' },
      100,
      'bill_initiators',
    );
  }

  console.log(`  [bill_initiators] Fetched ${rawInitiators.length} initiator records`);

  // Pre-load FK maps
  const allBills = await db
    .select({ id: bills.id, knessetId: bills.knessetId })
    .from(bills);
  const billMap = new Map(allBills.map((b) => [b.knessetId, b.id]));

  const allMembers = await db
    .select({ id: members.id, knessetId: members.knessetId })
    .from(members);
  const memberMap = new Map(allMembers.map((m) => [m.knessetId, m.id]));

  // Track max LastUpdatedDate for checkpoint
  let maxLastUpdated = prevCheckpoint?.lastItemTimestamp as string | undefined;

  // Resolve FKs and prepare rows
  let unmapped = 0;
  const rows = rawInitiators
    .map((raw) => {
      if (raw.LastUpdatedDate && (!maxLastUpdated || raw.LastUpdatedDate > maxLastUpdated)) {
        maxLastUpdated = raw.LastUpdatedDate;
      }
      const billId = billMap.get(raw.BillID);
      const memberId = memberMap.get(raw.PersonID);
      if (!billId || !memberId) {
        unmapped++;
        return null;
      }
      return {
        billId,
        memberId,
        isPrimary: raw.IsInitiator ?? false,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (unmapped > 0) {
    console.log(`  [bill_initiators] ${unmapped} records skipped (bill or member not in DB)`);
  }

  // Batch upsert
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await db
      .insert(billInitiators)
      .values(batch)
      .onConflictDoUpdate({
        target: [billInitiators.billId, billInitiators.memberId],
        set: {
          isPrimary: sql`excluded.is_primary`,
        },
      });
  }

  const checkpoint: SyncCheckpoint = {
    lastItemTimestamp: maxLastUpdated,
  };

  return { count: rows.length, checkpoint };
}

export async function syncBillInitiators(): Promise<void> {
  await runSyncJob('bill_initiators', syncBillInitiatorRecords);
}
