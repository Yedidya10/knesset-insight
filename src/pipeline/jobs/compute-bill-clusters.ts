import { sql, eq, and, isNull } from 'drizzle-orm';
import { db } from '../../lib/db';
import {
  bills,
  billUnions,
  billSplits,
  billClusters,
  billClusterMembers,
} from '../../lib/db/schema';
import { computeBillStage } from '../../lib/knesset/bill-stages';
import { appConfig } from '../../../app.config';
import { runSyncJob } from '../utils';

const BATCH_SIZE = 200;

interface BillNode {
  id: number;
  knessetId: number;
  name: string;
  knessetNum: number | null;
  status: string | null;
  billType: string | null;
  subTypeId: number | null;
  proposedDate: string | null;
  lastUpdate: Date | null;
}

/**
 * Phase 2: Compute bill clusters from formal relationships (unions/splits)
 * and pg_trgm name similarity. Marks clusters for AI processing.
 */
export async function computeBillClusters(): Promise<void> {
  await runSyncJob('compute-bill-clusters', async () => {
    // Load all bills
    const allBills = await db
      .select({
        id: bills.id,
        knessetId: bills.knessetId,
        name: bills.name,
        knessetNum: bills.knessetNum,
        status: bills.status,
        billType: bills.billType,
        subTypeId: bills.subTypeId,
        proposedDate: bills.proposedDate,
        lastUpdate: bills.lastUpdate,
      })
      .from(bills);

    const billMap = new Map<number, BillNode>(allBills.map((b) => [b.id, b]));

    // Load all formal relationships
    const unions = await db
      .select({
        mainBillId: billUnions.mainBillId,
        unionBillId: billUnions.unionBillId,
      })
      .from(billUnions);

    const splits = await db
      .select({
        mainBillId: billSplits.mainBillId,
        splitBillId: billSplits.splitBillId,
      })
      .from(billSplits);

    // ── Step 1: Build adjacency graph from formal relationships ──
    const adjacency = new Map<number, Set<number>>();
    const edgeTypes = new Map<string, 'formal_union' | 'formal_split'>();

    function addEdge(a: number, b: number, type: 'formal_union' | 'formal_split') {
      if (!adjacency.has(a)) adjacency.set(a, new Set());
      if (!adjacency.has(b)) adjacency.set(b, new Set());
      adjacency.get(a)!.add(b);
      adjacency.get(b)!.add(a);
      const key = [Math.min(a, b), Math.max(a, b)].join('-');
      edgeTypes.set(key, type);
    }

    for (const u of unions) {
      addEdge(u.mainBillId, u.unionBillId, 'formal_union');
    }
    for (const s of splits) {
      addEdge(s.mainBillId, s.splitBillId, 'formal_split');
    }

    // ── Step 2: BFS to find connected components ──
    const visited = new Set<number>();
    const components: number[][] = [];

    for (const billId of adjacency.keys()) {
      if (visited.has(billId)) continue;
      const component: number[] = [];
      const queue = [billId];
      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        visited.add(current);
        component.push(current);
        for (const neighbor of adjacency.get(current) ?? []) {
          if (!visited.has(neighbor)) queue.push(neighbor);
        }
      }
      components.push(component);
    }

    console.log(
      `[compute-bill-clusters] Found ${components.length} formal components from ${unions.length} unions + ${splits.length} splits`,
    );

    // ── Step 3: Clear existing clusters and rebuild ──
    // Delete in correct order to respect FK constraints
    await db.delete(billClusterMembers);
    await db.update(bills).set({ clusterId: null });
    await db.delete(billClusters);

    let totalClusters = 0;

    // ── Step 4: Create clusters from formal components ──
    for (const component of components) {
      const memberBills = component
        .map((id) => billMap.get(id))
        .filter((b): b is BillNode => !!b);

      if (memberBills.length === 0) continue;

      const cluster = buildClusterFromBills(memberBills, edgeTypes);
      const [inserted] = await db
        .insert(billClusters)
        .values(cluster)
        .returning({ id: billClusters.id });

      // Insert members
      for (const bill of memberBills) {
        const isPrimary = bill.id === cluster.primaryBillId;
        const isOrigin = memberBills.every(
          (b) => !b.proposedDate || bill.proposedDate! <= b.proposedDate!,
        );
        const edgeKey = [Math.min(bill.id, cluster.primaryBillId!), Math.max(bill.id, cluster.primaryBillId!)].join('-');
        const relType = edgeTypes.get(edgeKey) ?? 'formal_union';

        await db.insert(billClusterMembers).values({
          clusterId: inserted.id,
          billId: bill.id,
          relationshipType: relType,
          confidence: 1.0,
          isOrigin,
          isPrimary,
        });

        await db
          .update(bills)
          .set({ clusterId: inserted.id })
          .where(eq(bills.id, bill.id));
      }

      totalClusters++;
    }

    console.log(`[compute-bill-clusters] Created ${totalClusters} formal clusters`);

    // ── Step 5: Name similarity for unclustered bills ──
    const unclusteredBills = await db
      .select({
        id: bills.id,
        name: bills.name,
        knessetNum: bills.knessetNum,
        subTypeId: bills.subTypeId,
      })
      .from(bills)
      .where(isNull(bills.clusterId));

    console.log(
      `[compute-bill-clusters] ${unclusteredBills.length} unclustered bills for name similarity`,
    );

    const threshold = appConfig.billClusters.nameSimilarityThreshold;
    const nameClusters = new Map<number, number[]>(); // cluster lead → member IDs
    const assignedByName = new Set<number>();

    for (const bill of unclusteredBills) {
      if (assignedByName.has(bill.id)) continue;

      // Find similar-named bills not yet assigned
      const similar = await db.execute<{
        id: number;
        name: string;
        knesset_num: number;
        sub_type_id: number;
        sim: number;
      }>(sql`
        SELECT b.id, b.name, b.knesset_num, b.sub_type_id,
               similarity(b.name, ${bill.name}) AS sim
        FROM bills b
        WHERE b.id != ${bill.id}
          AND b.cluster_id IS NULL
          AND similarity(b.name, ${bill.name}) > ${threshold}
        ORDER BY sim DESC
        LIMIT ${appConfig.billClusters.maxCandidatesPerCluster}
      `);

      if (similar.length === 0) continue;

      const group = [bill.id, ...similar.map((s) => s.id).filter((id) => !assignedByName.has(id))];
      if (group.length < 2) continue;

      nameClusters.set(bill.id, group);
      for (const id of group) assignedByName.add(id);
    }

    // Create name-similarity clusters
    let nameSimilarityClusters = 0;
    for (const [leadId, memberIds] of nameClusters) {
      const memberBills = memberIds
        .map((id) => allBills.find((b) => b.id === id))
        .filter((b): b is BillNode => !!b);

      if (memberBills.length < 2) continue;

      const cluster = buildClusterFromBills(memberBills, edgeTypes);
      cluster.aiProcessed = false; // Mark for AI review
      cluster.hasCrossTermBills = new Set(memberBills.map((b) => b.knessetNum)).size > 1;

      const [inserted] = await db
        .insert(billClusters)
        .values(cluster)
        .returning({ id: billClusters.id });

      for (const bill of memberBills) {
        const isPrimary = bill.id === cluster.primaryBillId;
        const isOrigin = memberBills.every(
          (b) => !b.proposedDate || bill.proposedDate! <= b.proposedDate!,
        );

        await db.insert(billClusterMembers).values({
          clusterId: inserted.id,
          billId: bill.id,
          relationshipType: 'name_similarity',
          confidence: 0.7,
          isOrigin,
          isPrimary,
        });

        await db
          .update(bills)
          .set({ clusterId: inserted.id })
          .where(eq(bills.id, bill.id));
      }

      nameSimilarityClusters++;
    }

    console.log(`[compute-bill-clusters] Created ${nameSimilarityClusters} name-similarity clusters`);

    // ── Step 6: Create singleton clusters for remaining unclustered bills ──
    const stillUnclustered = await db
      .select({
        id: bills.id,
        knessetId: bills.knessetId,
        name: bills.name,
        knessetNum: bills.knessetNum,
        status: bills.status,
        billType: bills.billType,
        subTypeId: bills.subTypeId,
        proposedDate: bills.proposedDate,
        lastUpdate: bills.lastUpdate,
      })
      .from(bills)
      .where(isNull(bills.clusterId));

    let singletonCount = 0;
    for (let i = 0; i < stillUnclustered.length; i += BATCH_SIZE) {
      const batch = stillUnclustered.slice(i, i + BATCH_SIZE);

      for (const bill of batch) {
        const stageInfo = computeBillStage(
          bill.status,
          bill.subTypeId ?? undefined,
          bill.billType ?? undefined,
        );

        const [inserted] = await db
          .insert(billClusters)
          .values({
            name: bill.name,
            primaryBillId: bill.id,
            currentStage: stageInfo.currentStage,
            specialStatus: stageInfo.specialStatus ?? null,
            billType: bill.billType,
            latestKnessetNum: bill.knessetNum,
            billCount: 1,
            aiProcessed: true, // No AI needed for singletons
            latestUpdate: bill.lastUpdate,
          })
          .returning({ id: billClusters.id });

        await db.insert(billClusterMembers).values({
          clusterId: inserted.id,
          billId: bill.id,
          relationshipType: 'formal_union',
          confidence: 1.0,
          isOrigin: true,
          isPrimary: true,
        });

        await db
          .update(bills)
          .set({ clusterId: inserted.id })
          .where(eq(bills.id, bill.id));

        singletonCount++;
      }
    }

    console.log(`[compute-bill-clusters] Created ${singletonCount} singleton clusters`);
    console.log(
      `[compute-bill-clusters] Total: ${totalClusters + nameSimilarityClusters + singletonCount} clusters`,
    );

    return totalClusters + nameSimilarityClusters + singletonCount;
  });
}

