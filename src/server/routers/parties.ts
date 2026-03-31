import { z } from 'zod/v4';
import { eq, sql } from 'drizzle-orm';
import { router, publicProcedure } from '../trpc';
import { db } from '../../lib/db';
import { parties, members } from '../../lib/db/schema';

export const partiesRouter = router({
  list: publicProcedure.query(async () => {
    return db
      .select({
        id: parties.id,
        knessetId: parties.knessetId,
        name: parties.name,
        isCoalition: parties.isCoalition,
        seats: parties.seats,
        color: parties.color,
        logoUrl: parties.logoUrl,
        memberCount: sql<number>`(
          select count(*)::int from members
          where members.party_id = ${parties.id} and members.is_current = true
        )`,
      })
      .from(parties)
      .orderBy(parties.name);
  }),

  byId: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const party = await db
        .select()
        .from(parties)
        .where(eq(parties.id, input.id))
        .limit(1);

      if (!party[0]) return null;

      const partyMembers = await db
        .select({
          id: members.id,
          firstName: members.firstName,
          lastName: members.lastName,
          imageUrl: members.imageUrl,
          isCurrent: members.isCurrent,
          isCoalition: members.isCoalition,
        })
        .from(members)
        .where(eq(members.partyId, input.id));

      return { ...party[0], members: partyMembers };
    }),
});
