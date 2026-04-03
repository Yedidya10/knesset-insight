import { z } from 'zod/v4';
import { eq, sql } from 'drizzle-orm';
import { router, publicProcedure } from '../trpc';
import { db } from '../../lib/db';
import { factions, members } from '../../lib/db/schema';

export const factionsRouter = router({
  list: publicProcedure.query(async () => {
    return db
      .select({
        id: factions.id,
        knessetId: factions.knessetId,
        name: factions.name,
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
      })
      .from(factions)
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
