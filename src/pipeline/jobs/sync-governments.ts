import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../lib/db';
import {
  governments,
  governmentPositions,
  govMinistries,
  members,
} from '../../lib/db/schema';
import { fetchAllOData } from '../../lib/knesset/odata-client';
import { runSyncJob } from '../utils';
import { appConfig } from '../../../app.config';

const BATCH_SIZE = 50;

/**
 * Position data from KNS_PersonToPosition with government fields.
 */
interface GovPositionRaw {
  PersonToPositionID: number;
  PersonID: number;
  PositionID: number;
  KnessetNum: number;
  GovernmentNum: number | null;
  GovMinistryID: number | null;
  GovMinistryName: string | null;
  FactionID: number | null;
  FactionName: string | null;
  IsCurrent: boolean;
  StartDate: string | null;
  FinishDate: string | null;
}

/**
 * Position description from KNS_Position.
 */
interface ODataPosition {
  PositionID: number;
  Description: string;
  GenderID: number;
}

/**
 * Fetch position descriptions once (small set ~25 records).
 */
async function fetchPositionDescriptions(): Promise<Map<number, string>> {
  const positions = await fetchAllOData<ODataPosition>(
    'ParliamentInfo',
    'KNS_Position',
    {},
    100,
  );
  const map = new Map<number, string>();
  for (const p of positions) {
    // Prefer gender-neutral description (pick first encountered)
    if (!map.has(p.PositionID)) {
      map.set(p.PositionID, p.Description);
    }
  }
  return map;
}

/**
 * Derive Hebrew ordinal name for government number.
 */
function govName(num: number): string {
  if (num === 0) return 'הממשלה הזמנית';
  return `הממשלה ה-${num}`;
}

/**
 * Sync governments and government positions from KNS_PersonToPosition.
 */
