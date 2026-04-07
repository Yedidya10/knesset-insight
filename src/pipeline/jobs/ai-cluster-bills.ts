import { sql, eq, and } from 'drizzle-orm';
import { db } from '../../lib/db';
import {
  bills,
  billClusters,
  billClusterMembers,
  billEmbeddings,
} from '../../lib/db/schema';
import {
  analyzeBillClusters,
  type ClusterCandidate,
} from '../../lib/ai/legislation/cluster-analyzer';
import { appConfig } from '../../../app.config';
import { runSyncJob } from '../utils';

/**
 * Phase 3: AI-powered semantic clustering.
 * 
 * 1. Uses embeddings to pre-filter candidates (cheap)
 * 2. Sends filtered candidates to Claude for validation (expensive)
 * 3. Updates cluster memberships with AI reasoning
 */
export async function aiClusterBills(): Promise<void> {
  await runSyncJob('ai-cluster-bills', async (prevCheckpoint) => {
    const {
      aiBatchSize,
      maxCandidatesPerCluster,
      embedding: { similarityThreshold, autoConfirmThreshold },
    } = appConfig.billClusters;

    // Get unprocessed clusters (name-similarity flagged for AI review)
    const unprocessedClusters = await db
      .select({
        id: billClusters.id,
        name: billClusters.name,
      })
      .from(billClusters)
      .where(eq(billClusters.aiProcessed, false))
      .limit(aiBatchSize);

    if (unprocessedClusters.length === 0) {
      console.log('[ai-cluster-bills] No unprocessed clusters');
      return 0;
    }

    console.log(
      `[ai-cluster-bills] Processing ${unprocessedClusters.length} clusters`,
    );

    let totalProcessed = 0;
    let tokensUsedToday = (prevCheckpoint?.tokensUsedToday as number) ?? 0;
    const dailyBudget = appConfig.billClusters.ai.dailyTokenBudget;

    for (const cluster of unprocessedClusters) {
      // Check daily token budget
      if (tokensUsedToday >= dailyBudget) {
        console.log(
          `[ai-cluster-bills] Daily token budget exhausted (${tokensUsedToday}/${dailyBudget})`,
        );
        break;
      }

      // Get current cluster members
      const members = await db
        .select({
          billId: billClusterMembers.billId,
        })
        .from(billClusterMembers)
        .where(eq(billClusterMembers.clusterId, cluster.id));

      const memberBillIds = members.map((m) => m.billId);
      if (memberBillIds.length === 0) continue;

      // Step 1: Find candidate bills via embedding similarity
      const candidates = await findEmbeddingCandidates(
        memberBillIds,
        similarityThreshold,
        maxCandidatesPerCluster,
      );

      // Step 2: Check if all members have high embedding similarity (auto-confirm)
      const memberSimilarities = await computeMemberSimilarities(memberBillIds);
      const allHighSimilarity =
        memberSimilarities.length > 0 &&
        memberSimilarities.every((s) => s >= autoConfirmThreshold);

      if (allHighSimilarity && candidates.length === 0) {
        // Auto-confirm: members are clearly related, no new candidates
        await db
          .update(billClusters)
          .set({
            aiProcessed: true,
            aiConfidence: Math.min(...memberSimilarities),
            updatedAt: new Date(),
          })
          .where(eq(billClusters.id, cluster.id));

        totalProcessed++;
        continue;
      }

      // Step 3: Send to Claude for analysis
      const allBillIds = [...new Set([...memberBillIds, ...candidates.map((c) => c.billId)])];
      const billData = await db
        .select({
          id: bills.id,
          name: bills.name,
          knessetNum: bills.knessetNum,
          billType: bills.billType,
          proposedDate: bills.proposedDate,
          status: bills.status,
        })
        .from(bills)
        .where(sql`${bills.id} IN ${allBillIds}`);

      const candidateList: ClusterCandidate[] = billData.map((b) => ({
        billId: b.id,
        name: b.name,
        knessetNum: b.knessetNum,
        billType: b.billType,
        proposedDate: b.proposedDate,
        status: b.status,
      }));

      if (candidateList.length < 2) {
        await db
          .update(billClusters)
          .set({ aiProcessed: true, updatedAt: new Date() })
          .where(eq(billClusters.id, cluster.id));
        totalProcessed++;
        continue;
      }

      const aiGroups = await analyzeBillClusters(candidateList);

      // Step 4: Update cluster based on AI response
      if (aiGroups.length > 0) {
        const primaryGroup = aiGroups[0]; // Use first group as the main cluster

        // Update cluster metadata with AI-generated info
        await db
          .update(billClusters)
          .set({
            name: primaryGroup.group_name,
            description: primaryGroup.description,
            category: primaryGroup.category,
            aiProcessed: true,
            aiConfidence:
              primaryGroup.bills.reduce((sum, b) => sum + b.confidence, 0) /
              primaryGroup.bills.length,
            updatedAt: new Date(),
          })
          .where(eq(billClusters.id, cluster.id));

        // Add new members from AI analysis
        for (const aiBill of primaryGroup.bills) {
          if (memberBillIds.includes(aiBill.billId)) {
            // Update existing member with AI reasoning
            await db
              .update(billClusterMembers)
              .set({
                aiReasoning: aiBill.reasoning,
                confidence: aiBill.confidence,
              })
              .where(
                and(
                  eq(billClusterMembers.clusterId, cluster.id),
                  eq(billClusterMembers.billId, aiBill.billId),
                ),
              );
          } else {
            // Add new member (discovered by AI)
            await db
              .insert(billClusterMembers)
              .values({
                clusterId: cluster.id,
                billId: aiBill.billId,
                relationshipType: 'ai_semantic',
                confidence: aiBill.confidence,
                aiReasoning: aiBill.reasoning,
                isOrigin: false,
                isPrimary: false,
              })
              .onConflictDoNothing();

            await db
              .update(bills)
              .set({ clusterId: cluster.id })
              .where(eq(bills.id, aiBill.billId));
          }
        }

        // Update bill count
        const updatedMembers = await db
          .select({ id: billClusterMembers.id })
          .from(billClusterMembers)
          .where(eq(billClusterMembers.clusterId, cluster.id));

        await db
          .update(billClusters)
          .set({
            billCount: updatedMembers.length,
            hasCrossTermBills: await checkCrossTermBills(cluster.id),
          })
          .where(eq(billClusters.id, cluster.id));
      } else {
        // AI returned no groups — mark as processed
        await db
          .update(billClusters)
          .set({ aiProcessed: true, updatedAt: new Date() })
          .where(eq(billClusters.id, cluster.id));
      }

      totalProcessed++;
    }

    return {
      count: totalProcessed,
      checkpoint: { tokensUsedToday },
    };
  });
}

