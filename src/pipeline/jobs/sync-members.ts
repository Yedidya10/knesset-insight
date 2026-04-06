import { eq, sql, inArray } from 'drizzle-orm';
import { db } from '../../lib/db';
import { members, factions, memberFactionHistory, factionCoalitionPeriods } from '../../lib/db/schema';
import { fetchOKnessetCSV } from '../../lib/knesset/oknesset-client';
import { fetchAllOData, fetchOData } from '../../lib/knesset/odata-client';
import { fetchV4MkIdMapping } from '../../lib/knesset/knesset-api-client';
import { runSyncJob, type SyncCheckpoint } from '../utils';
import { appConfig } from '../../../app.config';

interface VoteMkIndividual {
  vip_id: string;
  mk_individual_id: number;
  mk_individual_name: string;
  mk_individual_first_name: string;
}

const BATCH_SIZE = 50;

interface PersonToPosition {
  PersonID: number;
  PositionID: number;
  KnessetNum: number;
  FactionID: number;
  FactionName: string;
  IsCurrent: boolean;
  FinishDate: string | null;
  StartDate: string;
}

interface ODataFaction {
  FactionID: number;
  Name: string;
  KnessetNum: number;
  StartDate: string | null;
  FinishDate: string | null;
  IsCurrent: boolean;
}

/**
 * Sync factions from Knesset OData KNS_Faction entity.
 * Enriched with StartDate, FinishDate, IsCurrent from OData.
 * Falls back to Open Knesset CSV for any factions not in OData.
 */
async function syncFactions(_prevCheckpoint: SyncCheckpoint | null): Promise<number> {
  // Primary: Fetch from OData (has date range + isCurrent)
  const odataFactions = await fetchAllOData<ODataFaction>(
    'ParliamentInfo',
    'KNS_Faction',
    {},
    100,
  );

  const odataIds = new Set<number>();
  const rows: Array<{
    knessetId: number;
    name: string;
    knessetNum: number | null;
    startDate: string | null;
    finishDate: string | null;
    isCurrent: boolean;
  }> = [];

  for (const f of odataFactions) {
    if (!f.FactionID) continue;
    odataIds.add(f.FactionID);
    rows.push({
      knessetId: f.FactionID,
      name: f.Name.trim(),
      knessetNum: f.KnessetNum ?? null,
      startDate: f.StartDate ? f.StartDate.split('T')[0] : null,
      finishDate: f.FinishDate ? f.FinishDate.split('T')[0] : null,
      isCurrent: f.IsCurrent ?? false,
    });
  }

  // Fallback: Open Knesset CSV for factions not in OData
  const csvFactions = await fetchOKnessetCSV<Record<string, string>>(
    'members/mk_individual/factions.csv',
  );

  for (const f of csvFactions) {
    const id = Number(f.id);
    if (!id || odataIds.has(id)) continue;
    const knessets = f.knessets?.replace(/[\[\]]/g, '').split(',').map(Number).filter(Boolean) ?? [];
    rows.push({
      knessetId: id,
      name: f.name.trim(),
      knessetNum: knessets.length > 0 ? Math.max(...knessets) : null,
      startDate: null,
      finishDate: null,
      isCurrent: false,
    });
  }

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await db
      .insert(factions)
      .values(batch)
      .onConflictDoUpdate({
        target: factions.knessetId,
        set: {
          name: sql`excluded.name`,
          knessetNum: sql`excluded.knesset_num`,
          startDate: sql`excluded.start_date`,
          finishDate: sql`excluded.finish_date`,
          isCurrent: sql`excluded.is_current`,
          updatedAt: new Date(),
        },
      });
  }

  return rows.length;
}

/**
 * Sync individual MK (members of Knesset) data.
 * Uses mk_individual.csv for member data and KNS_PersonToPosition OData
 * to determine which 120 members are truly active in the current Knesset.
 */
