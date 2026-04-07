import { z } from 'zod/v4';
import { eq, desc, asc, sql, ilike, and, gte, lte } from 'drizzle-orm';
import { router, publicProcedure } from '../trpc';
import { db } from '../../lib/db';
import { votes, memberVotes, members, factions, bills, billClusters } from '../../lib/db/schema';

export const votesRouter = router({
  list: publicProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
        search: z.string().optional(),
        isAccepted: z.boolean().optional(),
        knessetNum: z.number().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        sortBy: z.enum(['dateDesc', 'dateAsc', 'mostVotes', 'mostControversial']).default('dateDesc'),
      }),
    )
    .query(async ({ input }) => {
      const { page, pageSize, search, isAccepted, knessetNum, dateFrom, dateTo, sortBy } = input;
      const offset = (page - 1) * pageSize;

      const conditions = [];
      if (search) {
        conditions.push(ilike(votes.title, `%${search}%`));
      }
      if (isAccepted !== undefined) {
        conditions.push(eq(votes.isAccepted, isAccepted));
      }
      if (knessetNum !== undefined) {
        conditions.push(eq(votes.knessetNum, knessetNum));
      }
      if (dateFrom) {
        conditions.push(gte(votes.voteDate, new Date(dateFrom)));
      }
      if (dateTo) {
        conditions.push(lte(votes.voteDate, new Date(dateTo)));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      let orderByClause;
      switch (sortBy) {
        case 'dateAsc':
          orderByClause = asc(votes.voteDate);
          break;
        case 'mostVotes':
          orderByClause = desc(sql`${votes.forCount} + ${votes.againstCount} + ${votes.abstainCount}`);
          break;
        case 'mostControversial':
          orderByClause = asc(sql`abs(${votes.forCount} - ${votes.againstCount})`);
          break;
        default:
          orderByClause = desc(votes.voteDate);
      }

      const [data, countResult] = await Promise.all([
        db
          .select({
            id: votes.id,
            knessetId: votes.knessetId,
            title: votes.title,
            voteDate: votes.voteDate,
            voteType: votes.voteType,
            knessetNum: votes.knessetNum,
            sessItemId: votes.sessItemId,
            forCount: votes.forCount,
            againstCount: votes.againstCount,
            abstainCount: votes.abstainCount,
            isAccepted: votes.isAccepted,
          })
          .from(votes)
          .where(whereClause)
          .orderBy(orderByClause)
          .limit(pageSize)
          .offset(offset),
        db.select({ count: sql<number>`count(*)::int` }).from(votes).where(whereClause),
      ]);

      return {
        items: data,
        total: countResult[0]?.count ?? 0,
        page,
        pageSize,
        totalPages: Math.ceil((countResult[0]?.count ?? 0) / pageSize),
      };
    }),

  byId: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const result = await db
        .select({
          id: votes.id,
          knessetId: votes.knessetId,
          title: votes.title,
          voteDate: votes.voteDate,
          voteType: votes.voteType,
          knessetNum: votes.knessetNum,
          sessionId: votes.sessionId,
          sessItemId: votes.sessItemId,
          forCount: votes.forCount,
          againstCount: votes.againstCount,
          abstainCount: votes.abstainCount,
          isAccepted: votes.isAccepted,
          summary: votes.summary,
          billId: votes.billId,
          billName: bills.name,
          billStage: votes.billStage,
          billClusterId: bills.clusterId,
        })
        .from(votes)
        .leftJoin(bills, eq(votes.billId, bills.id))
        .where(eq(votes.id, input.id))
        .limit(1);

      if (!result[0]) return null;

      // Fetch related votes (same sessItemId)
      let relatedVotes: { id: number; title: string; isAccepted: boolean | null; forCount: number | null; againstCount: number | null }[] = [];
      if (result[0].sessItemId) {
        relatedVotes = await db
          .select({
            id: votes.id,
            title: votes.title,
            isAccepted: votes.isAccepted,
            forCount: votes.forCount,
            againstCount: votes.againstCount,
          })
          .from(votes)
          .where(
            and(
              eq(votes.sessItemId, result[0].sessItemId),
              sql`${votes.id} != ${input.id}`,
            ),
          )
          .orderBy(desc(votes.voteDate));
      }

      // Cluster context
      let clusterInfo: { id: number; name: string } | null = null;
      if (result[0].billClusterId) {
        const [clusterRow] = await db
          .select({ id: billClusters.id, name: billClusters.name })
          .from(billClusters)
          .where(eq(billClusters.id, result[0].billClusterId))
          .limit(1);
        if (clusterRow) clusterInfo = clusterRow;
      }

      return { ...result[0], relatedVotes, cluster: clusterInfo };
    }),

  memberVotes: publicProcedure
    .input(z.object({ voteId: z.number() }))
    .query(async ({ input }) => {
      return db
        .select({
          memberId: members.id,
          firstName: members.firstName,
          lastName: members.lastName,
          imageUrl: members.imageUrl,
          voteValue: memberVotes.voteValue,
          factionName: factions.name,
          isCoalition: factions.isCoalition,
        })
        .from(memberVotes)
        .innerJoin(members, eq(memberVotes.memberId, members.id))
        .leftJoin(factions, eq(members.factionId, factions.id))
        .where(eq(memberVotes.voteId, input.voteId));
    }),

  factionBreakdown: publicProcedure
    .input(z.object({ voteId: z.number() }))
    .query(async ({ input }) => {
      return db
        .select({
          factionName: factions.name,
          factionColor: factions.color,
          isCoalition: factions.isCoalition,
          forCount: sql<number>`count(*) filter (where ${memberVotes.voteValue} = 'for')::int`,
          againstCount: sql<number>`count(*) filter (where ${memberVotes.voteValue} = 'against')::int`,
          abstainCount: sql<number>`count(*) filter (where ${memberVotes.voteValue} = 'abstain')::int`,
          absentCount: sql<number>`count(*) filter (where ${memberVotes.voteValue} = 'absent')::int`,
        })
        .from(memberVotes)
        .innerJoin(members, eq(memberVotes.memberId, members.id))
        .innerJoin(factions, eq(members.factionId, factions.id))
        .where(eq(memberVotes.voteId, input.voteId))
        .groupBy(factions.name, factions.color, factions.isCoalition);
    }),
});
