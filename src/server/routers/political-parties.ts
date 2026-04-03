import { z } from 'zod/v4';
import { eq, sql, like, and } from 'drizzle-orm';
import { router, publicProcedure } from '../trpc';
import { db } from '../../lib/db';
import {
  politicalParties,
  partyFinancialReports,
  partyFactionLinks,
  factions,
  electoralListParties,
  electoralLists,
} from '../../lib/db/schema';

export const politicalPartiesRouter = router({
  list: publicProcedure
    .input(
      z.object({
        search: z.string().optional(),
        type: z.enum(['party', 'movement']).optional(),
        isActive: z.boolean().optional(),
      }).optional(),
    )
    .query(async ({ input }) => {
      const conditions = [];

      if (input?.search) {
        conditions.push(like(politicalParties.name, `%${input.search}%`));
      }
      if (input?.type) {
        conditions.push(eq(politicalParties.type, input.type));
      }
      if (input?.isActive !== undefined) {
        conditions.push(eq(politicalParties.isActive, input.isActive));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      return db
        .select({
          id: politicalParties.id,
          registrarNumber: politicalParties.registrarNumber,
          name: politicalParties.name,
          nameEn: politicalParties.nameEn,
          type: politicalParties.type,
          registrationYear: politicalParties.registrationYear,
          isActive: politicalParties.isActive,
          linkedFactionCount: sql<number>`(
            select count(*)::int from party_faction_links
            where party_faction_links.party_id = ${politicalParties.id}
          )`,
        })
        .from(politicalParties)
        .where(where)
        .orderBy(politicalParties.name);
    }),

  byId: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const party = await db
        .select()
        .from(politicalParties)
        .where(eq(politicalParties.id, input.id))
        .limit(1);

      if (!party[0]) return null;

      // Fetch financial reports
      const reports = await db
        .select()
        .from(partyFinancialReports)
        .where(eq(partyFinancialReports.partyId, input.id))
        .orderBy(sql`${partyFinancialReports.year} desc`);

      // Fetch linked factions
      const linkedFactions = await db
        .select({
          id: factions.id,
          name: factions.name,
          knessetNum: factions.knessetNum,
          isCurrent: factions.isCurrent,
        })
        .from(partyFactionLinks)
        .innerJoin(factions, eq(partyFactionLinks.factionId, factions.id))
        .where(eq(partyFactionLinks.partyId, input.id));

      // Fetch linked electoral lists
      const linkedLists = await db
        .select({
          id: electoralLists.id,
          name: electoralLists.name,
          ballotLetters: electoralLists.ballotLetters,
          knessetNum: electoralLists.knessetNum,
          seats: electoralLists.seats,
        })
        .from(electoralListParties)
        .innerJoin(
          electoralLists,
          eq(electoralListParties.electoralListId, electoralLists.id),
        )
        .where(eq(electoralListParties.partyId, input.id));

      return {
        ...party[0],
        financialReports: reports,
        linkedFactions,
        linkedElectoralLists: linkedLists,
      };
    }),
});
