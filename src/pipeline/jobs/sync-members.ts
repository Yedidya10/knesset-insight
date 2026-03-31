import { eq, sql } from 'drizzle-orm';
import { db } from '../../lib/db';
import { members, parties } from '../../lib/db/schema';
import { fetchOKnessetCSV } from '../../lib/knesset/oknesset-client';
import { fetchOData } from '../../lib/knesset/odata-client';
import { runSyncJob } from '../utils';

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

/**
 * Sync parties (factions) from Open Knesset factions.csv.
 */
async function syncParties(): Promise<number> {
  const factions = await fetchOKnessetCSV<Record<string, string>>(
    'members/mk_individual/factions.csv',
  );

  const rows = factions
    .filter((f) => Number(f.id))
    .map((f) => {
      const knessets = f.knessets?.replace(/[\[\]]/g, '').split(',').map(Number).filter(Boolean) ?? [];
      return {
        knessetId: Number(f.id),
        name: f.name.trim(),
        knessetNum: knessets.length > 0 ? Math.max(...knessets) : null,
      };
    });

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await db
      .insert(parties)
      .values(batch)
      .onConflictDoUpdate({
        target: parties.knessetId,
        set: {
          name: sql`excluded.name`,
          knessetNum: sql`excluded.knesset_num`,
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
async function syncMemberRecords(): Promise<number> {
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

  // Pre-load all party mappings knessetId → DB id
  const allParties = await db
    .select({ id: parties.id, knessetId: parties.knessetId })
    .from(parties);
  const partyMap = new Map(allParties.map((p) => [p.knessetId, p.id]));

  // Prepare member rows
  const rows = membersData
    .filter((raw) => Number(raw.PersonID))
    .map((raw) => {
      const knessetId = Number(raw.PersonID);
      // Use OData faction for current members, CSV for historical
      const factionId = personFaction.get(knessetId) ?? personToFaction.get(knessetId);
      const partyId = factionId ? (partyMap.get(factionId) ?? null) : null;

      return {
        knessetId,
        firstName: raw.mk_individual_first_name || raw.FirstName || '',
        lastName: raw.mk_individual_name || raw.LastName || '',
        partyId,
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
          partyId: sql`excluded.party_id`,
          isCurrent: sql`excluded.is_current`,
          gender: sql`excluded.gender`,
          imageUrl: sql`excluded.image_url`,
          email: sql`excluded.email`,
          updatedAt: new Date(),
        },
      });
  }

  return rows.length;
}

/**
 * Full members sync: parties first, then members.
 */
export async function syncMembers(): Promise<void> {
  await runSyncJob('parties', syncParties);
  await runSyncJob('members', syncMemberRecords);
}
