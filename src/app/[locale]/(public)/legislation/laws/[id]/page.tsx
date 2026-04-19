import { getTranslations } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import { eq, desc, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  bills,
  billClusters,
  billClusterMembers,
  billInitiators,
  members,
  votes,
} from '@/lib/db/schema';
import { computeBillStage } from '@/lib/knesset/bill-stages';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Link } from '@/i18n/navigation';
import { Layers, Vote, Users, Calendar, Bot, GitBranch } from 'lucide-react';
import AppBreadcrumb from '@/components/layout/AppBreadcrumb';
import { AIConfidenceBadge } from '@/components/legislation/AIConfidenceBadge';
import { CrossTermTimeline } from '@/components/legislation/CrossTermTimeline';
import { InteractiveStagePipeline } from '@/components/legislation/InteractiveStagePipeline';
import { ClusterRelationshipGraph } from '@/components/legislation/ClusterRelationshipGraph';
import { BillInClusterCard } from '@/components/legislation/BillInClusterCard';
import { ClusterVoteTimeline } from '@/components/legislation/ClusterVoteTimeline';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ClusterDetailPage({ params }: Props) {
  const { id } = await params;
  const t = await getTranslations('legislation');
  const tCommon = await getTranslations('common');
  const tNav = await getTranslations('nav');

  const clusterId = Number(id);
  if (isNaN(clusterId)) notFound();

  // Fetch cluster
  const clusterResult = await db
    .select()
    .from(billClusters)
    .where(eq(billClusters.id, clusterId))
    .limit(1);
  const [cluster] = clusterResult;

  if (!cluster) notFound();

  // Singleton clusters → redirect to the single bill
  if (cluster.billCount === 1 && cluster.primaryBillId) {
    redirect(`/legislation/${cluster.primaryBillId}`);
  }

  // Fetch member bills with membership info
  const memberRows = await db
    .select({
      membership: billClusterMembers,
      bill: bills,
    })
    .from(billClusterMembers)
    .innerJoin(bills, eq(billClusterMembers.billId, bills.id))
    .where(eq(billClusterMembers.clusterId, clusterId))
    .orderBy(desc(bills.proposedDate));

  const memberBills = memberRows.map((row) => {
    const stageInfo = computeBillStage(
      row.bill.status,
      row.bill.subTypeId ?? undefined,
      row.bill.billType ?? undefined,
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

  const billIds = memberBills.map((b) => b.id);

  // Fetch all votes and initiators in parallel
  const [clusterVotes, clusterInitiators] = await Promise.all([
    billIds.length > 0
      ? db
          .select({
            id: votes.id,
            knessetId: votes.knessetId,
            title: votes.title,
            voteDate: votes.voteDate,
            billId: votes.billId,
            knessetNum: votes.knessetNum,
            forCount: votes.forCount,
            againstCount: votes.againstCount,
            abstainCount: votes.abstainCount,
            isAccepted: votes.isAccepted,
          })
          .from(votes)
          .where(sql`${votes.billId} IN ${billIds}`)
          .orderBy(desc(votes.voteDate))
      : Promise.resolve(
          [] as {
            id: number;
            knessetId: number;
            title: string;
            voteDate: Date;
            billId: number | null;
            knessetNum: number | null;
            forCount: number | null;
            againstCount: number | null;
            abstainCount: number | null;
            isAccepted: boolean | null;
          }[],
        ),
    billIds.length > 0
      ? db
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
      : Promise.resolve(
          [] as {
            billId: number;
            memberId: number;
            firstName: string | null;
            lastName: string | null;
            isPrimary: boolean | null;
          }[],
        ),
  ]);

  // Build votes-by-bill lookup
  const votesByBill = new Map<number, typeof clusterVotes>();
  for (const v of clusterVotes) {
    if (v.billId == null) continue;
    if (!votesByBill.has(v.billId)) votesByBill.set(v.billId, []);
    votesByBill.get(v.billId)!.push(v);
  }

  // Build initiators-by-bill lookup
  const initiatorsByBill = new Map<number, typeof clusterInitiators>();
  for (const init of clusterInitiators) {
    if (!initiatorsByBill.has(init.billId))
      initiatorsByBill.set(init.billId, []);
    initiatorsByBill.get(init.billId)!.push(init);
  }

  // Primary bill for interactive stage pipeline
  const primaryBill =
    memberBills.find((b) => b.membership.isPrimary) ?? memberBills[0];
  const primaryBillVotes = primaryBill
    ? (votesByBill.get(primaryBill.id) ?? [])
    : [];

  // Cross-term timeline data
  const billsByKnesset = new Map<number, typeof memberBills>();
  for (const bill of memberBills) {
    const k = bill.knessetNum ?? 0;
    if (!billsByKnesset.has(k)) billsByKnesset.set(k, []);
    billsByKnesset.get(k)!.push(bill);
  }
  const knessetNums = [...billsByKnesset.keys()].filter((k) => k > 0).sort();
  const knessetRange: [number, number] =
    knessetNums.length > 0
      ? [knessetNums[0], knessetNums[knessetNums.length - 1]]
      : [25, 25];

  const timelineEntries = knessetNums.map((kNum) => ({
    knessetNum: kNum,
    bills: (billsByKnesset.get(kNum) ?? []).map((b) => ({
      id: b.id,
      name: b.name,
      currentStage: t(`stages.${b.stageInfo.currentStage}` as any),
      isPrimary: b.membership.isPrimary ?? false,
      proposedDate: b.proposedDate,
    })),
  }));

  // Relationship graph
  const graphNodes = memberBills.map((b) => ({
    id: b.id,
    name: b.name,
    knessetNum: b.knessetNum ?? 0,
    currentStage: t(`stages.${b.stageInfo.currentStage}` as any),
    isPrimary: b.membership.isPrimary ?? false,
  }));

  const graphEdges = memberBills
    .filter((b) => b.membership.relationshipType !== 'origin')
    .map((b) => ({
      from: primaryBill?.id ?? memberBills[0]?.id ?? 0,
      to: b.id,
      type: b.membership.relationshipType as
        | 'union'
        | 'split'
        | 'name-similarity'
        | 'ai',
      confidence: b.membership.confidence,
    }));

  // Aggregated initiators across all bills
  const allInitiators = new Map<
    number,
    { firstName: string | null; lastName: string | null; bills: number[] }
  >();
  for (const init of clusterInitiators) {
    if (!allInitiators.has(init.memberId)) {
      allInitiators.set(init.memberId, {
        firstName: init.firstName,
        lastName: init.lastName,
        bills: [],
      });
    }
    allInitiators.get(init.memberId)!.bills.push(init.billId);
  }
  const aggregatedInitiators = [...allInitiators.entries()].sort(
    (a, b) => b[1].bills.length - a[1].bills.length,
  );

  // Vote timeline data
  const timelineVotes = clusterVotes.map((v) => {
    const bill = memberBills.find((b) => b.id === v.billId);
    return {
      ...v,
      billName: bill?.name,
      knessetNum: v.knessetNum ?? undefined,
      voteDate: v.voteDate?.toISOString() ?? null,
      forCount: v.forCount ?? 0,
      againstCount: v.againstCount ?? 0,
      abstainCount: v.abstainCount ?? 0,
    };
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <AppBreadcrumb
        items={[
          { label: tNav('home'), href: '/' },
          { label: tNav('legislation'), href: '/legislation' },
          { label: cluster.name },
        ]}
      />

      {/* Section 1: Header */}
      <Card className="glass-card mb-6 overflow-hidden">
        <div className="from-primary/40 via-chart-2/30 to-chart-4/30 h-2 bg-gradient-to-r" />
        <CardContent className="p-6">
          <h1 className="text-xl font-bold sm:text-2xl">{cluster.name}</h1>
          {cluster.description && (
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              {cluster.description}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {cluster.category && (
              <Badge variant="outline">
                {t(`clusters.category.${cluster.category}` as any)}
              </Badge>
            )}
            {cluster.billType && (
              <Badge variant="secondary">{cluster.billType}</Badge>
            )}
            {cluster.hasCrossTermBills && (
              <Badge
                variant="outline"
                className="border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400"
              >
                <Calendar className="me-1 h-3 w-3" />
                {t('clusters.knessetRange', {
                  from: knessetRange[0],
                  to: knessetRange[1],
                })}
              </Badge>
            )}
            {cluster.aiProcessed && cluster.aiConfidence && (
              <AIConfidenceBadge confidence={cluster.aiConfidence} />
            )}
          </div>

          <Separator className="my-4" />

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="text-center">
              <Layers className="text-primary mx-auto mb-1 h-5 w-5" />
              <p className="text-lg font-bold">{cluster.billCount}</p>
              <p className="text-muted-foreground text-xs">
                {t('clusters.billCount', { count: cluster.billCount ?? 0 })}
              </p>
            </div>
            <div className="text-center">
              <Vote className="text-primary mx-auto mb-1 h-5 w-5" />
              <p className="text-lg font-bold">{clusterVotes.length}</p>
              <p className="text-muted-foreground text-xs">
                {t('clusters.voteCount', { count: clusterVotes.length })}
              </p>
            </div>
            <div className="text-center">
              <Users className="text-primary mx-auto mb-1 h-5 w-5" />
              <p className="text-lg font-bold">{allInitiators.size}</p>
              <p className="text-muted-foreground text-xs">
                {t('clusters.initiatorCount', { count: allInitiators.size })}
              </p>
            </div>
            <div className="text-center">
              <Calendar className="text-primary mx-auto mb-1 h-5 w-5" />
              <p className="text-lg font-bold">{knessetNums.length}</p>
              <p className="text-muted-foreground text-xs">
                {t('clusters.crossTerm')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Cross-Term Timeline */}
      {knessetNums.length > 1 && (
        <Card className="glass-card mb-6 overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="text-primary h-5 w-5" />
              {t('clusters.crossTerm')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CrossTermTimeline
              entries={timelineEntries}
              knessetRange={knessetRange}
            />
          </CardContent>
        </Card>
      )}

      {/* Section 3: Interactive Stage Pipeline (primary bill) */}
      {primaryBill && (
        <Card className="glass-card mb-6 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg">{primaryBill.name}</CardTitle>
            <p className="text-muted-foreground text-sm">
              {t('clusters.lawJourney')}
            </p>
          </CardHeader>
          <CardContent>
            <InteractiveStagePipeline
              stages={primaryBill.stageInfo.stages}
              specialStatus={primaryBill.stageInfo.specialStatus}
              votes={primaryBillVotes.map((v) => ({
                ...v,
                voteDate: v.voteDate?.toISOString() ?? null,
                forCount: v.forCount ?? 0,
                againstCount: v.againstCount ?? 0,
                abstainCount: v.abstainCount ?? 0,
              }))}
            />
          </CardContent>
        </Card>
      )}

      {/* Section 4: Relationship Graph */}
      {graphNodes.length > 1 && (
        <Card className="glass-card mb-6 overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <GitBranch className="text-primary h-5 w-5" />
              {t('clusters.relatedBills')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ClusterRelationshipGraph nodes={graphNodes} edges={graphEdges} />
          </CardContent>
        </Card>
      )}

      {/* Section 5: Bills Grid */}
      <Card className="glass-card mb-6 overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Layers className="text-primary h-5 w-5" />
            {t('clusters.relatedBillsAcrossTerms')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {memberBills.map((bill) => (
              <BillInClusterCard
                key={bill.id}
                id={bill.id}
                name={bill.name}
                knessetNum={bill.knessetNum}
                proposedDate={bill.proposedDate}
                stages={bill.stageInfo.stages}
                specialStatus={bill.stageInfo.specialStatus}
                votes={(votesByBill.get(bill.id) ?? []).map((v) => ({
                  ...v,
                  voteDate: v.voteDate?.toISOString() ?? null,
                  forCount: v.forCount ?? 0,
                  againstCount: v.againstCount ?? 0,
                  abstainCount: v.abstainCount ?? 0,
                }))}
                isPrimary={bill.membership.isPrimary ?? false}
                relationshipType={bill.membership.relationshipType}
                confidence={bill.membership.confidence}
                aiReasoning={bill.membership.aiReasoning}
                initiators={initiatorsByBill.get(bill.id)?.map((i) => ({
                  firstName: i.firstName,
                  lastName: i.lastName,
                  isPrimary: i.isPrimary ?? false,
                }))}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Section 6: Aggregated Initiators */}
      {aggregatedInitiators.length > 0 && (
        <Card className="glass-card mb-6 overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="text-primary h-5 w-5" />
              {t('clusters.initiatorCount', { count: allInitiators.size })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {aggregatedInitiators.map(([memberId, init]) => (
                <Link
                  key={memberId}
                  href={`/members/${memberId}`}
                  className="hover:bg-muted/30 flex items-center justify-between rounded-lg border p-3 transition-colors"
                >
                  <span className="text-sm font-medium">
                    {init.firstName} {init.lastName}
                  </span>
                  <Badge variant="secondary" className="text-[10px]">
                    {t('clusters.billCount', { count: init.bills.length })}
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section 7: Unified Vote Timeline */}
      {timelineVotes.length > 0 && (
        <Card className="glass-card overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Vote className="text-primary h-5 w-5" />
              {t('votes.voteTimeline')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ClusterVoteTimeline votes={timelineVotes} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
