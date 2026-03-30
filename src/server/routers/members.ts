import { z } from 'zod/v4';
import { eq, desc, ilike, or, sql } from 'drizzle-orm';
import { router, publicProcedure } from '../trpc';
import { db } from '../../lib/db';
import { members, parties, memberVotes, votes } from '../../lib/db/schema';

export const membersRouter = router({
  list: publicProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
        search: z.string().optional(),
        partyId: z.number().optional(),
        isCurrent: z.boolean().optional(),
      }),
    )
    .query(async ({ input }) => {
      const { page, pageSize, search, partyId, isCurrent } = input;
      const offset = (page - 1) * pageSize;

      let query = db
        .select({
          id: members.id,
          knessetId: members.knessetId,
          firstName: members.firstName,
          lastName: members.lastName,
          isCurrent: members.isCurrent,
          imageUrl: members.imageUrl,
          knessetNum: members.knessetNum,
          isCoalition: members.isCoalition,
          partyId: members.partyId,
          partyName: parties.name,
          partyColor: parties.color,
        })
        .from(members)
        .leftJoin(parties, eq(members.partyId, parties.id))
        .$dynamic();

      const conditions = [];
      if (search) {
        conditions.push(
          or(
            ilike(members.firstName, `%${search}%`),
            ilike(members.lastName, `%${search}%`),
          ),
        );
      }
      if (partyId !== undefined) {
        conditions.push(eq(members.partyId, partyId));
      }
      if (isCurrent !== undefined) {
        conditions.push(eq(members.isCurrent, isCurrent));
      }

      if (conditions.length > 0) {
        for (const condition of conditions) {
          if (condition) query = query.where(condition) as typeof query;
        }
      }

      const [data, countResult] = await Promise.all([
        query.orderBy(members.lastName).limit(pageSize).offset(offset),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(members),
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
          id: members.id,
          knessetId: members.knessetId,
          firstName: members.firstName,
          lastName: members.lastName,
          isCurrent: members.isCurrent,
          gender: members.gender,
          birthDate: members.birthDate,
          imageUrl: members.imageUrl,
          email: members.email,
          phone: members.phone,
          startDate: members.startDate,
          endDate: members.endDate,
          knessetNum: members.knessetNum,
          isCoalition: members.isCoalition,
          partyName: parties.name,
          partyColor: parties.color,
        })
        .from(members)
        .leftJoin(parties, eq(members.partyId, parties.id))
        .where(eq(members.id, input.id))
        .limit(1);

      return result[0] ?? null;
    }),

  recentVotes: publicProcedure
    .input(
      z.object({
        memberId: z.number(),
        limit: z.number().min(1).max(50).default(10),
      }),
    )
    .query(async ({ input }) => {
      return db
        .select({
          voteId: votes.id,
          voteTitle: votes.title,
          voteDate: votes.voteDate,
          voteValue: memberVotes.voteValue,
          isAccepted: votes.isAccepted,
        })
        .from(memberVotes)
        .innerJoin(votes, eq(memberVotes.voteId, votes.id))
        .where(eq(memberVotes.memberId, input.memberId))
        .orderBy(desc(votes.voteDate))
        .limit(input.limit);
    }),
});
