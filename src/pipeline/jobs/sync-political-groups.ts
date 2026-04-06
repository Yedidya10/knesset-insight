import { eq } from 'drizzle-orm';
import { db } from '../../lib/db';
import {
  factions,
  politicalGroups,
  politicalGroupLineage,
  factionCompositionHistory,
  politicalParties,
} from '../../lib/db/schema';
import { runSyncJob, type SyncCheckpoint } from '../utils';
import * as fs from 'fs';
import * as path from 'path';

interface SeedGroup {
  slug: string;
  canonicalName: string;
  shortName?: string;
  color?: string;
  logoUrl?: string;
  foundedYear?: number;
  dissolvedYear?: number;
  isActive: boolean;
}

interface SeedFactionGroupLink {
  factionKnessetId: number;
  groupSlug: string;
}

interface SeedLineage {
  source: string;
  target: string;
  type: string;
  knessetNum?: number;
  year?: number;
  notes?: string;
}

interface SeedData {
  groups: SeedGroup[];
  factionGroupLinks: SeedFactionGroupLink[];
  lineage: SeedLineage[];
}

/**
 * Upsert political groups, link factions to groups, and populate lineage.
 */
async function syncPoliticalGroupsJob(_prevCheckpoint: SyncCheckpoint | null): Promise<number> {
  const seedPath = path.resolve(
    process.cwd(),
    'src/pipeline/seed/political-groups.json',
  );

  if (!fs.existsSync(seedPath)) {
    console.warn('  [groups] Seed file not found, skipping');
    return 0;
  }

  const seedData: SeedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
  let count = 0;

  // 1. Upsert political groups
  for (const group of seedData.groups) {
    await db
      .insert(politicalGroups)
      .values({
        slug: group.slug,
        canonicalName: group.canonicalName,
        shortName: group.shortName ?? null,
        color: group.color ?? null,
        logoUrl: group.logoUrl ?? null,
        foundedYear: group.foundedYear ?? null,
        dissolvedYear: group.dissolvedYear ?? null,
        isActive: group.isActive,
      })
      .onConflictDoNothing();
    count++;
  }

  // Build lookup maps
  const allGroups = await db
    .select({ id: politicalGroups.id, slug: politicalGroups.slug })
    .from(politicalGroups);
  const groupBySlug = new Map(allGroups.map((g) => [g.slug, g.id]));

  const allFactions = await db
    .select({ id: factions.id, knessetId: factions.knessetId })
    .from(factions);
  const factionByKnessetId = new Map(allFactions.map((f) => [f.knessetId, f.id]));

  // 2. Link factions → political groups (FK update)
  for (const link of seedData.factionGroupLinks) {
    const factionDbId = factionByKnessetId.get(link.factionKnessetId);
    const groupDbId = groupBySlug.get(link.groupSlug);

    if (!factionDbId) {
      console.warn(`  [groups] Faction not found: KnessetID ${link.factionKnessetId}`);
      continue;
    }
    if (!groupDbId) {
      console.warn(`  [groups] Group not found: ${link.groupSlug}`);
      continue;
    }

    await db
      .update(factions)
      .set({ politicalGroupId: groupDbId, updatedAt: new Date() })
      .where(eq(factions.id, factionDbId));
    count++;
  }

  // 3. Populate lineage
  for (const entry of seedData.lineage) {
    const sourceId = groupBySlug.get(entry.source);
    const targetId = groupBySlug.get(entry.target);

    if (!sourceId) {
      console.warn(`  [groups] Source group not found: ${entry.source}`);
      continue;
    }
    if (!targetId) {
      console.warn(`  [groups] Target group not found: ${entry.target}`);
      continue;
    }

    await db
      .insert(politicalGroupLineage)
      .values({
        sourceGroupId: sourceId,
        targetGroupId: targetId,
        relationshipType: entry.type,
        knessetNum: entry.knessetNum ?? null,
        year: entry.year ?? null,
        notes: entry.notes ?? null,
      })
      .onConflictDoNothing();
    count++;
  }

  return count;
}

/**
 * Entry point for political groups sync.
 */
export async function syncPoliticalGroups(): Promise<void> {
  await runSyncJob('political-groups', syncPoliticalGroupsJob);
}