async function syncMemberRecords(_prevCheckpoint: SyncCheckpoint | null): Promise<number> {
  // Fetch member data from CSV
  const membersData = await fetchOKnessetCSV<Record<string, string>>(
    'members/mk_individual/mk_individual.csv',
  );

  // Fetch current MK positions from OData (PositionID=54 = MK position)
  // IsCurrent=true gives exactly 120 active members
  const PAGE_SIZE = 100;
  const currentPositions: PersonToPosition[] = [];
  let skip = 0;
  while (true) {
    const page = await fetchOData<PersonToPosition>(
      'ParliamentInfo',
      'KNS_PersonToPosition',
      {
        $filter: 'KnessetNum eq 25 and PositionID eq 54 and IsCurrent eq true',
        $top: PAGE_SIZE,
        $skip: skip,
      },
    );
    currentPositions.push(...page);
    if (page.length < PAGE_SIZE) break;
    skip += PAGE_SIZE;
  }
  console.log(`  [members] Found ${currentPositions.length} active MK positions in Knesset 25`);

  // Build set of truly current PersonIDs and their current faction
  const currentPersonIds = new Set<number>();
  const personFaction = new Map<number, number>();
  for (const pos of currentPositions) {
    currentPersonIds.add(pos.PersonID);
    personFaction.set(pos.PersonID, pos.FactionID);
  }

  // Also fetch faction memberships for historical members (non-current)
  const factionMemberships = await fetchOKnessetCSV<Record<string, string>>(
    'members/mk_individual/mk_individual_factions.csv',
  );

  // Build mk_individual_id → PersonID mapping
  const mkIdToPersonId = new Map<number, number>();
  for (const m of membersData) {
    const mkId = Number(m.mk_individual_id);
    const personId = Number(m.PersonID);
    if (mkId && personId) mkIdToPersonId.set(mkId, personId);
  }

  // Build PersonID → latest faction_id mapping for non-current members
  const personToFaction = new Map<number, number>();
  for (const fm of factionMemberships) {
    const mkId = Number(fm.mk_individual_id);
    const factionId = Number(fm.faction_id);
    const personId = mkIdToPersonId.get(mkId);
    if (!personId || !factionId) continue;
    // Don't override OData faction data for current members
    if (!personFaction.has(personId) && !personToFaction.has(personId)) {
      personToFaction.set(personId, factionId);
    }
  }

  // Pre-load all faction mappings knessetId → DB id
  const allFactions = await db
    .select({ id: factions.id, knessetId: factions.knessetId })
    .from(factions);
  const factionMap = new Map(allFactions.map((f) => [f.knessetId, f.id]));

  // ── vipId mapping: cross-reference legacy View_Vote_MK_Individual with v4 KNS_PlenumVoteResult ──
  // The v4 MkId is the authoritative vote ID for K25+.
  // Legacy vip_id from View_Vote_MK_Individual is used as fallback and stored in legacyVipId
  // when it differs from the v4 MkId (needed for legacy K1-K24 vote matching).
  //
  // This two-source approach fixes the name-collision bugs where name-based matching
  // (e.g. two "ישראל כץ" or two "אלי כהן") picked the wrong person's vip_id.

  // Source 1: Legacy OData — View_Vote_MK_Individual (name → vip_id)
  const voteMkRows = await fetchAllOData<VoteMkIndividual>(
    'Votes',
    'View_Vote_MK_Individual',
    {},
    100,
  );
  // Build name → vip_id map. For name collisions, collect ALL vip_ids per name.
  const nameToLegacyVipIds = new Map<string, number[]>();
  for (const row of voteMkRows) {
    const vipId = parseInt(String(row.vip_id), 10);
    if (!vipId) continue;
    const firstName = (row.mk_individual_first_name || '').trim();
    const lastName = (row.mk_individual_name || '').trim();
    if (firstName && lastName) {
      const key = `${firstName} ${lastName}`;
      const existing = nameToLegacyVipIds.get(key) ?? [];
      existing.push(vipId);
      nameToLegacyVipIds.set(key, existing);
    }
  }
  console.log(`  [members] Loaded ${nameToLegacyVipIds.size} names from legacy Vote API`);

  // Source 2: v4 OData — KNS_PlenumVoteResult, latest results with (MkId, FirstName, LastName)
  // This is the authoritative source for K25 members' vote ID.
  let v4MkIdByName = new Map<string, number>();
  try {
    const v4Mapping = await fetchV4MkIdMapping();
    for (const entry of v4Mapping) {
      if (entry.firstName && entry.lastName) {
        v4MkIdByName.set(`${entry.firstName} ${entry.lastName}`, entry.mkId);
      }
    }
    console.log(`  [members] Loaded ${v4MkIdByName.size} v4 MkId mappings from PlenumVoteResult`);
  } catch (err) {
    console.warn(`  [members] Failed to fetch v4 MkId mapping, falling back to legacy only:`, err);
  }

  console.log(`  [members] Loaded ${nameToLegacyVipIds.size} name → vip_id mappings from Vote API`);

  // Prepare member rows
  const rows = membersData
    .filter((raw) => Number(raw.PersonID))
    .map((raw) => {
      const knessetId = Number(raw.PersonID);
      // Use OData faction for current members, CSV for historical
      const factionKnessetId = personFaction.get(knessetId) ?? personToFaction.get(knessetId);
      const factionId = factionKnessetId ? (factionMap.get(factionKnessetId) ?? null) : null;

      // Resolve vipId via two-source cross-reference:
      // Priority: v4 MkId (authoritative for K25) > legacy vip_id (fallback)
      const firstName = (raw.mk_individual_first_name || '').trim();
      const lastName = (raw.mk_individual_name || '').trim();
      const fullName = (firstName && lastName) ? `${firstName} ${lastName}` : '';

      let vipId: number | null = null;
      let legacyVipId: number | null = null;

      if (fullName) {
        const v4Id = v4MkIdByName.get(fullName) ?? null;
        const legacyIds = nameToLegacyVipIds.get(fullName) ?? [];

        if (v4Id) {
          // v4 MkId is authoritative — use it as primary
          vipId = v4Id;
          // If legacy has a DIFFERENT id, store it for K1-K24 vote matching
          if (legacyIds.length === 1 && legacyIds[0] !== v4Id) {
            legacyVipId = legacyIds[0];
          } else if (legacyIds.length > 1) {
            // Name collision in legacy — pick the one matching v4, or first non-v4
            const matchingLegacy = legacyIds.find((id) => id === v4Id);
            const otherLegacy = legacyIds.find((id) => id !== v4Id);
            if (otherLegacy && !matchingLegacy) {
              // v4 MkId doesn't appear in legacy at all — legacy ID is different
              legacyVipId = otherLegacy;
            }
          }
        } else if (legacyIds.length === 1) {
          // No v4 data — use the only legacy vip_id
          vipId = legacyIds[0];
        } else if (legacyIds.length > 1) {
          // Name collision with no v4 data — log warning, pick first
          console.warn(`  [members] Name collision for "${fullName}": ${legacyIds.length} legacy IDs [${legacyIds.join(',')}], no v4 data`);
          vipId = legacyIds[0];
        }
      }

      return {
        knessetId,
        vipId,
        legacyVipId,
        firstName: raw.mk_individual_first_name || raw.FirstName || '',
        lastName: raw.mk_individual_name || raw.LastName || '',
        factionId,
        isCurrent: currentPersonIds.has(knessetId),
        gender: raw.GenderDesc || null,
        imageUrl: raw.mk_individual_photo || null,
        email: raw.mk_individual_email || raw.Email || null,
      };
    });

  const currentCount = rows.filter(r => r.isCurrent).length;
  console.log(`  [members] Syncing ${rows.length} members (${currentCount} current)`);

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await db
      .insert(members)
      .values(batch)
      .onConflictDoUpdate({
        target: members.knessetId,
        set: {
          firstName: sql`excluded.first_name`,
          lastName: sql`excluded.last_name`,
          factionId: sql`excluded.faction_id`,
          isCurrent: sql`excluded.is_current`,
          gender: sql`excluded.gender`,
          imageUrl: sql`excluded.image_url`,
          email: sql`excluded.email`,
          vipId: sql`COALESCE(excluded.vip_id, ${members.vipId})`,
          legacyVipId: sql`COALESCE(excluded.legacy_vip_id, ${members.legacyVipId})`,
          updatedAt: new Date(),
        },
      });
  }

  return rows.length;
}

