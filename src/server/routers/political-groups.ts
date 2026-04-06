import { z } from 'zod/v4';
import { eq, sql } from 'drizzle-orm';
import { router, publicProcedure } from '../trpc';
import { db } from '../../lib/db';
import {
  politicalGroups,
  politicalGroupLineage,
  factions,
  factionCompositionHistory,
  politicalParties,
} from '../../lib/db/schema';

export const politicalGroupsRouter = router({
  /** All political groups with faction count per group */
  list: publicProcedure.query(async () => {
    return db
      .select({
        id: politicalGroups.id,
        slug: politicalGroups.slug,
        canonicalName: politicalGroups.canonicalName,
        shortName: politicalGroups.shortName,
        color: politicalGroups.color,
        logoUrl: politicalGroups.logoUrl,
        foundedYear: politicalGroups.foundedYear,
        dissolvedYear: politicalGroups.dissolvedYear,
        isActive: politicalGroups.isActive,
        factionCount: sql<number>`(
          select count(*)::int from factions
          where factions.political_group_id = ${politicalGroups.id}
        )`,
      })
      .from(politicalGroups)
      .orderBy(politicalGroups.canonicalName);
  }),

  /** Single group with all related factions + lineage */
  bySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const group = await db
        .select()
        .from(politicalGroups)
        .where(eq(politicalGroups.slug, input.slug))
        .limit(1);

      if (!group[0]) return null;

      const groupId = group[0].id;

      const groupFactions = await db
        .select({
          id: factions.id,
          knessetId: factions.knessetId,
          name: factions.name,
          knessetNum: factions.knessetNum,
          seats: factions.seats,
          isCoalition: factions.isCoalition,
          startDate: factions.startDate,
          finishDate: factions.finishDate,
          isCurrent: factions.isCurrent,
        })
        .from(factions)
        .where(eq(factions.politicalGroupId, groupId))
        .orderBy(factions.knessetNum);

      const lineageFrom = await db
        .select({
          id: politicalGroupLineage.id,
          targetGroupId: politicalGroupLineage.targetGroupId,
          targetSlug: sql<string>`(select slug from political_groups where id = ${politicalGroupLineage.targetGroupId})`,
          targetName: sql<string>`(select canonical_name from political_groups where id = ${politicalGroupLineage.targetGroupId})`,
          relationshipType: politicalGroupLineage.relationshipType,
          knessetNum: politicalGroupLineage.knessetNum,
          year: politicalGroupLineage.year,
          notes: politicalGroupLineage.notes,
        })
        .from(politicalGroupLineage)
        .where(eq(politicalGroupLineage.sourceGroupId, groupId));

      const lineageTo = await db
        .select({
          id: politicalGroupLineage.id,
          sourceGroupId: politicalGroupLineage.sourceGroupId,
          sourceSlug: sql<string>`(select slug from political_groups where id = ${politicalGroupLineage.sourceGroupId})`,
          sourceName: sql<string>`(select canonical_name from political_groups where id = ${politicalGroupLineage.sourceGroupId})`,
          relationshipType: politicalGroupLineage.relationshipType,
          knessetNum: politicalGroupLineage.knessetNum,
          year: politicalGroupLineage.year,
          notes: politicalGroupLineage.notes,
        })
        .from(politicalGroupLineage)
        .where(eq(politicalGroupLineage.targetGroupId, groupId));

      return {
        ...group[0],
        factions: groupFactions,
        lineageFrom,
        lineageTo,
      };
    }),

  /** Full lineage graph for visualization */
  graph: publicProcedure.query(async () => {
    const groups = await db
      .select({
        id: politicalGroups.id,
        slug: politicalGroups.slug,
        canonicalName: politicalGroups.canonicalName,
        shortName: politicalGroups.shortName,
        color: politicalGroups.color,
        foundedYear: politicalGroups.foundedYear,
        dissolvedYear: politicalGroups.dissolvedYear,
        isActive: politicalGroups.isActive,
      })
      .from(politicalGroups);

    const edges = await db
      .select({
        id: politicalGroupLineage.id,
        sourceGroupId: politicalGroupLineage.sourceGroupId,
        targetGroupId: politicalGroupLineage.targetGroupId,
        relationshipType: politicalGroupLineage.relationshipType,
        knessetNum: politicalGroupLineage.knessetNum,
        year: politicalGroupLineage.year,
      })
      .from(politicalGroupLineage);

    return { nodes: groups, edges };
  }),

  /** Timeline data: groups across Knesset terms */
  timeline: publicProcedure.query(async () => {
    const groups = await db
      .select({
        id: politicalGroups.id,
        slug: politicalGroups.slug,
        canonicalName: politicalGroups.canonicalName,
        shortName: politicalGroups.shortName,
        color: politicalGroups.color,
        isActive: politicalGroups.isActive,
      })
      .from(politicalGroups);

    // For each group, get the knesset numbers where they had factions
    const groupTerms = await db
      .select({
        politicalGroupId: factions.politicalGroupId,
        knessetNum: factions.knessetNum,
        name: factions.name,
        seats: factions.seats,
        isCoalition: factions.isCoalition,
      })
      .from(factions)
      .where(sql`${factions.politicalGroupId} is not null`)
      .orderBy(factions.knessetNum);

    return { groups, terms: groupTerms };
  }),
});