/**
 * Build cluster metadata from a list of bills.
 */
function buildClusterFromBills(
  memberBills: BillNode[],
  edgeTypes: Map<string, string>,
) {
  // Primary = bill with most advanced stage
  const withStages = memberBills.map((b) => ({
    ...b,
    stageInfo: computeBillStage(b.status, b.subTypeId ?? undefined, b.billType ?? undefined),
  }));

  withStages.sort((a, z) => z.stageInfo.currentStage - a.stageInfo.currentStage);
  const primary = withStages[0];

  const knessetNums = new Set(memberBills.map((b) => b.knessetNum).filter(Boolean));
  const hasUnions = [...edgeTypes.values()].some((t) => t === 'formal_union');
  const hasSplits = [...edgeTypes.values()].some((t) => t === 'formal_split');

  const latestUpdate = memberBills.reduce<Date | null>((latest, b) => {
    if (!b.lastUpdate) return latest;
    if (!latest || b.lastUpdate > latest) return b.lastUpdate;
    return latest;
  }, null);

  return {
    name: primary.name,
    primaryBillId: primary.id,
    currentStage: primary.stageInfo.currentStage,
    specialStatus: primary.stageInfo.specialStatus ?? null,
    billType: primary.billType,
    latestKnessetNum: Math.max(...[...knessetNums].map(Number)),
    billCount: memberBills.length,
    hasUnions,
    hasSplits,
    hasCrossTermBills: knessetNums.size > 1,
    aiProcessed: true, // Formal relationships don't need AI
    latestUpdate,
  };
}
