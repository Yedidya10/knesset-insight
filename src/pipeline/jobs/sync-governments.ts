import { eq, sql } from 'drizzle-orm';
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

  console.log(`  [governments] Fetched ${allGovPositions.length} government positions`);

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
    // Derive date range from positions
    let minStart: string | null = null;
    let maxEnd: string | null = null;
    let hasOpenEnd = false;
    let knessetNum = 0;

    for (const pos of positions) {
      if (pos.KnessetNum > knessetNum) knessetNum = pos.KnessetNum;
      const start = pos.StartDate?.split('T')[0] ?? null;
      const end = pos.FinishDate?.split('T')[0] ?? null;

      if (start && (!minStart || start < minStart)) minStart = start;
      if (end === null) {
        hasOpenEnd = true;
      } else if (maxEnd === null || end > maxEnd) {
        maxEnd = end;
      }
    }

    // Find PM and alternate PM
    let pmPersonId: number | null = null;
    let alternatePmPersonId: number | null = null;

    for (const pos of positions) {
      if (pos.PositionID === govPositionIds.primeMinister) {
        pmPersonId = pos.PersonID;
      }
      if (pos.PositionID === govPositionIds.alternatePm) {
        alternatePmPersonId = pos.PersonID;
      }
    }

    const pmMemberId = pmPersonId ? personToMemberId.get(pmPersonId) ?? null : null;
    const alternatePmMemberId = alternatePmPersonId
      ? personToMemberId.get(alternatePmPersonId) ?? null
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

    // Upsert positions in batches
    for (let i = 0; i < positions.length; i += BATCH_SIZE) {
      const batch = positions.slice(i, i + BATCH_SIZE);
      const rows = batch.map((pos) => ({
        governmentId: govDbId,
        memberId: personToMemberId.get(pos.PersonID) ?? null,
        memberKnessetId: pos.PersonID,
        positionId: pos.PositionID,
        positionDesc: positionDescs.get(pos.PositionID) ?? null,
        govMinistryId: pos.GovMinistryID
          ? ministryKnessetIdToDbId.get(pos.GovMinistryID) ?? null
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

    totalPositions += positions.length;
    console.log(
      `  [governments] Gov ${govNum} (K${knessetNum}): ${positions.length} positions, PM=${pmPersonId ?? 'N/A'}`,
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