/**
 * Find candidate bills via embedding cosine similarity.
 */
async function findEmbeddingCandidates(
  memberBillIds: number[],
  threshold: number,
  maxCandidates: number,
): Promise<{ billId: number; similarity: number }[]> {
  if (memberBillIds.length === 0) return [];

  // Get average embedding of cluster members
  const result = await db.execute<{
    bill_id: number;
    avg_similarity: number;
  }>(sql`
    WITH cluster_embeddings AS (
      SELECT embedding
      FROM bill_embeddings
      WHERE bill_id IN ${memberBillIds}
    ),
    avg_embedding AS (
      SELECT avg(embedding) AS centroid
      FROM cluster_embeddings
    )
    SELECT be.bill_id,
           1 - (be.embedding <=> ae.centroid) AS avg_similarity
    FROM bill_embeddings be
    CROSS JOIN avg_embedding ae
    WHERE be.bill_id NOT IN ${memberBillIds}
      AND ae.centroid IS NOT NULL
      AND 1 - (be.embedding <=> ae.centroid) > ${threshold}
    ORDER BY avg_similarity DESC
    LIMIT ${maxCandidates}
  `);

  return result.map((r) => ({
    billId: r.bill_id,
    similarity: r.avg_similarity,
  }));
}

/**
 * Compute pairwise embedding similarities between cluster members.
 */
async function computeMemberSimilarities(
  memberBillIds: number[],
): Promise<number[]> {
  if (memberBillIds.length < 2) return [1.0];

  const result = await db.execute<{ min_similarity: number }>(sql`
    SELECT MIN(1 - (a.embedding <=> b.embedding)) AS min_similarity
    FROM bill_embeddings a
    CROSS JOIN bill_embeddings b
    WHERE a.bill_id IN ${memberBillIds}
      AND b.bill_id IN ${memberBillIds}
      AND a.bill_id < b.bill_id
  `);

  if (result.length === 0 || result[0].min_similarity === null) return [];
  return [result[0].min_similarity];
}

/**
 * Check if a cluster has bills from multiple Knesset terms.
 */
async function checkCrossTermBills(clusterId: number): Promise<boolean> {
  const result = await db.execute<{ knesset_count: number }>(sql`
    SELECT COUNT(DISTINCT b.knesset_num) AS knesset_count
    FROM bill_cluster_members bcm
    JOIN bills b ON b.id = bcm.bill_id
    WHERE bcm.cluster_id = ${clusterId}
  `);

  return (result[0]?.knesset_count ?? 0) > 1;
}
