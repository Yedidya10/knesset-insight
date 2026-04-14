import { z } from 'zod/v4';
import { eq, sql, desc, and } from 'drizzle-orm';
import { router, publicProcedure } from '../trpc';
import { db } from '../../lib/db';
import {
  governments,
  governmentPositions,
  govMinistries,
  members,
  factions,
  factionCoalitionPeriods,
} from '../../lib/db/schema';

export const governmentsRouter = router({
  list: publicProcedure
    .input(
      z
        .object({
          knessetNum: z.number().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const conditions = input?.knessetNum
        ? eq(governments.knessetNum, input.knessetNum)
        : undefined;

      const rows = await db
        .select({
          id: governments.id,
          governmentNum: governments.governmentNum,
          knessetNum: governments.knessetNum,
          name: governments.name,
          startDate: governments.startDate,
          endDate: governments.endDate,
          pmMemberId: governments.pmMemberId,
          pmFirstName: members.firstName,
          pmLastName: members.lastName,
          pmImageUrl: members.imageUrl,
          ministerCount: sql<number>`(
            select count(distinct gp.member_knesset_id)::int
            from government_positions gp
            where gp.government_id = ${governments.id}
          )`,
          coalitionFactionCount: sql<number>`(
            select count(distinct fcp.faction_id)::int
            from faction_coalition_periods fcp
            where fcp.government_num = ${governments.governmentNum}
              and fcp.knesset_num = ${governments.knessetNum}
          )`,
        })
        .from(governments)
        .leftJoin(members, eq(governments.pmMemberId, members.id))
        .where(conditions)
        .orderBy(desc(governments.governmentNum));

      return rows;
    }),

  byId: publicProcedure
    .input(z.object({ governmentNum: z.number() }))
    .query(async ({ input }) => {
      // 1. Get government record
      const gov = await db
        .select()
        .from(governments)
        .where(eq(governments.governmentNum, input.governmentNum))
        .limit(1);

      if (!gov[0]) return null;

      const govRecord = gov[0];

      // 2. Get PM info
      let pmInfo = null;
      if (govRecord.pmMemberId) {
        const pm = await db
          .select({
            id: members.id,
            firstName: members.firstName,
            lastName: members.lastName,
            imageUrl: members.imageUrl,
          })
          .from(members)
          .where(eq(members.id, govRecord.pmMemberId))
          .limit(1);
        pmInfo = pm[0] ?? null;
      }

      // 3. Get alternate PM info
      let alternatePmInfo = null;
      if (govRecord.alternatePmMemberId) {
        const altPm = await db
          .select({
            id: members.id,
            firstName: members.firstName,
            lastName: members.lastName,
            imageUrl: members.imageUrl,
          })
          .from(members)
          .where(eq(members.id, govRecord.alternatePmMemberId))
          .limit(1);
        alternatePmInfo = altPm[0] ?? null;
      }

      // 4. Get all positions with member and ministry info
      const positions = await db
        .select({
          id: governmentPositions.id,
          memberKnessetId: governmentPositions.memberKnessetId,
          positionId: governmentPositions.positionId,
          positionDesc: governmentPositions.positionDesc,
          factionKnessetId: governmentPositions.factionKnessetId,
          startDate: governmentPositions.startDate,
          endDate: governmentPositions.endDate,
          isCurrent: governmentPositions.isCurrent,
          memberId: members.id,
          memberFirstName: members.firstName,
          memberLastName: members.lastName,
          memberImageUrl: members.imageUrl,
          ministryId: govMinistries.id,
          ministryKnessetId: govMinistries.knessetId,
          ministryName: govMinistries.name,
        })
        .from(governmentPositions)
        .leftJoin(members, eq(governmentPositions.memberId, members.id))
        .leftJoin(
          govMinistries,
          eq(governmentPositions.govMinistryId, govMinistries.id),
        )
        .where(eq(governmentPositions.governmentId, govRecord.id))
        .orderBy(governmentPositions.positionId, governmentPositions.startDate);

      // 5. Get coalition factions
      const coalitionFactions = await db
        .select({
          factionId: factions.id,
          factionName: factions.name,
          factionSeats: factions.seats,
          factionColor: factions.color,
          factionLogoUrl: factions.logoUrl,
          periodStart: factionCoalitionPeriods.startDate,
          periodEnd: factionCoalitionPeriods.endDate,
        })
        .from(factionCoalitionPeriods)
        .innerJoin(factions, eq(factionCoalitionPeriods.factionId, factions.id))
        .where(
          and(
            eq(factionCoalitionPeriods.governmentNum, input.governmentNum),
            eq(factionCoalitionPeriods.knessetNum, govRecord.knessetNum),
          ),
        );

      return {
        ...govRecord,
        pm: pmInfo,
        alternatePm: alternatePmInfo,
        positions,
        coalitionFactions,
      };
    }),
});
