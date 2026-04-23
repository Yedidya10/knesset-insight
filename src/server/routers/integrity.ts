import { z } from 'zod/v4';
import { eq, desc, and, sql, inArray } from 'drizzle-orm';
import { router, publicProcedure } from '../trpc';
import { db } from '../../lib/db';
import {
  integrityCases,
  integrityDocuments,
  memberCorporateAffiliations,
  memberLobbyistConnections,
  members,
} from '../../lib/db/schema';

export const integrityRouter = router({
  /** List integrity cases for a member, with optional filters */
  getCases: publicProcedure
    .input(
      z.object({
        memberId: z.number(),
        category: z.string().optional(),
        severity: z.string().optional(),
        status: z.string().optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(50).default(20),
      }),
    )
    .query(async ({ input }) => {
      const { memberId, category, severity, status, page, pageSize } = input;
      const offset = (page - 1) * pageSize;

      const conditions = [eq(integrityCases.memberId, memberId)];
      if (category) conditions.push(eq(integrityCases.category, category));
      if (severity) conditions.push(eq(integrityCases.severity, severity));
      if (status) conditions.push(eq(integrityCases.status, status));

      const where = and(...conditions);

      const [data, countResult] = await Promise.all([
        db
          .select()
          .from(integrityCases)
          .where(where)
          .orderBy(desc(integrityCases.eventDate))
          .limit(pageSize)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(integrityCases)
          .where(where),
      ]);

      // Attach official documents to each case
      const caseIds = data.map((c) => c.id);
      const allDocs =
        caseIds.length > 0
          ? await db
              .select()
              .from(integrityDocuments)
              .where(inArray(integrityDocuments.caseId, caseIds))
              .orderBy(desc(integrityDocuments.publishedAt))
          : [];

      const docsByCaseId = new Map<number, typeof allDocs>();
      for (const doc of allDocs) {
        const arr = docsByCaseId.get(doc.caseId) ?? [];
        arr.push(doc);
        docsByCaseId.set(doc.caseId, arr);
      }

      return {
        items: data.map((c) => ({
          ...c,
          documents: docsByCaseId.get(c.id) ?? [],
        })),
        total: countResult[0]?.count ?? 0,
        page,
        pageSize,
        totalPages: Math.ceil((countResult[0]?.count ?? 0) / pageSize),
      };
    }),

  /** Get a single integrity case with its documents */
  getCaseById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const [caseResult, docs] = await Promise.all([
        db
          .select()
          .from(integrityCases)
          .where(eq(integrityCases.id, input.id))
          .limit(1),
        db
          .select()
          .from(integrityDocuments)
          .where(eq(integrityDocuments.caseId, input.id))
          .orderBy(desc(integrityDocuments.publishedAt)),
      ]);

      if (!caseResult[0]) return null;

      return {
        ...caseResult[0],
        documents: docs,
      };
    }),

  /** Summary counts for a member's integrity profile */
  getMemberSummary: publicProcedure
    .input(z.object({ memberId: z.number() }))
    .query(async ({ input }) => {
      const [cases, affiliations, lobbyists] = await Promise.all([
        db
          .select({
            category: integrityCases.category,
            severity: integrityCases.severity,
            count: sql<number>`count(*)::int`,
          })
          .from(integrityCases)
          .where(eq(integrityCases.memberId, input.memberId))
          .groupBy(integrityCases.category, integrityCases.severity),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(memberCorporateAffiliations)
          .where(eq(memberCorporateAffiliations.memberId, input.memberId)),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(memberLobbyistConnections)
          .where(eq(memberLobbyistConnections.memberId, input.memberId)),
      ]);

      return {
        caseSummary: cases,
        totalCases: cases.reduce((sum, c) => sum + c.count, 0),
        corporateAffiliations: affiliations[0]?.count ?? 0,
        lobbyistConnections: lobbyists[0]?.count ?? 0,
      };
    }),

  /** Corporate affiliations for a member */
  getCorporateAffiliations: publicProcedure
    .input(
      z.object({
        memberId: z.number(),
        status: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const conditions = [
        eq(memberCorporateAffiliations.memberId, input.memberId),
      ];
      if (input.status) {
        conditions.push(eq(memberCorporateAffiliations.status, input.status));
      }

      return db
        .select()
        .from(memberCorporateAffiliations)
        .where(and(...conditions))
        .orderBy(desc(memberCorporateAffiliations.startDate));
    }),

  /** Lobbyist connections for a member */
  getLobbyistConnections: publicProcedure
    .input(
      z.object({
        memberId: z.number(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(50).default(20),
      }),
    )
    .query(async ({ input }) => {
      const { memberId, page, pageSize } = input;
      const offset = (page - 1) * pageSize;
      const where = eq(memberLobbyistConnections.memberId, memberId);

      const [data, countResult] = await Promise.all([
        db
          .select()
          .from(memberLobbyistConnections)
          .where(where)
          .orderBy(desc(memberLobbyistConnections.eventDate))
          .limit(pageSize)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(memberLobbyistConnections)
          .where(where),
      ]);

      return {
        items: data,
        total: countResult[0]?.count ?? 0,
        page,
        pageSize,
        totalPages: Math.ceil((countResult[0]?.count ?? 0) / pageSize),
      };
    }),

  /** Aggregate integrity stats across all members (for overview page) */
  getOverviewStats: publicProcedure.query(async () => {
    const [categoryCounts, topMembers] = await Promise.all([
      db
        .select({
          category: integrityCases.category,
          count: sql<number>`count(*)::int`,
        })
        .from(integrityCases)
        .groupBy(integrityCases.category),
      db
        .select({
          memberId: integrityCases.memberId,
          firstName: members.firstName,
          lastName: members.lastName,
          caseCount: sql<number>`count(*)::int`,
        })
        .from(integrityCases)
        .innerJoin(members, eq(integrityCases.memberId, members.id))
        .groupBy(integrityCases.memberId, members.firstName, members.lastName)
        .orderBy(desc(sql`count(*)`))
        .limit(10),
    ]);

    return {
      categoryCounts,
      topMembers,
      totalCases: categoryCounts.reduce((sum, c) => sum + c.count, 0),
    };
  }),
});
