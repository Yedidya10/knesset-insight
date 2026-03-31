import { z } from 'zod/v4';
import { eq, desc, sql, ilike } from 'drizzle-orm';
import { router, publicProcedure } from '../trpc';
import { db } from '../../lib/db';
import { bills, billInitiators, members, votes } from '../../lib/db/schema';

export const billsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
        search: z.string().optional(),
        status: z.string().optional(),
        billType: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const { page, pageSize, search, status, billType } = input;
      const offset = (page - 1) * pageSize;

      let query = db
        .select({
          id: bills.id,
          knessetId: bills.knessetId,
          name: bills.name,
          summary: bills.summary,
          status: bills.status,
          billType: bills.billType,
          proposedDate: bills.proposedDate,
          category: bills.category,
        })
        .from(bills)
        .$dynamic();

      if (search) {
        query = query.where(ilike(bills.name, `%${search}%`)) as typeof query;
      }
      if (status) {
        query = query.where(eq(bills.status, status)) as typeof query;
      }
      if (billType) {
        query = query.where(eq(bills.billType, billType)) as typeof query;
      }

      const [data, countResult] = await Promise.all([
        query.orderBy(desc(bills.proposedDate)).limit(pageSize).offset(offset),
        db.select({ count: sql<number>`count(*)::int` }).from(bills),
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
        .select()
        .from(bills)
        .where(eq(bills.id, input.id))
        .limit(1);

      if (!result[0]) return null;

      const initiators = await db
        .select({
          memberId: members.id,
          firstName: members.firstName,
          lastName: members.lastName,
          imageUrl: members.imageUrl,
          isPrimary: billInitiators.isPrimary,
        })
        .from(billInitiators)
        .innerJoin(members, eq(billInitiators.memberId, members.id))
        .where(eq(billInitiators.billId, input.id));

      const relatedVotes = await db
        .select({
          id: votes.id,
          title: votes.title,
          voteDate: votes.voteDate,
          isAccepted: votes.isAccepted,
          forCount: votes.forCount,
          againstCount: votes.againstCount,
        })
        .from(votes)
        .where(eq(votes.billId, input.id))
        .orderBy(desc(votes.voteDate));

      return { ...result[0], initiators, relatedVotes };
    }),
});
