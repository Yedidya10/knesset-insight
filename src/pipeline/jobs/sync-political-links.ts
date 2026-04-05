import { eq, and, sql } from 'drizzle-orm';
import { db } from '../../lib/db';
import {
  factions,
  politicalParties,
  electoralLists,
  electoralListParties,
  partyFactionLinks,
} from '../../lib/db/schema';
import { runSyncJob, type SyncCheckpoint } from '../utils';
import * as fs from 'fs';
import * as path from 'path';

interface SeedData {
  electoralListParties: Array<{
    knessetNum: number;
    ballotLetters: string;
    partyRegistrarNumbers: string[];
  }>;
  factionElectoralList: Array<{
    factionKnessetId: number;
    ballotLetters: string;
    knessetNum: number;
  }>;
  partyFactions: Array<{
    partyRegistrarNumber: string;
    factionKnessetIds: number[];
  }>;
}

/**
 * Load and apply manually curated political entity links.
 * Resolves IDs from the seed file and populates junction tables.
 */
async function syncPoliticalLinksJob(_prevCheckpoint: SyncCheckpoint | null): Promise<number> {
  const seedPath = path.resolve(
    process.cwd(),
    'src/pipeline/seed/political-links.json',
  );

  if (!fs.existsSync(seedPath)) {
    console.warn('  [links] Seed file not found, skipping');
    return 0;
  }

  const seedData: SeedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
  let count = 0;

  // Pre-load lookup maps
  const allFactions = await db
    .select({ id: factions.id, knessetId: factions.knessetId })
    .from(factions);
  const factionByKnessetId = new Map(allFactions.map((f) => [f.knessetId, f.id]));

  const allParties = await db
    .select({ id: politicalParties.id, registrarNumber: politicalParties.registrarNumber })
    .from(politicalParties);
  const partyByRegNum = new Map(allParties.map((p) => [p.registrarNumber, p.id]));

  const allLists = await db
    .select({
      id: electoralLists.id,
      ballotLetters: electoralLists.ballotLetters,
      knessetNum: electoralLists.knessetNum,
    })
    .from(electoralLists);
  const listByKey = new Map(
    allLists.map((l) => [`${l.ballotLetters}:${l.knessetNum}`, l.id]),
  );

  // 1. Link electoral lists ↔ parties (many-to-many)
  if (seedData.electoralListParties) {
    for (const entry of seedData.electoralListParties) {
      const listId = listByKey.get(`${entry.ballotLetters}:${entry.knessetNum}`);
      if (!listId) {
        console.warn(
          `  [links] Electoral list not found: ${entry.ballotLetters} (Knesset ${entry.knessetNum})`,
        );
        continue;
      }

      for (const regNum of entry.partyRegistrarNumbers) {
        const partyId = partyByRegNum.get(regNum);
        if (!partyId) {
          console.warn(`  [links] Party not found: ${regNum}`);
          continue;
        }

        await db
          .insert(electoralListParties)
          .values({ electoralListId: listId, partyId })
          .onConflictDoNothing();
        count++;
      }
    }
  }

  // 2. Link factions → electoral lists (FK on factions table)
  if (seedData.factionElectoralList) {
    for (const entry of seedData.factionElectoralList) {
      const factionDbId = factionByKnessetId.get(entry.factionKnessetId);
      const listId = listByKey.get(`${entry.ballotLetters}:${entry.knessetNum}`);

      if (!factionDbId) {
        console.warn(
          `  [links] Faction not found: KnessetID ${entry.factionKnessetId}`,
        );
        continue;
      }
      if (!listId) {
        console.warn(
          `  [links] Electoral list not found: ${entry.ballotLetters} (Knesset ${entry.knessetNum})`,
        );
        continue;
      }

      await db
        .update(factions)
        .set({ electoralListId: listId, updatedAt: new Date() })
        .where(eq(factions.id, factionDbId));
      count++;
    }
  }

  // 3. Link parties ↔ factions (many-to-many)
  if (seedData.partyFactions) {
    for (const entry of seedData.partyFactions) {
      const partyId = partyByRegNum.get(entry.partyRegistrarNumber);
      if (!partyId) {
        console.warn(`  [links] Party not found: ${entry.partyRegistrarNumber}`);
        continue;
      }

      for (const factionKnessetId of entry.factionKnessetIds) {
        const factionDbId = factionByKnessetId.get(factionKnessetId);
        if (!factionDbId) {
          console.warn(
            `  [links] Faction not found: KnessetID ${factionKnessetId}`,
          );
          continue;
        }

        await db
          .insert(partyFactionLinks)
          .values({ partyId, factionId: factionDbId })
          .onConflictDoNothing();
        count++;
      }
    }
  }

  return count;
}

/**
 * Entry point for political links sync.
 */
export async function syncPoliticalLinks(): Promise<void> {
  await runSyncJob('political-links', syncPoliticalLinksJob);
}
