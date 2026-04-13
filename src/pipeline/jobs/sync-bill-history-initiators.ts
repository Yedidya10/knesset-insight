import { sql } from 'drizzle-orm';
import { db } from '../../lib/db';
import { bills, billHistoryInitiators, members } from '../../lib/db/schema';
import { fetchAllOData, fetchODataSince } from '../../lib/knesset/odata-client';
import { getLastSyncTime, runSyncJob, type SyncCheckpoint } from '../utils';

const BATCH_SIZE = 500;

interface ODataBillHistoryInitiator {
  BillHistoryInitiatorID: number;
  BillID: number;
  PersonID: number;
  IsInitiator: boolean;
  StartDate: string | null;
  EndDate: string | null;
  ReasonID: number | null;
  ReasonDesc: string | null;
  LastUpdatedDate: string;
}

/** Parse an OData date string to YYYY-MM-DD or null. */
function toDateStr(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  // Ignore sentinel dates like 0001-01-01
  if (d.getFullYear() < 1900) return null;
  return d.toISOString().slice(0, 10);
}

/**
 * Sync bill history initiators (previous proposers) from KNS_BillHistoryInitiator.
 * Maps PersonID → members.knessetId and BillID → bills.knessetId to resolve FKs.
 * Uses checkpoint-based incremental sync from the max LastUpdatedDate.
 */
async function syncBillHistoryInitiatorRecords(
  prevCheckpoint: SyncCheckpoint | null,
): Promise<{ count: number; checkpoint: SyncCheckpoint }> {
  const checkpointDate = prevCheckpoint?.lastItemTimestamp
    ? new Date(prevCheckpoint.lastItemTimestamp as string)
    : null;
  const lastSync =
    checkpointDate ?? (await getLastSyncTime('bill_history_initiators'));

  let rawItems: ODataBillHistoryInitiator[];
  if (lastSync) {
    rawItems = await fetchODataSince<ODataBillHistoryInitiator>(
      'ParliamentInfo',
      'KNS_BillHistoryInitiator',
      lastSync,
      'LastUpdatedDate',
    );
  } else {
    rawItems = await fetchAllOData<ODataBillHistoryInitiator>(
      'ParliamentInfo',
      'KNS_BillHistoryInitiator',
      { $orderby: 'LastUpdatedDate desc' },
      100,
      'bill_history_initiators',
    );
  }

  console.log(`  [bill_history_initiators] Fetched ${rawItems.length} records`);

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
  const rows = rawItems
    .map((raw) => {
      if (
        raw.LastUpdatedDate &&
        (!maxLastUpdated || raw.LastUpdatedDate > maxLastUpdated)
      ) {
        maxLastUpdated = raw.LastUpdatedDate;
      }
      const billId = billMap.get(raw.BillID);
      const memberId = memberMap.get(raw.PersonID);
      if (!billId || !memberId) {
        unmapped++;
        return null;
      }
      return {
        knessetId: raw.BillHistoryInitiatorID,
        billId,
        memberId,
        isInitiator: raw.IsInitiator ?? false,
        startDate: toDateStr(raw.StartDate),
        endDate: toDateStr(raw.EndDate),
        reasonId: raw.ReasonID ?? null,
        reasonDesc: raw.ReasonDesc?.trim() ?? null,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (unmapped > 0) {
    console.log(
      `  [bill_history_initiators] ${unmapped} records skipped (bill or member not in DB)`,
    );
  }

  // Batch upsert
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await db
      .insert(billHistoryInitiators)
      .values(batch)
      .onConflictDoUpdate({
        target: [billHistoryInitiators.knessetId],
        set: {
          isInitiator: sql`excluded.is_initiator`,
          startDate: sql`excluded.start_date`,
          endDate: sql`excluded.end_date`,
          reasonId: sql`excluded.reason_id`,
          reasonDesc: sql`excluded.reason_desc`,
        },
      });
  }

  const checkpoint: SyncCheckpoint = {
    lastItemTimestamp: maxLastUpdated,
  };

  return { count: rows.length, checkpoint };
}

export async function syncBillHistoryInitiators(): Promise<void> {
  await runSyncJob('bill_history_initiators', syncBillHistoryInitiatorRecords);
}
