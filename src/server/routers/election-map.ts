import { z } from 'zod/v4';
import { eq, sql, desc, and } from 'drizzle-orm';
import { router, publicProcedure } from '../trpc';
import { db } from '../../lib/db';
import {
  electionCityResults,
  electionCityPartyResults,
} from '../../lib/db/schema';
import { appConfig } from '../../../app.config';

export const electionMapRouter = router({
  /** Available knesset numbers that have city-level data */
  availableKnessets: publicProcedure.query(async () => {
    const rows = await db
      .selectDistinct({ knessetNum: electionCityResults.knessetNum })
      .from(electionCityResults)
      .orderBy(desc(electionCityResults.knessetNum));
    return rows.map((r) => r.knessetNum);
  }),

  /** National summary for a given knesset */
  nationalSummary: publicProcedure
    .input(z.object({ knessetNum: z.number().int().min(1) }))
    .query(async ({ input }) => {
      const [summary] = await db
        .select({
          totalEligible: sql<number>`SUM(${electionCityResults.eligibleVoters})::int`,
          totalVoters: sql<number>`SUM(${electionCityResults.actualVoters})::int`,
          totalValid: sql<number>`SUM(${electionCityResults.validVotes})::int`,
          totalInvalid: sql<number>`SUM(${electionCityResults.invalidVotes})::int`,
          cityCount: sql<number>`COUNT(*)::int`,
        })
        .from(electionCityResults)
        .where(eq(electionCityResults.knessetNum, input.knessetNum));

      // Top parties nationally
      const topParties = await db
        .select({
          ballotLetters: electionCityPartyResults.ballotLetters,
          partyName: electionCityPartyResults.partyName,
          totalVotes: sql<number>`SUM(${electionCityPartyResults.votes})::int`,
        })
        .from(electionCityPartyResults)
        .innerJoin(
          electionCityResults,
          eq(electionCityPartyResults.cityResultId, electionCityResults.id),
        )
        .where(eq(electionCityResults.knessetNum, input.knessetNum))
        .groupBy(
          electionCityPartyResults.ballotLetters,
          electionCityPartyResults.partyName,
        )
        .orderBy(desc(sql`SUM(${electionCityPartyResults.votes})`))
        .limit(10);

      const turnout =
        summary?.totalEligible && summary.totalEligible > 0
          ? ((summary.totalVoters / summary.totalEligible) * 100).toFixed(2)
          : '0';

      return {
        totalEligible: summary?.totalEligible ?? 0,
        totalVoters: summary?.totalVoters ?? 0,
        totalValid: summary?.totalValid ?? 0,
        totalInvalid: summary?.totalInvalid ?? 0,
        turnoutPercent: parseFloat(turnout),
        cityCount: summary?.cityCount ?? 0,
        topParties: topParties.map((p) => ({
          ballotLetters: p.ballotLetters,
          partyName: p.partyName,
          votes: p.totalVotes,
          percent:
            summary?.totalValid && summary.totalValid > 0
              ? parseFloat(
                  ((p.totalVotes / summary.totalValid) * 100).toFixed(2),
                )
              : 0,
        })),
      };
    }),

  /** All city results for a given knesset (used for city detail panel) */
  cityResults: publicProcedure
    .input(z.object({ knessetNum: z.number().int().min(1) }))
    .query(async ({ input }) => {
      const cities = await db
        .select({
          cityCode: electionCityResults.cityCode,
          cityName: electionCityResults.cityName,
          districtCode: electionCityResults.districtCode,
          eligibleVoters: electionCityResults.eligibleVoters,
          actualVoters: electionCityResults.actualVoters,
          validVotes: electionCityResults.validVotes,
          turnoutPercent: electionCityResults.turnoutPercent,
        })
        .from(electionCityResults)
        .where(eq(electionCityResults.knessetNum, input.knessetNum));

      return cities.map((c) => ({
        ...c,
        turnoutPercent: c.turnoutPercent ? parseFloat(c.turnoutPercent) : 0,
      }));
    }),

  /** District-level aggregated results for map rendering */
  districtResults: publicProcedure
    .input(z.object({ knessetNum: z.number().int().min(1) }))
    .query(async ({ input }) => {
      const districts = await db
        .select({
          districtCode: electionCityResults.districtCode,
          eligibleVoters: sql<number>`SUM(${electionCityResults.eligibleVoters})::int`,
          actualVoters: sql<number>`SUM(${electionCityResults.actualVoters})::int`,
          validVotes: sql<number>`SUM(${electionCityResults.validVotes})::int`,
          cityCount: sql<number>`COUNT(*)::int`,
        })
        .from(electionCityResults)
        .where(
          and(
            eq(electionCityResults.knessetNum, input.knessetNum),
            sql`${electionCityResults.districtCode} IS NOT NULL`,
          ),
        )
        .groupBy(electionCityResults.districtCode);

      return districts.map((d) => ({
        districtCode: String(d.districtCode),
        eligibleVoters: d.eligibleVoters,
        actualVoters: d.actualVoters,
        validVotes: d.validVotes,
        cityCount: d.cityCount,
        turnoutPercent:
          d.eligibleVoters > 0
            ? parseFloat(((d.actualVoters / d.eligibleVoters) * 100).toFixed(2))
            : 0,
      }));
    }),

  /** Detailed results for a specific district or city in a specific knesset */
  cityDetail: publicProcedure
    .input(
      z.object({
        knessetNum: z.number().int().min(1),
        cityCode: z.string().min(1),
        isDistrict: z.boolean().optional(),
      }),
    )
    .query(async ({ input }) => {
      if (input.isDistrict) {
        // Aggregate all cities within the district
        const districtCode = parseInt(input.cityCode, 10);
        const [summary] = await db
          .select({
            eligibleVoters: sql<number>`SUM(${electionCityResults.eligibleVoters})::int`,
            actualVoters: sql<number>`SUM(${electionCityResults.actualVoters})::int`,
            validVotes: sql<number>`SUM(${electionCityResults.validVotes})::int`,
            invalidVotes: sql<number>`SUM(${electionCityResults.invalidVotes})::int`,
          })
          .from(electionCityResults)
          .where(
            and(
              eq(electionCityResults.knessetNum, input.knessetNum),
              eq(electionCityResults.districtCode, districtCode),
            ),
          );

        if (!summary) return null;

        const turnout =
          summary.eligibleVoters > 0
            ? parseFloat(
                ((summary.actualVoters / summary.eligibleVoters) * 100).toFixed(
                  2,
                ),
              )
            : 0;

        // Get party votes aggregated across all cities in the district
        const parties = await db
          .select({
            ballotLetters: electionCityPartyResults.ballotLetters,
            partyName: electionCityPartyResults.partyName,
            votes: sql<number>`SUM(${electionCityPartyResults.votes})::int`,
          })
          .from(electionCityPartyResults)
          .innerJoin(
            electionCityResults,
            eq(electionCityPartyResults.cityResultId, electionCityResults.id),
          )
          .where(
            and(
              eq(electionCityResults.knessetNum, input.knessetNum),
              eq(electionCityResults.districtCode, districtCode),
            ),
          )
          .groupBy(
            electionCityPartyResults.ballotLetters,
            electionCityPartyResults.partyName,
          )
          .orderBy(desc(sql`SUM(${electionCityPartyResults.votes})`))
          .limit(15);

        return {
          cityCode: input.cityCode,
          cityName: '', // Display name is set by the client from TopoJSON
          eligibleVoters: summary.eligibleVoters,
          actualVoters: summary.actualVoters,
          validVotes: summary.validVotes,
          invalidVotes: summary.invalidVotes,
          turnoutPercent: turnout,
          parties: parties.map((p) => ({
            ballotLetters: p.ballotLetters,
            partyName: p.partyName,
            votes: p.votes,
            votePercent:
              summary.validVotes > 0
                ? parseFloat(((p.votes / summary.validVotes) * 100).toFixed(2))
                : 0,
          })),
        };
      }

      // Original city-level detail
      const [city] = await db
        .select()
        .from(electionCityResults)
        .where(
          and(
            eq(electionCityResults.knessetNum, input.knessetNum),
            eq(electionCityResults.cityCode, input.cityCode),
          ),
        )
        .limit(1);

      if (!city) return null;

      const parties = await db
        .select({
          ballotLetters: electionCityPartyResults.ballotLetters,
          partyName: electionCityPartyResults.partyName,
          votes: electionCityPartyResults.votes,
          votePercent: electionCityPartyResults.votePercent,
        })
        .from(electionCityPartyResults)
        .where(eq(electionCityPartyResults.cityResultId, city.id))
        .orderBy(desc(electionCityPartyResults.votes));

      return {
        cityCode: city.cityCode,
        cityName: city.cityName,
        eligibleVoters: city.eligibleVoters,
        actualVoters: city.actualVoters,
        validVotes: city.validVotes,
        invalidVotes: city.invalidVotes,
        turnoutPercent: city.turnoutPercent
          ? parseFloat(city.turnoutPercent)
          : 0,
        parties: parties.map((p) => ({
          ...p,
          votePercent: p.votePercent ? parseFloat(p.votePercent) : 0,
        })),
      };
    }),

  /** City trends across all available knessets */
  cityTrends: publicProcedure
    .input(z.object({ cityCode: z.string().min(1) }))
    .query(async ({ input }) => {
      const results = await db
        .select({
          knessetNum: electionCityResults.knessetNum,
          eligibleVoters: electionCityResults.eligibleVoters,
          actualVoters: electionCityResults.actualVoters,
          turnoutPercent: electionCityResults.turnoutPercent,
        })
        .from(electionCityResults)
        .where(eq(electionCityResults.cityCode, input.cityCode))
        .orderBy(electionCityResults.knessetNum);

      return results.map((r) => ({
        knessetNum: r.knessetNum,
        eligibleVoters: r.eligibleVoters,
        actualVoters: r.actualVoters,
        turnoutPercent: r.turnoutPercent ? parseFloat(r.turnoutPercent) : 0,
      }));
    }),
});