interface GovPosition {
  PersonID: number;
  PositionID: number;
  KnessetNum: number;
  GovernmentNum: number | null;
  FactionID: number | null;
  FactionName: string | null;
  IsCurrent: boolean;
  StartDate: string | null;
  FinishDate: string | null;
}

/**
 * Determine which factions are in the coalition by cross-referencing
 * government-position holders with their MK faction assignments.
 *
 * For each synced Knesset number:
 * 1. Fetch ALL positions with GovernmentNum set (not just IsCurrent — needed for past knessets)
 * 2. Fetch MK positions (PositionID=54) to get PersonID → FactionID mapping
 * 3. Group government positions by GovernmentNum to derive per-government coalition periods
 * 4. Upsert into faction_coalition_periods table
 * 5. Update factions.isCoalition based on the latest government (backward compat)
 */
async function syncCoalitionStatus(_prevCheckpoint: SyncCheckpoint | null): Promise<number> {
  const { mkPositionId } = appConfig.knesset;
  let updated = 0;

  for (const knessetNum of appConfig.knesset.syncKnessets) {
    // Fetch ALL MK positions for this knesset (including former MKs who became
    // ministers and resigned their seats under the Norwegian Law) to build a
    // comprehensive PersonID → FactionID mapping.
    const mkPositions = await fetchAllOData<PersonToPosition>(
      'ParliamentInfo',
      'KNS_PersonToPosition',
      { $filter: `KnessetNum eq ${knessetNum} and PositionID eq ${mkPositionId}` },
      100,
    );

    const personToFactionId = new Map<number, number>();
    for (const pos of mkPositions) {
      if (pos.FactionID) {
        personToFactionId.set(pos.PersonID, pos.FactionID);
      }
    }

    // Fetch ALL government-position holders for this Knesset (not just IsCurrent,
    // so historical knessets also return data)
    const govPositions = await fetchAllOData<GovPosition>(
      'ParliamentInfo',
      'KNS_PersonToPosition',
      { $filter: `KnessetNum eq ${knessetNum} and GovernmentNum ne null` },
      100,
    );

    // Group by GovernmentNum — each group represents one government's coalition
    const govGroups = new Map<number, GovPosition[]>();
    for (const pos of govPositions) {
      if (pos.GovernmentNum == null) continue;
      const group = govGroups.get(pos.GovernmentNum) ?? [];
      group.push(pos);
      govGroups.set(pos.GovernmentNum, group);
    }

    // Get faction DB IDs for this knesset
    const knessetFactions = await db
      .select({ id: factions.id, knessetId: factions.knessetId })
      .from(factions)
      .where(eq(factions.knessetNum, knessetNum));

    if (knessetFactions.length === 0) continue;

    const factionKnessetIdToDbId = new Map(knessetFactions.map((f) => [f.knessetId, f.id]));

    // For each government, derive coalition factions and their date ranges
    let latestGovNum = 0;
    const latestCoalitionFactionIds = new Set<number>();

    for (const [govNum, positions] of govGroups) {
      // Collect coalition factions for this government
      const factionDates = new Map<number, { start: string | null; end: string | null }>();

      for (const pos of positions) {
        const factionKnessetId = pos.FactionID || personToFactionId.get(pos.PersonID);
        if (!factionKnessetId) continue;

        const dbId = factionKnessetIdToDbId.get(factionKnessetId);
        if (!dbId) continue;

        const existing = factionDates.get(dbId);
        const posStart = pos.StartDate?.split('T')[0] ?? null;
        const posEnd = pos.FinishDate?.split('T')[0] ?? null;

        if (!existing) {
          factionDates.set(dbId, { start: posStart, end: posEnd });
        } else {
          // Expand date range: earliest start, latest end
          if (posStart && (!existing.start || posStart < existing.start)) {
            existing.start = posStart;
          }
          if (posEnd === null) {
            existing.end = null; // Still active
          } else if (existing.end !== null && posEnd > existing.end) {
            existing.end = posEnd;
          }
        }
      }

      // Upsert coalition periods for this government
      for (const [dbFactionId, dates] of factionDates) {
        await db
          .insert(factionCoalitionPeriods)
          .values({
            factionId: dbFactionId,
            knessetNum,
            governmentNum: govNum,
            startDate: dates.start,
            endDate: dates.end,
          })
          .onConflictDoUpdate({
            target: [
              factionCoalitionPeriods.factionId,
              factionCoalitionPeriods.knessetNum,
              factionCoalitionPeriods.governmentNum,
            ],
            set: {
              startDate: sql`excluded.start_date`,
              endDate: sql`excluded.end_date`,
              updatedAt: new Date(),
            },
          });
      }

      // Track the latest government for backward-compat isCoalition flag
      if (govNum > latestGovNum) {
        latestGovNum = govNum;
        latestCoalitionFactionIds.clear();
        for (const dbId of factionDates.keys()) {
          latestCoalitionFactionIds.add(dbId);
        }
      }

      console.log(
        `  [coalition] Knesset ${knessetNum}, Gov ${govNum}: ${factionDates.size} coalition factions from ${positions.length} gov positions`,
      );
    }

    // Update factions.isCoalition based on the latest government (backward compat)
    const allIds = knessetFactions.map((f) => f.id);
    await db
      .update(factions)
      .set({ isCoalition: false, updatedAt: new Date() })
      .where(inArray(factions.id, allIds));

    if (latestCoalitionFactionIds.size > 0) {
      await db
        .update(factions)
        .set({ isCoalition: true, updatedAt: new Date() })
        .where(inArray(factions.id, [...latestCoalitionFactionIds]));
    }

    console.log(
      `  [coalition] Knesset ${knessetNum}: ${govGroups.size} government(s), latest gov ${latestGovNum} has ${latestCoalitionFactionIds.size} coalition factions`,
    );

    updated += knessetFactions.length;
  }

  return updated;
}

