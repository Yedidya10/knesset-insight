import { getTranslations, getLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { eq, desc, sql, inArray } from 'drizzle-orm';
import { Users, ExternalLink, Layers } from 'lucide-react';
import { db } from '@/lib/db';
import {
  bills,
  billInitiators,
  billUnions,
  billSplits,
  billNames,
  members,
  votes,
  billClusters,
  billClusterMembers,
} from '@/lib/db/schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import MemberAvatar from '@/components/members/MemberAvatar';
import { InteractiveStagePipeline } from '@/components/legislation/InteractiveStagePipeline';
import type { RelationshipEvent } from '@/components/legislation/InteractiveStagePipeline';
import { RelatedBillsCard } from '@/components/legislation/RelatedBillsCard';
import { computeBillStage } from '@/lib/knesset/bill-stages';
import {
  getBillStatusText,
  getKnessetBillUrl,
} from '@/lib/knesset/bill-status';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function BillDetailPage({ params }: Props) {
  const { id } = await params;
  const billId = Number(id);
  if (Number.isNaN(billId)) notFound();

  const t = await getTranslations('legislation');
  const tCommon = await getTranslations('common');
  const locale = await getLocale();

  const result = await db
    .select({
      id: bills.id,
      knessetId: bills.knessetId,
      name: bills.name,
      summary: bills.summary,
      status: bills.status,
      billType: bills.billType,
      subTypeId: bills.subTypeId,
      isContinuationBill: bills.isContinuationBill,
      committeeId: bills.committeeId,
      knessetNum: bills.knessetNum,
      proposedDate: bills.proposedDate,
      lastUpdate: bills.lastUpdate,
      fullTextUrl: bills.fullTextUrl,
      aiSummary: bills.aiSummary,
      aiTopics: bills.aiTopics,
    })
    .from(bills)
    .where(eq(bills.id, billId))
    .limit(1);
  const bill = result[0];
  if (!bill) notFound();

  // Fetch related data in parallel
  const [initiatorRows, relatedVotes, rawUnions, rawSplits, nameRows] =
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
        .where(eq(billInitiators.billId, billId)),

      db
        .select({
          id: votes.id,
          title: votes.title,
          voteDate: votes.voteDate,
          isAccepted: votes.isAccepted,
          forCount: votes.forCount,
          againstCount: votes.againstCount,
          abstainCount: votes.abstainCount,
          billStage: votes.billStage,
        })
        .from(votes)
        .where(eq(votes.billId, billId))
        .orderBy(desc(votes.voteDate)),

      // Unions where this bill was absorbed (this bill → merged into main)
      db
        .select({
          id: billUnions.id,
          mainBillId: billUnions.mainBillId,
          lastUpdated: billUnions.lastUpdated,
        })
        .from(billUnions)
        .where(eq(billUnions.unionBillId, billId)),

      // Splits where this bill is the origin (this bill → split into children)
      db
        .select({
          id: billSplits.id,
          splitBillId: billSplits.splitBillId,
          lastUpdated: billSplits.lastUpdated,
        })
        .from(billSplits)
        .where(eq(billSplits.mainBillId, billId)),

      // Name history
      db
        .select({
          name: billNames.name,
          typeDesc: billNames.nameHistoryTypeDesc,
        })
        .from(billNames)
        .where(eq(billNames.billId, billId)),
    ]);

  // Reverse relationships (parallel)
  const [rawSplitFrom, rawMergedFrom] = await Promise.all([
    // This bill was split FROM a parent bill
    db
      .select({
        id: billSplits.id,
        mainBillId: billSplits.mainBillId,
        lastUpdated: billSplits.lastUpdated,
      })
      .from(billSplits)
      .where(eq(billSplits.splitBillId, billId)),

    // Bills that were absorbed INTO this bill
    db
      .select({
        id: billUnions.id,
        unionBillId: billUnions.unionBillId,
        lastUpdated: billUnions.lastUpdated,
      })
      .from(billUnions)
      .where(eq(billUnions.mainBillId, billId)),
  ]);

  // Resolve bill names for all relationships in a single lookup
  const relatedBillIds = [
    ...rawUnions.map((u) => u.mainBillId),
    ...rawSplits.map((s) => s.splitBillId),
    ...rawSplitFrom.map((sf) => sf.mainBillId),
    ...rawMergedFrom.map((mf) => mf.unionBillId),
  ];
  const relatedBillMap = new Map<
    number,
    { name: string | null; knessetId: number; knessetNum: number | null }
  >();
  if (relatedBillIds.length > 0) {
    const relatedBills = await db
      .select({
        id: bills.id,
        name: bills.name,
        knessetId: bills.knessetId,
        knessetNum: bills.knessetNum,
      })
      .from(bills)
      .where(inArray(bills.id, relatedBillIds));
    for (const b of relatedBills) {
      relatedBillMap.set(b.id, {
        name: b.name,
        knessetId: b.knessetId,
        knessetNum: b.knessetNum,
      });
    }
  }
  const unionRows = rawUnions.map((u) => ({
    id: u.id,
    mainBillId: u.mainBillId,
    mainBillName: relatedBillMap.get(u.mainBillId)?.name ?? null,
    mainBillKnessetId: relatedBillMap.get(u.mainBillId)?.knessetId ?? 0,
    mainBillKnessetNum: relatedBillMap.get(u.mainBillId)?.knessetNum ?? null,
    date: u.lastUpdated?.toISOString() ?? null,
  }));
  const splitRows = rawSplits.map((s) => ({
    id: s.id,
    splitBillId: s.splitBillId,
    splitBillName: relatedBillMap.get(s.splitBillId)?.name ?? null,
    splitBillKnessetId: relatedBillMap.get(s.splitBillId)?.knessetId ?? 0,
    splitBillKnessetNum: relatedBillMap.get(s.splitBillId)?.knessetNum ?? null,
    date: s.lastUpdated?.toISOString() ?? null,
  }));
  const splitFromRows = rawSplitFrom.map((sf) => ({
    id: sf.id,
    mainBillId: sf.mainBillId,
    mainBillName: relatedBillMap.get(sf.mainBillId)?.name ?? null,
    mainBillKnessetId: relatedBillMap.get(sf.mainBillId)?.knessetId ?? 0,
    mainBillKnessetNum: relatedBillMap.get(sf.mainBillId)?.knessetNum ?? null,
    date: sf.lastUpdated?.toISOString() ?? null,
  }));
  const mergedFromRows = rawMergedFrom.map((mf) => ({
    id: mf.id,
    unionBillId: mf.unionBillId,
    unionBillName: relatedBillMap.get(mf.unionBillId)?.name ?? null,
    unionBillKnessetId: relatedBillMap.get(mf.unionBillId)?.knessetId ?? 0,
    unionBillKnessetNum: relatedBillMap.get(mf.unionBillId)?.knessetNum ?? null,
    date: mf.lastUpdated?.toISOString() ?? null,
  }));

  const stageInfo = computeBillStage(
    bill.status,
    bill.subTypeId,
    bill.billType,
  );
  const statusText = getBillStatusText(bill.status);
  const knessetUrl = bill.knessetId ? getKnessetBillUrl(bill.knessetId) : null;

  // Fetch cluster info if bill belongs to one
  const [clusterRow] = await db
    .select({
      id: billClusters.id,
      name: billClusters.name,
      billCount: billClusters.billCount,
    })
    .from(billClusterMembers)
    .innerJoin(billClusters, eq(billClusterMembers.clusterId, billClusters.id))
    .where(eq(billClusterMembers.billId, billId))
    .limit(1);
  const cluster =
    clusterRow && (clusterRow.billCount ?? 0) > 1 ? clusterRow : null;

  // Fetch cluster siblings (other bills in same cluster)
  let clusterSiblings: {
    id: number;
    name: string | null;
    knessetNum: number | null;
  }[] = [];
  if (cluster) {
    const siblingRows = await db
      .select({
        billId: billClusterMembers.billId,
        name: bills.name,
        knessetNum: bills.knessetNum,
      })
      .from(billClusterMembers)
      .innerJoin(bills, eq(billClusterMembers.billId, bills.id))
      .where(eq(billClusterMembers.clusterId, cluster.id));
    clusterSiblings = siblingRows
      .filter((s) => s.billId !== billId)
      .map((s) => ({ id: s.billId, name: s.name, knessetNum: s.knessetNum }));
  }

  // Build relationship events for the stage pipeline
  const relationshipEvents: RelationshipEvent[] = [
    ...unionRows.map((u) => ({
      type: 'mergedInto' as const,
      billId: u.mainBillId,
      billName: u.mainBillName,
      date: u.date,
    })),
    ...splitFromRows.map((sf) => ({
      type: 'splitFrom' as const,
      billId: sf.mainBillId,
      billName: sf.mainBillName,
      date: sf.date,
    })),
    ...splitRows.map((s) => ({
      type: 'splitInto' as const,
      billId: s.splitBillId,
      billName: s.splitBillName,
      date: s.date,
    })),
    ...mergedFromRows.map((mf) => ({
      type: 'mergedFrom' as const,
      billId: mf.unionBillId,
      billName: mf.unionBillName,
      date: mf.date,
    })),
  ];

  const billTypeKey =
    bill.subTypeId === 53
      ? 'government'
      : bill.subTypeId === 54
        ? 'private'
        : bill.subTypeId === 55
          ? 'committee'
          : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Button
        variant="ghost"
        size="sm"
        className="mb-6"
        render={<Link href="/legislation" />}
      >
        {tCommon('back')}
      </Button>

      {/* Main card */}
      <Card className="glass-card mb-6 overflow-hidden">
        <div className="from-primary/40 via-chart-2/30 to-chart-4/30 h-2 bg-linear-to-r" />
        <CardContent className="p-6">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{statusText}</Badge>
            {billTypeKey && (
              <Badge variant="outline">{t(`billType.${billTypeKey}`)}</Badge>
            )}
            {bill.knessetNum && (
              <Badge variant="outline">
                {t('knessetNum', { num: bill.knessetNum })}
              </Badge>
            )}
          </div>

          <h1 className="text-xl font-bold sm:text-2xl">{bill.name}</h1>

          {(bill.summary || bill.aiSummary) && (
            <div className="bg-muted/50 mt-3 rounded-lg border p-4">
              <h2 className="text-sm font-semibold">
                {t('summary')}
                {!bill.summary && bill.aiSummary && (
                  <Badge variant="outline" className="ms-2 text-xs font-normal">
                    {t('aiSummary')}
                  </Badge>
                )}
              </h2>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                {bill.summary ?? bill.aiSummary?.[locale] ?? bill.aiSummary?.he}
              </p>
              {bill.aiTopics && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(bill.aiTopics[locale] ?? bill.aiTopics.he ?? []).map(
                    (topic) => (
                      <Badge
                        key={topic}
                        variant="secondary"
                        className="text-xs"
                      >
                        {topic}
                      </Badge>
                    ),
                  )}
                </div>
              )}
            </div>
          )}

          <Separator className="my-5" />

          {/* Interactive stage pipeline — single stepper with vote drill-down */}
          <InteractiveStagePipeline
            stages={stageInfo.stages}
            specialStatus={stageInfo.specialStatus}
            votes={relatedVotes.map((v) => ({
              id: v.id,
              title: v.title,
              voteDate: v.voteDate?.toISOString() ?? null,
              forCount: v.forCount ?? 0,
              againstCount: v.againstCount ?? 0,
              abstainCount: v.abstainCount ?? 0,
              isAccepted: v.isAccepted,
              billStage: v.billStage,
            }))}
            relationshipEvents={relationshipEvents}
            billId={billId}
            currentStatusId={bill.status}
          />

          {/* Cluster banner */}
          {cluster && (
            <div className="mt-4">
              <Link
                href={`/legislation/laws/${cluster.id}`}
                className="border-primary/20 bg-primary/5 hover:bg-primary/10 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors"
              >
                <Layers className="text-primary h-4 w-4 shrink-0" />
                <span className="text-primary">
                  {t('clusters.partOfCluster', { name: cluster.name })}
                </span>
                <Badge variant="outline" className="ms-auto text-[10px]">
                  {t('clusters.billCount', { count: cluster.billCount ?? 0 })}
                </Badge>
              </Link>
            </div>
          )}

          {/* Name history */}
          {nameRows.length > 0 && (
            <div className="mt-4 space-y-1">
              <p className="text-muted-foreground text-xs font-medium">
                {t('nameHistory')}
              </p>
              {nameRows.map((n, i) => (
                <div key={i} className="flex items-baseline gap-2 text-sm">
                  {n.typeDesc && (
                    <Badge variant="outline" className="text-[10px]">
                      {n.typeDesc}
                    </Badge>
                  )}
                  <span>{n.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* External link */}
          {knessetUrl && (
            <div className="mt-4">
              <a
                href={knessetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary inline-flex items-center gap-1.5 text-sm underline-offset-2 hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {t('viewOnKnesset')}
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Initiators */}
      {initiatorRows.length > 0 && (
        <Card className="glass-card mb-6 overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="text-primary h-5 w-5" />
              {t('initiators')}
              <span className="text-muted-foreground text-sm font-normal">
                ({initiatorRows.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {initiatorRows.map((m) => (
                <Link
                  key={m.memberId}
                  href={`/members/${m.memberId}`}
                  className="hover:bg-muted/50 flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors"
                >
                  <MemberAvatar
                    member={m}
                    size="sm"
                    ring="ring-2 ring-background"
                    className="h-10 w-10 shadow-sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {m.firstName} {m.lastName}
                    </p>
                  </div>
                  {m.isPrimary && (
                    <Badge variant="default" className="shrink-0 text-[10px]">
                      {t('primaryInitiator')}
                    </Badge>
                  )}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Related bills (cluster siblings only — splits/merges already shown in pipeline) */}
      <RelatedBillsCard
        clusterSiblings={clusterSiblings}
        cluster={cluster ? { id: cluster.id, name: cluster.name } : null}
      />
    </div>
  );
}