async function syncGovernmentRecords(): Promise<number> {
  const { govPositionIds } = appConfig.knesset;

  // 1. Fetch all government positions across all knessets
  const allGovPositions = await fetchAllOData<GovPositionRaw>(
    'ParliamentInfo',
    'KNS_PersonToPosition',
    { $filter: 'GovernmentNum ne null' },
    100,
    'gov-positions',
  );

  console.log(
    `  [governments] Fetched ${allGovPositions.length} government positions`,
  );

  // 2. Fetch position descriptions
  const positionDescs = await fetchPositionDescriptions();

  // 3. Build member lookup: PersonID → members.id
  const memberRows = await db
    .select({ id: members.id, knessetId: members.knessetId })
    .from(members);
  const personToMemberId = new Map(memberRows.map((m) => [m.knessetId, m.id]));

  // 4. Build ministry lookup: GovMinistryID → govMinistries.id
  const ministryRows = await db
    .select({ id: govMinistries.id, knessetId: govMinistries.knessetId })
    .from(govMinistries);
  const ministryKnessetIdToDbId = new Map(
    ministryRows.map((m) => [m.knessetId, m.id]),
  );

  // 5. Group positions by GovernmentNum
  const govGroups = new Map<number, GovPositionRaw[]>();
  for (const pos of allGovPositions) {
    if (pos.GovernmentNum == null) continue;
    const group = govGroups.get(pos.GovernmentNum) ?? [];
    group.push(pos);
    govGroups.set(pos.GovernmentNum, group);
  }

  let totalPositions = 0;

  // 6. Process each government
  for (const [govNum, positions] of govGroups) {
    // Derive date range and knesset number from positions
    let minStart: string | null = null;
    let maxEnd: string | null = null;
    let hasOpenEnd = false;
    // Track the minimum KnessetNum — a government belongs to the Knesset
    // in which it was formed; positions in later terms are caretaker records.
    let knessetNum = Infinity;

    for (const pos of positions) {
      if (pos.KnessetNum < knessetNum) knessetNum = pos.KnessetNum;
      const start = pos.StartDate?.split('T')[0] ?? null;
      const end = pos.FinishDate?.split('T')[0] ?? null;

      if (start && (!minStart || start < minStart)) minStart = start;
      if (end === null) {
        hasOpenEnd = true;
      } else if (maxEnd === null || end > maxEnd) {
        maxEnd = end;
      }
    }
    if (!isFinite(knessetNum)) knessetNum = 0;

    // Find PM (earliest start date) and alternate PM (earliest start date)
    let pmPersonId: number | null = null;
    let pmStartDate: string | null = null;
    let alternatePmPersonId: number | null = null;
    let altPmStartDate: string | null = null;

    for (const pos of positions) {
      if (pos.PositionID === govPositionIds.primeMinister) {
        const posStart = pos.StartDate?.split('T')[0] ?? null;
        if (
          pmPersonId === null ||
          (posStart && (!pmStartDate || posStart < pmStartDate))
        ) {
          pmPersonId = pos.PersonID;
          pmStartDate = posStart;
        }
      }
      if (pos.PositionID === govPositionIds.alternatePm) {
        const posStart = pos.StartDate?.split('T')[0] ?? null;
        if (
          alternatePmPersonId === null ||
          (posStart && (!altPmStartDate || posStart < altPmStartDate))
        ) {
          alternatePmPersonId = pos.PersonID;
          altPmStartDate = posStart;
        }
      }
    }

    const pmMemberId = pmPersonId
      ? (personToMemberId.get(pmPersonId) ?? null)
      : null;
    const alternatePmMemberId = alternatePmPersonId
      ? (personToMemberId.get(alternatePmPersonId) ?? null)
      : null;

    // Upsert government record
    await db
      .insert(governments)
      .values({
        governmentNum: govNum,
        knessetNum,
        name: govName(govNum),
        startDate: minStart,
        endDate: hasOpenEnd ? null : maxEnd,
        pmMemberId,
        alternatePmMemberId,
      })
      .onConflictDoUpdate({
        target: governments.governmentNum,
        set: {
          knessetNum: sql`excluded.knesset_num`,
          name: sql`excluded.name`,
          startDate: sql`excluded.start_date`,
          endDate: sql`excluded.end_date`,
          pmMemberId: sql`excluded.pm_member_id`,
          alternatePmMemberId: sql`excluded.alternate_pm_member_id`,
          updatedAt: new Date(),
        },
      });

    // Get the government DB id
    const govRow = await db
      .select({ id: governments.id })
      .from(governments)
      .where(eq(governments.governmentNum, govNum))
      .limit(1);

    if (!govRow[0]) continue;
    const govDbId = govRow[0].id;

    // Deduplicate positions by unique key (memberKnessetId+positionId+govMinistryId+startDate)
    const seen = new Set<string>();
    const uniquePositions: GovPositionRaw[] = [];
    for (const pos of positions) {
      const key = `${pos.PersonID}|${pos.PositionID}|${pos.GovMinistryID ?? 0}|${pos.StartDate?.split('T')[0] ?? ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniquePositions.push(pos);
      }
    }

    // Merge consecutive positions: same person + position + ministry where
    // record A's endDate === record B's startDate (cross-Knesset continuations).
    uniquePositions.sort((a, b) => {
      if (a.PersonID !== b.PersonID) return a.PersonID - b.PersonID;
      if (a.PositionID !== b.PositionID) return a.PositionID - b.PositionID;
      const aMin = a.GovMinistryID ?? 0;
      const bMin = b.GovMinistryID ?? 0;
      if (aMin !== bMin) return aMin - bMin;
      const aStart = a.StartDate?.split('T')[0] ?? '';
      const bStart = b.StartDate?.split('T')[0] ?? '';
      return aStart.localeCompare(bStart);
    });

    const mergedPositions: GovPositionRaw[] = [];
    for (const pos of uniquePositions) {
      const prev = mergedPositions[mergedPositions.length - 1];
      if (
        prev &&
        prev.PersonID === pos.PersonID &&
        prev.PositionID === pos.PositionID &&
        (prev.GovMinistryID ?? 0) === (pos.GovMinistryID ?? 0) &&
        prev.FinishDate != null &&
        pos.StartDate != null &&
        prev.FinishDate.split('T')[0] === pos.StartDate.split('T')[0]
      ) {
        // Extend previous record to cover this one
        prev.FinishDate = pos.FinishDate;
        prev.IsCurrent = pos.IsCurrent;
      } else {
        mergedPositions.push({ ...pos });
      }
    }

    const dupeCount = positions.length - uniquePositions.length;
    const mergeCount = uniquePositions.length - mergedPositions.length;

    // Upsert positions in batches
    for (let i = 0; i < mergedPositions.length; i += BATCH_SIZE) {
      const batch = mergedPositions.slice(i, i + BATCH_SIZE);
      const rows = batch.map((pos) => ({
        governmentId: govDbId,
        memberId: personToMemberId.get(pos.PersonID) ?? null,
        memberKnessetId: pos.PersonID,
        positionId: pos.PositionID,
        positionDesc: positionDescs.get(pos.PositionID) ?? null,
        govMinistryId: pos.GovMinistryID
          ? (ministryKnessetIdToDbId.get(pos.GovMinistryID) ?? null)
          : null,
        factionKnessetId: pos.FactionID,
        startDate: pos.StartDate?.split('T')[0] ?? null,
        endDate: pos.FinishDate?.split('T')[0] ?? null,
        isCurrent: pos.IsCurrent,
      }));

      await db
        .insert(governmentPositions)
        .values(rows)
        .onConflictDoUpdate({
          target: [
            governmentPositions.governmentId,
            governmentPositions.memberKnessetId,
            governmentPositions.positionId,
            governmentPositions.govMinistryId,
            governmentPositions.startDate,
          ],
          set: {
            memberId: sql`excluded.member_id`,
            positionDesc: sql`excluded.position_desc`,
            factionKnessetId: sql`excluded.faction_knesset_id`,
            endDate: sql`excluded.end_date`,
            isCurrent: sql`excluded.is_current`,
            updatedAt: new Date(),
          },
        });
    }

    // Delete stale positions from previous syncs that were merged or removed.
    // Collect the start dates of all merged positions as composite keys.
    const mergedKeys = mergedPositions.map(
      (p) =>
        `${p.PersonID}|${p.PositionID}|${p.GovMinistryID ?? 0}|${p.StartDate?.split('T')[0] ?? ''}`,
    );
    const existingRows = await db
      .select({
        id: governmentPositions.id,
        memberKnessetId: governmentPositions.memberKnessetId,
        positionId: governmentPositions.positionId,
        govMinistryId: governmentPositions.govMinistryId,
        startDate: governmentPositions.startDate,
      })
      .from(governmentPositions)
      .where(eq(governmentPositions.governmentId, govDbId));
    const staleIds: number[] = [];
    const mergedKeySet = new Set(mergedKeys);
    for (const row of existingRows) {
      const key = `${row.memberKnessetId}|${row.positionId}|${row.govMinistryId ?? 0}|${row.startDate ?? ''}`;
      if (!mergedKeySet.has(key)) {
        staleIds.push(row.id);
      }
    }
    if (staleIds.length > 0) {
      await db
        .delete(governmentPositions)
        .where(inArray(governmentPositions.id, staleIds));
    }

    totalPositions += mergedPositions.length;
    console.log(
      `  [governments] Gov ${govNum} (K${knessetNum}): ${mergedPositions.length} positions (${dupeCount} dupes, ${mergeCount} merged), PM=${pmPersonId ?? 'N/A'}`,
    );
  }

  console.log(
    `  [governments] Done: ${govGroups.size} governments, ${totalPositions} positions total`,
  );

  return totalPositions;
}

export async function syncGovernments(): Promise<void> {
  await runSyncJob('governments', syncGovernmentRecords);
}
