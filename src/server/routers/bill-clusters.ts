import { z } from 'zod/v4';
import { eq, desc, sql, ilike, and, lt, count as drizzleCount, isNotNull } from 'drizzle-orm';
import { router, publicProcedure } from '../trpc';
import { db } from '../../lib/db';
import {
  bills,
  billClusters,
  billClusterMembers,
  billEmbeddings,
  billInitiators,
  members,
  votes,
} from '../../lib/db/schema';
import { computeBillStage } from '../../lib/knesset/bill-stages';
import { appConfig } from '../../../app.config';

export const billClustersRouter = router({
  /** Paginated cluster list with filters */
  list: publicProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
        search: z.string().optional(),
        knessetNum: z.number().optional(),
        billType: z.string().optional(),
        category: z.string().optional(),
        hasCrossTermBills: z.boolean().optional(),
        hasVotes: z.boolean().optional(),
        sort: z.enum(['latest', 'billCount', 'knessetNum']).default('latest'),
      }),
    )
    .query(async ({ input }) => {
      const { page, pageSize, search, knessetNum, billType, category, hasCrossTermBills, sort } = input;
      const offset = (page - 1) * pageSize;

      const conditions = [];
      // Only show multi-bill clusters by default (filter out singletons in list view)
      if (search) conditions.push(ilike(billClusters.name, `%${search}%`));
      if (knessetNum) conditions.push(eq(billClusters.latestKnessetNum, knessetNum));
      if (billType) conditions.push(eq(billClusters.billType, billType));
      if (category) conditions.push(eq(billClusters.category, category));
      if (hasCrossTermBills) conditions.push(eq(billClusters.hasCrossTermBills, true));

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const orderBy =
        sort === 'billCount'
          ? desc(billClusters.billCount)
          : sort === 'knessetNum'
            ? desc(billClusters.latestKnessetNum)
            : desc(billClusters.latestUpdate);

      const [items, countResult] = await Promise.all([
        db
          .select({
            id: billClusters.id,
            name: billClusters.name,
            description: billClusters.description,
            category: billClusters.category,
            currentStage: billClusters.currentStage,
            specialStatus: billClusters.specialStatus,
            billType: billClusters.billType,
            latestKnessetNum: billClusters.latestKnessetNum,
            billCount: billClusters.billCount,
            hasUnions: billClusters.hasUnions,
            hasSplits: billClusters.hasSplits,
            hasCrossTermBills: billClusters.hasCrossTermBills,
            aiProcessed: billClusters.aiProcessed,
            aiConfidence: billClusters.aiConfidence,
            latestUpdate: billClusters.latestUpdate,
          })
          .from(billClusters)
          .where(where)
          .orderBy(orderBy)
          .limit(pageSize)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(billClusters)
          .where(where),
      ]);

      return {
        items,
        total: Number(countResult[0]?.count ?? 0),
        page,
        pageSize,
      };
    }),

  /** Full cluster detail with all member bills, votes, and relationships */
  byId: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const [cluster] = await db
        .select()
        .from(billClusters)
        .where(eq(billClusters.id, input.id))
        .limit(1);

      if (!cluster) return null;

      // Get all member bills with their details
      const memberRows = await db
        .select({
          membership: billClusterMembers,
          bill: bills,
        })
        .from(billClusterMembers)
        .innerJoin(bills, eq(billClusterMembers.billId, bills.id))
        .where(eq(billClusterMembers.clusterId, input.id))
        .orderBy(desc(bills.proposedDate));

      // Compute stage info for each bill
      const memberBills = memberRows.map((row) => {
        const stageInfo = computeBillStage(
          row.bill.status,
          row.bill.subTypeId ?? undefined,
        );

        return {
          ...row.bill,
          stageInfo,
          membership: {
            relationshipType: row.membership.relationshipType,
            confidence: row.membership.confidence,
            isOrigin: row.membership.isOrigin,
            isPrimary: row.membership.isPrimary,
            aiReasoning: row.membership.aiReasoning,
          },
        };
      });

      // Get all votes across the cluster, grouped by bill and stage
      const billIds = memberBills.map((b) => b.id);
      const clusterVotes =
        billIds.length > 0
          ? await db
              .select({
                id: votes.id,
                knessetId: votes.knessetId,
                title: votes.title,
                voteDate: votes.voteDate,
                billId: votes.billId,
                billStage: votes.billStage,
                forCount: votes.forCount,
                againstCount: votes.againstCount,
                abstainCount: votes.abstainCount,
                isAccepted: votes.isAccepted,
              })
              .from(votes)
              .where(sql`${votes.billId} IN ${billIds}`)
              .orderBy(desc(votes.voteDate))
          : [];

      // Get all initiators across the cluster
      const clusterInitiators =
        billIds.length > 0
          ? await db
              .select({
                billId: billInitiators.billId,
                memberId: billInitiators.memberId,
                firstName: members.firstName,
                lastName: members.lastName,
                isPrimary: billInitiators.isPrimary,
              })
              .from(billInitiators)
              .leftJoin(members, eq(billInitiators.memberId, members.id))
              .where(sql`${billInitiators.billId} IN ${billIds}`)
          : [];

      return {
        ...cluster,
        bills: memberBills,
        votes: clusterVotes,
        initiators: clusterInitiators,
      };
    }),

  /** Full-text search across cluster names + descriptions */
  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(50).default(10),
      }),
    )
    .query(async ({ input }) => {
      return db
        .select({
          id: billClusters.id,
          name: billClusters.name,
          description: billClusters.description,
          category: billClusters.category,
          billCount: billClusters.billCount,
          latestKnessetNum: billClusters.latestKnessetNum,
          hasCrossTermBills: billClusters.hasCrossTermBills,
        })
        .from(billClusters)
        .where(
          sql`(
            ${billClusters.name} ILIKE ${'%' + input.query + '%'}
            OR ${billClusters.description} ILIKE ${'%' + input.query + '%'}
          )`,
        )
        .orderBy(desc(billClusters.billCount))
        .limit(input.limit);
    }),

  // --- Admin procedures ---
  // TODO: Replace publicProcedure with adminProcedure once auth is implemented

  /** Admin review queue — low-confidence AI clusters needing review */
  adminQueue: publicProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
        maxConfidence: z.number().min(0).max(1).default(
          appConfig.billClusters.aiConfidenceThreshold,
        ),
      }),
    )
    .query(async ({ input }) => {
      const { page, pageSize, maxConfidence } = input;
      const offset = (page - 1) * pageSize;

      const conditions = [
        eq(billClusters.aiProcessed, true),
        lt(billClusters.aiConfidence, maxConfidence),
      ];

      const [items, countResult] = await Promise.all([
        db
          .select({
            id: billClusters.id,
            name: billClusters.name,
            description: billClusters.description,
            billCount: billClusters.billCount,
            aiConfidence: billClusters.aiConfidence,
            latestKnessetNum: billClusters.latestKnessetNum,
            category: billClusters.category,
            createdAt: billClusters.createdAt,
          })
          .from(billClusters)
          .where(and(...conditions))
          .orderBy(billClusters.aiConfidence)
          .limit(pageSize)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(billClusters)
          .where(and(...conditions)),
      ]);

      // Get member bills for each queue item
      const itemsWithBills = await Promise.all(
        items.map(async (item) => {
          const memberBills = await db
            .select({
              billId: billClusterMembers.billId,
              billName: bills.name,
              relationshipType: billClusterMembers.relationshipType,
              confidence: billClusterMembers.confidence,
              aiReasoning: billClusterMembers.aiReasoning,
            })
            .from(billClusterMembers)
            .innerJoin(bills, eq(billClusterMembers.billId, bills.id))
            .where(eq(billClusterMembers.clusterId, item.id));

          return { ...item, bills: memberBills };
        }),
      );

      return {
        items: itemsWithBills,
        total: Number(countResult[0]?.count ?? 0),
        page,
        pageSize,
      };
    }),

  /** Approve an AI cluster — sets confidence to 1.0, relationship to manual */
  approve: publicProcedure
    .input(z.object({ clusterId: z.number() }))
    .mutation(async ({ input }) => {
      await db.transaction(async (tx) => {
        await tx
          .update(billClusterMembers)
          .set({ relationshipType: 'manual', confidence: 1.0 })
          .where(eq(billClusterMembers.clusterId, input.clusterId));

        await tx
          .update(billClusters)
          .set({
            aiConfidence: 1.0,
            updatedAt: new Date(),
          })
          .where(eq(billClusters.id, input.clusterId));
      });

      return { success: true };
    }),

  /** Reject an AI cluster — removes AI-created member links */
  reject: publicProcedure
    .input(z.object({ clusterId: z.number() }))
    .mutation(async ({ input }) => {
      await db.transaction(async (tx) => {
        // Remove AI-linked members (keep formal/union/split links)
        await tx
          .delete(billClusterMembers)
          .where(
            and(
              eq(billClusterMembers.clusterId, input.clusterId),
              sql`${billClusterMembers.relationshipType} IN ('ai', 'name-similarity')`,
            ),
          );

        // Check remaining members
        const remaining = await tx
          .select({ count: sql<number>`count(*)` })
          .from(billClusterMembers)
          .where(eq(billClusterMembers.clusterId, input.clusterId));

        const remainingCount = Number(remaining[0]?.count ?? 0);

        if (remainingCount <= 1) {
          // Delete singleton cluster
          await tx
            .delete(billClusterMembers)
            .where(eq(billClusterMembers.clusterId, input.clusterId));
          await tx
            .update(bills)
            .set({ clusterId: null })
            .where(eq(bills.clusterId, input.clusterId));
          await tx
            .delete(billClusters)
            .where(eq(billClusters.id, input.clusterId));
        } else {
          await tx
            .update(billClusters)
            .set({
              billCount: remainingCount,
              aiProcessed: true,
              aiConfidence: 1.0,
              updatedAt: new Date(),
            })
            .where(eq(billClusters.id, input.clusterId));
        }
      });

      return { success: true };
    }),

  /** Manually link a bill to a cluster */
  manualLink: publicProcedure
    .input(
      z.object({
        clusterId: z.number(),
        billId: z.number(),
      }),
    )
    .mutation(async ({ input }) => {
      await db.transaction(async (tx) => {
        await tx.insert(billClusterMembers).values({
          clusterId: input.clusterId,
          billId: input.billId,
          relationshipType: 'manual',
          confidence: 1.0,
        });

        await tx
          .update(bills)
          .set({ clusterId: input.clusterId })
          .where(eq(bills.id, input.billId));

        await tx
          .update(billClusters)
          .set({
            billCount: sql`${billClusters.billCount} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(billClusters.id, input.clusterId));
      });

      return { success: true };
    }),

  /** Dashboard stats — cluster counts, AI accuracy, embedding coverage */
  stats: publicProcedure.query(async () => {
    const [
      totalClusters,
      aiClusters,
      formalClusters,
      nameSimilarityClusters,
      approvedAiCount,
      totalBills,
      embeddedBills,
      pendingReview,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(billClusters),
      db
        .select({ count: sql<number>`count(*)` })
        .from(billClusters)
        .where(eq(billClusters.aiProcessed, true)),
      db
        .select({ count: sql<number>`count(distinct ${billClusterMembers.clusterId})` })
        .from(billClusterMembers)
        .where(sql`${billClusterMembers.relationshipType} IN ('union', 'split')`),
      db
        .select({ count: sql<number>`count(distinct ${billClusterMembers.clusterId})` })
        .from(billClusterMembers)
        .where(eq(billClusterMembers.relationshipType, 'name-similarity')),
      db
        .select({ count: sql<number>`count(*)` })
        .from(billClusters)
        .where(
          and(
            eq(billClusters.aiProcessed, true),
            sql`${billClusters.aiConfidence} >= 1.0`,
          ),
        ),
      db.select({ count: sql<number>`count(*)` }).from(bills),
      db.select({ count: sql<number>`count(*)` }).from(billEmbeddings),
      db
        .select({ count: sql<number>`count(*)` })
        .from(billClusters)
        .where(
          and(
            eq(billClusters.aiProcessed, true),
            lt(billClusters.aiConfidence, appConfig.billClusters.aiConfidenceThreshold),
          ),
        ),
    ]);

    const totalAi = Number(aiClusters[0]?.count ?? 0);
    const approved = Number(approvedAiCount[0]?.count ?? 0);

    return {
      totalClusters: Number(totalClusters[0]?.count ?? 0),
      aiClusters: totalAi,
      formalClusters: Number(formalClusters[0]?.count ?? 0),
      nameSimilarityClusters: Number(nameSimilarityClusters[0]?.count ?? 0),
      aiAccuracy: totalAi > 0 ? Math.round((approved / totalAi) * 100) : 0,
      totalBills: Number(totalBills[0]?.count ?? 0),
      embeddedBills: Number(embeddedBills[0]?.count ?? 0),
      embeddingCoverage:
        Number(totalBills[0]?.count ?? 0) > 0
          ? Math.round(
              (Number(embeddedBills[0]?.count ?? 0) / Number(totalBills[0]?.count ?? 0)) * 100,
            )
          : 0,
      pendingReview: Number(pendingReview[0]?.count ?? 0),
    };
  }),
});
