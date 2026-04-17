import { z } from 'zod/v4';
import { eq, sql, and } from 'drizzle-orm';
import { router, publicProcedure } from '../trpc';
import { db } from '../../lib/db';
import { factions, members, politicalGroups } from '../../lib/db/schema';

/**
 * SQL condition that excludes superseded factions — those with a finish_date
 * where another faction in the same knesset with the same political_group_id
 * is still active. e.g. "הציונות הדתית" (5 days) → "הציונות הדתית בראשות בצלאל סמוטריץ'".
 */
const notSuperseded = sql`NOT (
  ${factions.finishDate} IS NOT NULL
  AND ${factions.politicalGroupId} IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM factions f2
    WHERE f2.political_group_id = ${factions.politicalGroupId}
      AND f2.knesset_num = ${factions.knessetNum}
      AND f2.id != ${factions.id}
      AND f2.finish_date IS NULL
  )
)`;

export const factionsRouter = router({
  list: publicProcedure.query(async () => {
    return db
      .select({
        id: factions.id,
        knessetId: factions.knessetId,
        name: factions.name,
        knessetNum: factions.knessetNum,
        isCoalition: factions.isCoalition,
        seats: factions.seats,
        color: factions.color,
        logoUrl: factions.logoUrl,
        startDate: factions.startDate,
        finishDate: factions.finishDate,
        isCurrent: factions.isCurrent,
        memberCount: sql<number>`(
          select count(*)::int from members
          where members.faction_id = ${factions.id} and members.is_current = true
        )`,
        politicalGroupId: factions.politicalGroupId,
        politicalGroupSlug: politicalGroups.slug,
        politicalGroupName: politicalGroups.canonicalName,
        politicalGroupColor: politicalGroups.color,
      })
      .from(factions)
      .leftJoin(
        politicalGroups,
        eq(factions.politicalGroupId, politicalGroups.id),
      )
      .where(notSuperseded)
      .orderBy(factions.name);
  }),

  byId: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const faction = await db
        .select()
        .from(factions)
        .where(eq(factions.id, input.id))
        .limit(1);

      if (!faction[0]) return null;

      const factionMembers = await db
        .select({
          id: members.id,
          firstName: members.firstName,
          lastName: members.lastName,
          imageUrl: members.imageUrl,
          isCurrent: members.isCurrent,
        })
        .from(members)
        .where(eq(members.factionId, input.id));

      return { ...faction[0], members: factionMembers };
    }),
});