/**
 * Sync member faction history from Open Knesset mk_individual_factions.csv.
 * Provides temporal tracking of which MK was in which faction and when.
 */
async function syncFactionHistory(_prevCheckpoint: SyncCheckpoint | null): Promise<number> {
  const historyRows = await fetchOKnessetCSV<Record<string, string>>(
    'members/mk_individual/mk_individual_factions.csv',
  );

  // Pre-load faction & member knessetId → DB id maps
  const allFactions = await db
    .select({ id: factions.id, knessetId: factions.knessetId })
    .from(factions);
  const factionMap = new Map(allFactions.map((f) => [f.knessetId, f.id]));

  const allMembers = await db
    .select({ id: members.id, knessetId: members.knessetId })
    .from(members);
  // mk_individual_id in CSV → need mapping via PersonID
  // The CSV uses mk_individual_id which is the same as PersonID in our members table
  const memberLookup = new Map<number, number>();
  // We need the mk_individual CSV to map mk_individual_id → PersonID
  const mkIndividuals = await fetchOKnessetCSV<Record<string, string>>(
    'members/mk_individual/mk_individual.csv',
  );
  const mkIdToPersonId = new Map<number, number>();
  for (const m of mkIndividuals) {
    const mkId = Number(m.mk_individual_id);
    const personId = Number(m.PersonID);
    if (mkId && personId) mkIdToPersonId.set(mkId, personId);
  }
  const memberByKnessetId = new Map(allMembers.map((m) => [m.knessetId, m.id]));

  const rows: Array<{
    memberId: number;
    factionId: number;
    knessetNum: number;
    startDate: string;
    endDate: string | null;
  }> = [];

  for (const row of historyRows) {
    const mkId = Number(row.mk_individual_id);
    const factionKnessetId = Number(row.faction_id);
    const knessetNum = Number(row.knesset);
    const startDate = row.start_date;

    if (!mkId || !factionKnessetId || !knessetNum || !startDate) continue;

    const personId = mkIdToPersonId.get(mkId);
    if (!personId) continue;

    const memberId = memberByKnessetId.get(personId);
    const factionId = factionMap.get(factionKnessetId);
    if (!memberId || !factionId) continue;

    rows.push({
      memberId,
      factionId,
      knessetNum,
      startDate: startDate.split('T')[0],
      endDate: row.finish_date ? row.finish_date.split('T')[0] : null,
    });
  }

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await db
      .insert(memberFactionHistory)
      .values(batch)
      .onConflictDoUpdate({
        target: [
          memberFactionHistory.memberId,
          memberFactionHistory.factionId,
          memberFactionHistory.startDate,
        ],
        set: {
          endDate: sql`excluded.end_date`,
          knessetNum: sql`excluded.knesset_num`,
        },
      });
  }

  return rows.length;
}

/**
 * Full members sync: factions first, then members, then coalition status, then history.
 */
export async function syncMembers(): Promise<void> {
  await runSyncJob('factions', syncFactions);
  await runSyncJob('members', syncMemberRecords);
  await runSyncJob('coalition', syncCoalitionStatus);
  await runSyncJob('faction-history', syncFactionHistory);
}
