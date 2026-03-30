import { eq } from 'drizzle-orm';
import { db } from '../../lib/db';
import { members, parties } from '../../lib/db/schema';
import { fetchOKnessetCSV } from '../../lib/knesset/oknesset-client';
import { fetchAllOData } from '../../lib/knesset/odata-client';
import type { ODataPerson, OKnessetMember } from '../../lib/knesset/types';
import { runSyncJob } from '../utils';

/**
 * Sync parties (factions) from Open Knesset data.
 */
async function syncParties(): Promise<number> {
  // Fetch faction data from OKnesset CSV
  const raw = await fetchOKnessetCSV<Record<string, string>>(
    'members/factions/datapackage/datapackage.json',
  );

  // Extract unique factions from member data instead
  const membersData = await fetchOKnessetCSV<Record<string, string>>(
    'members/mk_individual/datapackage/mk_individual.csv',
  );

  const factionMap = new Map<number, { name: string; knessetNum: number }>();
  for (const m of membersData) {
    const factionId = Number(m.faction_id);
    if (factionId && !factionMap.has(factionId)) {
      factionMap.set(factionId, {
        name: m.faction_name,
        knessetNum: Number(m.knesset_num) || 0,
      });
    }
  }

  let count = 0;
  for (const [factionId, data] of factionMap) {
    await db
      .insert(parties)
      .values({
        knessetId: factionId,
        name: data.name,
        knessetNum: data.knessetNum,
      })
      .onConflictDoUpdate({
        target: parties.knessetId,
        set: {
          name: data.name,
          knessetNum: data.knessetNum,
          updatedAt: new Date(),
        },
      });
    count++;
  }

  return count;
}

/**
 * Sync individual MK (members of Knesset) data.
 */
async function syncMemberRecords(): Promise<number> {
  const membersData = await fetchOKnessetCSV<Record<string, string>>(
    'members/mk_individual/datapackage/mk_individual.csv',
  );

  let count = 0;
  for (const raw of membersData) {
    const knessetId = Number(raw.mk_individual_id);
    if (!knessetId) continue;

    // Resolve party by faction_id
    const factionId = Number(raw.faction_id);
    let partyId: number | null = null;

    if (factionId) {
      const partyRows = await db
        .select({ id: parties.id })
        .from(parties)
        .where(eq(parties.knessetId, factionId))
        .limit(1);
      partyId = partyRows[0]?.id ?? null;
    }

    await db
      .insert(members)
      .values({
        knessetId,
        firstName: raw.mk_individual_first_name ?? '',
        lastName: raw.mk_individual_name ?? '',
        partyId,
        isCurrent: raw.mk_individual_is_current === 'True',
        gender: raw.mk_individual_gender ?? null,
        birthDate: raw.mk_individual_date_of_birth || null,
        imageUrl: raw.mk_individual_photo || null,
        email: raw.mk_individual_email || null,
        knessetNum: Number(raw.knesset_num) || null,
      })
      .onConflictDoUpdate({
        target: members.knessetId,
        set: {
          firstName: raw.mk_individual_first_name ?? '',
          lastName: raw.mk_individual_name ?? '',
          partyId,
          isCurrent: raw.mk_individual_is_current === 'True',
          gender: raw.mk_individual_gender ?? null,
          imageUrl: raw.mk_individual_photo || null,
          email: raw.mk_individual_email || null,
          knessetNum: Number(raw.knesset_num) || null,
          updatedAt: new Date(),
        },
      });
    count++;
  }

  return count;
}

/**
 * Full members sync: parties first, then members.
 */
export async function syncMembers(): Promise<void> {
  await runSyncJob('parties', syncParties);
  await runSyncJob('members', syncMemberRecords);
}
