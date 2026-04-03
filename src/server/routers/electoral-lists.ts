import { z } from 'zod/v4';
import { eq, sql } from 'drizzle-orm';
import { router, publicProcedure } from '../trpc';
import { db } from '../../lib/db';
import {
  electoralLists,
  electoralListParties,
  politicalParties,
  factions,
} from '../../lib/db/schema';

export const electoralListsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        knessetNum: z.number().optional(),
      }).optional(),
    )
    .query(async ({ input }) => {
      const query = db
        .select({
          id: electoralLists.id,
          name: electoralLists.name,
          ballotLetters: electoralLists.ballotLetters,
          knessetNum: electoralLists.knessetNum,
          totalVotes: electoralLists.totalVotes,
          votePercentage: electoralLists.votePercentage,
          seats: electoralLists.seats,
          isElected: electoralLists.isElected,
          electionDate: electoralLists.electionDate,
        })
        .from(electoralLists);

      if (input?.knessetNum) {
        return query
          .where(eq(electoralLists.knessetNum, input.knessetNum))
          .orderBy(sql`${electoralLists.seats} desc`);
      }

      return query.orderBy(sql`${electoralLists.seats} desc`);
    }),

  byId: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const list = await db
        .select()
        .from(electoralLists)
        .where(eq(electoralLists.id, input.id))
        .limit(1);

      if (!list[0]) return null;

      // Fetch component parties
      const componentParties = await db
        .select({
          id: politicalParties.id,
          name: politicalParties.name,
          registrarNumber: politicalParties.registrarNumber,
          type: politicalParties.type,
        })
        .from(electoralListParties)
        .innerJoin(
          politicalParties,
          eq(electoralListParties.partyId, politicalParties.id),
        )
        .where(eq(electoralListParties.electoralListId, input.id));

      // Fetch resulting factions
      const resultingFactions = await db
        .select({
          id: factions.id,
          name: factions.name,
          knessetNum: factions.knessetNum,
          isCoalition: factions.isCoalition,
          isCurrent: factions.isCurrent,
        })
        .from(factions)
        .where(eq(factions.electoralListId, input.id));

      return {
        ...list[0],
        componentParties,
        resultingFactions,
      };
    }),
});
