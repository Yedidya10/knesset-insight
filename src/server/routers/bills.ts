import { z } from 'zod/v4';
import { eq, desc, sql, ilike, inArray } from 'drizzle-orm';
import { router, publicProcedure } from '../trpc';
import { db } from '../../lib/db';
import { bills, billInitiators, billUnions, billSplits, billNames, members, votes, billClusters, billClusterMembers } from '../../lib/db/schema';
import { computeBillStage } from '../../lib/knesset/bill-stages';

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

      const bill = result[0];

      const [initiators, relatedVotes, rawUnions, rawSplits, nameHistory] =
        await Promise.all([
          db
            .select({
              memberId: members.id,
              firstName: members.firstName,
              lastName: members.lastName,
              imageUrl: members.imageUrl,
              isPrimary: billInitiators.isPrimary,
            })
            .from(billInitiators)
            .innerJoin(members, eq(billInitiators.memberId, members.id))
            .where(eq(billInitiators.billId, input.id)),

          db
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
            .orderBy(desc(votes.voteDate)),

          db
            .select({ id: billUnions.id, mainBillId: billUnions.mainBillId })
            .from(billUnions)
            .where(eq(billUnions.unionBillId, input.id)),

          db
            .select({ id: billSplits.id, splitBillId: billSplits.splitBillId })
            .from(billSplits)
            .where(eq(billSplits.mainBillId, input.id)),

          db
            .select({ name: billNames.name, typeDesc: billNames.nameHistoryTypeDesc })
            .from(billNames)
            .where(eq(billNames.billId, input.id)),
        ]);

      // Resolve related bill names
      const relatedIds = [
        ...rawUnions.map((u) => u.mainBillId),
        ...rawSplits.map((s) => s.splitBillId),
      ];
      const billMap = new Map<number, { name: string | null; knessetId: number }>();
      if (relatedIds.length > 0) {
        const rows = await db
          .select({ id: bills.id, name: bills.name, knessetId: bills.knessetId })
          .from(bills)
          .where(inArray(bills.id, relatedIds));
        for (const r of rows) billMap.set(r.id, { name: r.name, knessetId: r.knessetId });
      }

      const unions = rawUnions.map((u) => ({
        id: u.id,
        mainBillId: u.mainBillId,
        mainBillName: billMap.get(u.mainBillId)?.name ?? null,
        mainBillKnessetId: billMap.get(u.mainBillId)?.knessetId ?? 0,
      }));
      const splits = rawSplits.map((s) => ({
        id: s.id,
        splitBillId: s.splitBillId,
        splitBillName: billMap.get(s.splitBillId)?.name ?? null,
        splitBillKnessetId: billMap.get(s.splitBillId)?.knessetId ?? 0,
      }));

      const stageInfo = computeBillStage(bill.status, bill.subTypeId);

      // Cluster context
      let cluster: { id: number; name: string; billCount: number | null } | null = null;
      if (bill.clusterId) {
        const [clusterRow] = await db
          .select({
            id: billClusters.id,
            name: billClusters.name,
            billCount: billClusters.billCount,
          })
          .from(billClusters)
          .where(eq(billClusters.id, bill.clusterId))
          .limit(1);
        if (clusterRow) cluster = clusterRow;
      }

      return { ...bill, initiators, relatedVotes, unions, splits, nameHistory, stageInfo, cluster };
    }),
});
