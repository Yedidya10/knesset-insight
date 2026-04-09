import { z } from 'zod/v4';
import { eq, desc, sql, and } from 'drizzle-orm';
import { router, adminProcedure, publicProcedure } from '../trpc';
import { db } from '../../lib/db';
import {
  bills,
  billClusters,
  billClusterMembers,
  votes,
  members,
  syncLog,
  integrityCases,
  adminActivityLog,
} from '../../lib/db/schema';

export const adminRouter = router({
  // ─── Overview ───────────────────────────────────
  overview: adminProcedure.query(async () => {
    const [
      totalMembers,
      totalBills,
      totalVotes,
      totalClusters,
      pendingIntegrity,
      syncEntries,
      recentActivity,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(members),
      db.select({ count: sql<number>`count(*)` }).from(bills),
      db.select({ count: sql<number>`count(*)` }).from(votes),
      db.select({ count: sql<number>`count(*)` }).from(billClusters),
      db
        .select({ count: sql<number>`count(*)` })
        .from(integrityCases)
        .where(eq(integrityCases.verified, false)),
      db.select().from(syncLog).orderBy(desc(syncLog.lastSyncAt)),
      db
        .select()
        .from(adminActivityLog)
        .orderBy(desc(adminActivityLog.createdAt))
        .limit(10),
    ]);

    return {
      counts: {
        members: totalMembers[0]?.count ?? 0,
        bills: totalBills[0]?.count ?? 0,
        votes: totalVotes[0]?.count ?? 0,
        clusters: totalClusters[0]?.count ?? 0,
        pendingIntegrity: pendingIntegrity[0]?.count ?? 0,
      },
      syncStatus: syncEntries,
      recentActivity,
    };
  }),

  // ─── Activity Log ───────────────────────────────
  activityLog: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
        entityType: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const { page, pageSize, entityType } = input;
      const offset = (page - 1) * pageSize;

      const conditions = entityType ? eq(adminActivityLog.entityType, entityType) : undefined;

      const [items, countResult] = await Promise.all([
        db
          .select()
          .from(adminActivityLog)
          .where(conditions)
          .orderBy(desc(adminActivityLog.createdAt))
          .limit(pageSize)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(adminActivityLog)
          .where(conditions),
      ]);

      return {
        items,
        total: countResult[0]?.count ?? 0,
        page,
        pageSize,
      };
    }),

  // ─── Entity Activity (for hover popover) ────────
  entityActivity: adminProcedure
    .input(
      z.object({
        entityType: z.string(),
        entityId: z.string(),
        limit: z.number().min(1).max(20).default(4),
      }),
    )
    .query(async ({ input }) => {
      const { entityType, entityId, limit } = input;
      return db
        .select()
        .from(adminActivityLog)
        .where(
          and(
            eq(adminActivityLog.entityType, entityType),
            eq(adminActivityLog.entityId, entityId),
          ),
        )
        .orderBy(desc(adminActivityLog.createdAt))
        .limit(limit);
    }),

  // ─── Sync Status ────────────────────────────────
  syncStatus: adminProcedure.query(async () => {
    return db.select().from(syncLog).orderBy(desc(syncLog.lastSyncAt));
  }),

  // ─── Integrity Admin ────────────────────────────
  verifyIntegrityCase: adminProcedure
    .input(
      z.object({
        caseId: z.number(),
        reason: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const { caseId, reason } = input;

      await db
        .update(integrityCases)
        .set({
          verified: true,
          verifiedBy: 'admin',
          verifiedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(integrityCases.id, caseId));

      await db.insert(adminActivityLog).values({
        action: 'verify_integrity_case',
        entityType: 'integrity_case',
        entityId: String(caseId),
        details: { reason },
        adminIdentifier: 'admin',
      });

      return { success: true };
    }),

  rejectIntegrityCase: adminProcedure
    .input(
      z.object({
        caseId: z.number(),
        reason: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const { caseId, reason } = input;

      await db
        .update(integrityCases)
        .set({
          verified: false,
          verifiedBy: 'admin',
          verifiedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(integrityCases.id, caseId));

      await db.insert(adminActivityLog).values({
        action: 'reject_integrity_case',
        entityType: 'integrity_case',
        entityId: String(caseId),
        details: { reason },
        adminIdentifier: 'admin',
      });

      return { success: true };
    }),

  updateIntegrityCase: adminProcedure
    .input(
      z.object({
        caseId: z.number(),
        category: z.string().optional(),
        severity: z.string().optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        reason: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const { caseId, reason, ...updates } = input;

      const setData: Record<string, unknown> = { updatedAt: new Date() };
      if (updates.category) setData.category = updates.category;
      if (updates.severity) setData.severity = updates.severity;
      if (updates.title) setData.title = updates.title;
      if (updates.description) setData.description = updates.description;

      await db.update(integrityCases).set(setData).where(eq(integrityCases.id, caseId));

      await db.insert(adminActivityLog).values({
        action: 'update_integrity_case',
        entityType: 'integrity_case',
        entityId: String(caseId),
        details: { ...updates, reason },
        adminIdentifier: 'admin',
      });

      return { success: true };
    }),

  // ─── Inline Edit: Vote ↔ Bill relinking ────────
  relinkVote: adminProcedure
    .input(
      z.object({
        voteId: z.number(),
        newBillId: z.number().nullable(),
        reason: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const { voteId, newBillId, reason } = input;

      const [existingVote] = await db
        .select({ billId: votes.billId })
        .from(votes)
        .where(eq(votes.id, voteId));

      if (!existingVote) {
        throw new Error('Vote not found');
      }

      await db
        .update(votes)
        .set({ billId: newBillId, updatedAt: new Date() })
        .where(eq(votes.id, voteId));

      await db.insert(adminActivityLog).values({
        action: newBillId ? 'inline_relink_vote' : 'inline_unlink_vote',
        entityType: 'vote',
        entityId: String(voteId),
        details: {
          oldBillId: existingVote.billId,
          newBillId,
          reason,
        },
        adminIdentifier: 'admin',
      });

      return { success: true };
    }),

  // ─── Inline Edit: Bill stage override ──────────
  overrideBillStage: adminProcedure
    .input(
      z.object({
        billId: z.number(),
        newStatusId: z.string().min(1),
        reason: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const { billId, newStatusId, reason } = input;

      const [existingBill] = await db
        .select({ status: bills.status })
        .from(bills)
        .where(eq(bills.id, billId));

      if (!existingBill) {
        throw new Error('Bill not found');
      }

      await db
        .update(bills)
        .set({ status: newStatusId, updatedAt: new Date() })
        .where(eq(bills.id, billId));

      await db.insert(adminActivityLog).values({
        action: 'inline_override_bill_stage',
        entityType: 'bill',
        entityId: String(billId),
        details: {
          oldStatusId: existingBill.status,
          newStatusId,
          reason,
        },
        adminIdentifier: 'admin',
      });

      return { success: true };
    }),

  // ─── Inline Edit: Vote stage reassignment ──────
  reassignVoteStage: adminProcedure
    .input(
      z.object({
        voteId: z.number(),
        newStage: z.number().min(0).max(6),
        reason: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const { voteId, newStage, reason } = input;

      const [existingVote] = await db
        .select({ billStage: votes.billStage })
        .from(votes)
        .where(eq(votes.id, voteId));

      if (!existingVote) {
        throw new Error('Vote not found');
      }

      await db
        .update(votes)
        .set({ billStage: newStage, updatedAt: new Date() })
        .where(eq(votes.id, voteId));

      await db.insert(adminActivityLog).values({
        action: 'inline_reassign_vote_stage',
        entityType: 'vote',
        entityId: String(voteId),
        details: {
          oldStage: existingVote.billStage,
          newStage,
          reason,
        },
        adminIdentifier: 'admin',
      });

      return { success: true };
    }),

  // ─── Inline Edit: Bill ↔ Cluster management ───
  moveBillToCluster: adminProcedure
    .input(
      z.object({
        billId: z.number(),
        fromClusterId: z.number().nullable(),
        toClusterId: z.number(),
        reason: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const { billId, fromClusterId, toClusterId, reason } = input;

      // Remove from old cluster if exists
      if (fromClusterId) {
        await db
          .delete(billClusterMembers)
          .where(
            and(
              eq(billClusterMembers.billId, billId),
              eq(billClusterMembers.clusterId, fromClusterId),
            ),
          );
      }

      // Add to new cluster
      await db.insert(billClusterMembers).values({
        clusterId: toClusterId,
        billId,
        relationshipType: 'manual',
        confidence: 1.0,
        aiReasoning: `Admin override: ${reason}`,
      });

      // Update bill's clusterId reference
      await db.update(bills).set({ clusterId: toClusterId, updatedAt: new Date() }).where(eq(bills.id, billId));

      await db.insert(adminActivityLog).values({
        action: 'inline_move_bill_to_cluster',
        entityType: 'bill',
        entityId: String(billId),
        details: { fromClusterId, toClusterId, reason },
        adminIdentifier: 'admin',
      });

      return { success: true };
    }),

  removeBillFromCluster: adminProcedure
    .input(
      z.object({
        billId: z.number(),
        clusterId: z.number(),
        reason: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const { billId, clusterId, reason } = input;

      await db
        .delete(billClusterMembers)
        .where(
          and(
            eq(billClusterMembers.billId, billId),
            eq(billClusterMembers.clusterId, clusterId),
          ),
        );

      await db.update(bills).set({ clusterId: null, updatedAt: new Date() }).where(eq(bills.id, billId));

      await db.insert(adminActivityLog).values({
        action: 'inline_remove_bill_from_cluster',
        entityType: 'bill',
        entityId: String(billId),
        details: { clusterId, reason },
        adminIdentifier: 'admin',
      });

      return { success: true };
    }),

  // ─── Inline Edit: Cluster metadata ─────────────
  editClusterMeta: adminProcedure
    .input(
      z.object({
        clusterId: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        category: z.string().optional(),
        reason: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const { clusterId, reason, ...updates } = input;

      const setData: Record<string, unknown> = { updatedAt: new Date() };
      if (updates.name) setData.name = updates.name;
      if (updates.description) setData.description = updates.description;
      if (updates.category) setData.category = updates.category;

      await db.update(billClusters).set(setData).where(eq(billClusters.id, clusterId));

      await db.insert(adminActivityLog).values({
        action: 'inline_edit_cluster_meta',
        entityType: 'cluster',
        entityId: String(clusterId),
        details: { ...updates, reason },
        adminIdentifier: 'admin',
      });

      return { success: true };
    }),

  // ─── Update activity log reason ──────────────
  updateActivityReason: adminProcedure
    .input(
      z.object({
        logId: z.number(),
        reason: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const { logId, reason } = input;

      const [entry] = await db
        .select()
        .from(adminActivityLog)
        .where(eq(adminActivityLog.id, logId));

      if (!entry) {
        throw new Error('Activity log entry not found');
      }

      const oldDetails = (entry.details as Record<string, unknown>) ?? {};
      await db
        .update(adminActivityLog)
        .set({ details: { ...oldDetails, reason } })
        .where(eq(adminActivityLog.id, logId));

      return { success: true };
    }),

  // ─── Check admin status (for client) ───────────
  checkAuth: publicProcedure.query(({ ctx }) => {
    return { isAdmin: ctx.isAdmin };
  }),
});
