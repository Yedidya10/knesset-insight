import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { eq, desc, sql, inArray } from 'drizzle-orm';
import { FileText, Users, Vote, ExternalLink, Layers } from 'lucide-react';
import { db } from '@/lib/db';
import { bills, billInitiators, billUnions, billSplits, billNames, members, votes, billClusters, billClusterMembers } from '@/lib/db/schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import MemberAvatar from '@/components/members/MemberAvatar';
import { BillStagePipeline } from '@/components/legislation/BillStagePipeline';
import { BillRelationshipBanner } from '@/components/legislation/BillRelationshipBanner';
import { InteractiveStagePipeline } from '@/components/legislation/InteractiveStagePipeline';
import { computeBillStage } from '@/lib/knesset/bill-stages';
import { getBillStatusText, getKnessetBillUrl } from '@/lib/knesset/bill-status';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function BillDetailPage({ params }: Props) {
  const { id } = await params;
  const billId = Number(id);
  if (Number.isNaN(billId)) notFound();

  const t = await getTranslations('legislation');
  const tCommon = await getTranslations('common');

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
        })
        .from(votes)
        .where(eq(votes.billId, billId))
        .orderBy(desc(votes.voteDate)),

      // Unions where this bill was absorbed
      db
        .select({ id: billUnions.id, mainBillId: billUnions.mainBillId })
        .from(billUnions)
        .where(eq(billUnions.unionBillId, billId)),

      // Splits where this bill is the origin
      db
        .select({ id: billSplits.id, splitBillId: billSplits.splitBillId })
        .from(billSplits)
        .where(eq(billSplits.mainBillId, billId)),

      // Name history
      db
        .select({ name: billNames.name, typeDesc: billNames.nameHistoryTypeDesc })
        .from(billNames)
        .where(eq(billNames.billId, billId)),
    ]);

  // Resolve bill names for unions/splits in a single lookup
  const relatedBillIds = [
    ...rawUnions.map((u) => u.mainBillId),
    ...rawSplits.map((s) => s.splitBillId),
  ];
  const relatedBillMap = new Map<number, { name: string | null; knessetId: number }>();
  if (relatedBillIds.length > 0) {
    const relatedBills = await db
      .select({ id: bills.id, name: bills.name, knessetId: bills.knessetId })
      .from(bills)
      .where(inArray(bills.id, relatedBillIds));
    for (const b of relatedBills) {
      relatedBillMap.set(b.id, { name: b.name, knessetId: b.knessetId });
    }
  }
  const unionRows = rawUnions.map((u) => ({
    id: u.id,
    mainBillId: u.mainBillId,
    mainBillName: relatedBillMap.get(u.mainBillId)?.name ?? null,
    mainBillKnessetId: relatedBillMap.get(u.mainBillId)?.knessetId ?? 0,
  }));
  const splitRows = rawSplits.map((s) => ({
    id: s.id,
    splitBillId: s.splitBillId,
    splitBillName: relatedBillMap.get(s.splitBillId)?.name ?? null,
    splitBillKnessetId: relatedBillMap.get(s.splitBillId)?.knessetId ?? 0,
  }));

  const stageInfo = computeBillStage(bill.status, bill.subTypeId);
  const statusText = getBillStatusText(bill.status);
  const knessetUrl = bill.knessetId ? getKnessetBillUrl(bill.knessetId) : null;

  // Fetch cluster info if bill belongs to one (via billClusterMembers — safe without migration)
  let cluster: { id: number; name: string; billCount: number | null } | null = null;
  try {
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
    if (clusterRow && (clusterRow.billCount ?? 0) > 1) cluster = clusterRow;
  } catch {
    // bill_cluster_members table may not exist yet
  }

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
      <Button variant="ghost" size="sm" className="mb-6" render={<Link href="/legislation" />}>
        {tCommon('back')}
      </Button>

      {/* Main card */}
      <Card className="glass-card mb-6 overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-primary/40 via-chart-2/30 to-chart-4/30" />
        <CardContent className="p-6">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{statusText}</Badge>
            {billTypeKey && (
              <Badge variant="outline">{t(`billType.${billTypeKey}`)}</Badge>
            )}
            {bill.knessetNum && (
              <Badge variant="outline">{t('knessetNum', { num: bill.knessetNum })}</Badge>
            )}
          </div>

          <h1 className="text-xl font-bold sm:text-2xl">{bill.name}</h1>

          {bill.summary && (
            <p className="mt-2 text-sm text-muted-foreground">{bill.summary}</p>
          )}

          <Separator className="my-5" />

          {/* Stage pipeline */}
          <BillStagePipeline
            stages={stageInfo.stages}
            specialStatus={stageInfo.specialStatus}
          />

          {/* Relationship banners */}
          <div className="mt-4">
            <BillRelationshipBanner
              specialStatus={stageInfo.specialStatus}
              isContinuationBill={bill.isContinuationBill}
              unions={unionRows}
              splits={splitRows}
            />
          </div>

          {/* Cluster banner */}
          {cluster && (
            <div className="mt-4">
              <Link
                href={`/legislation/laws/${cluster.id}`}
                className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm transition-colors hover:bg-primary/10"
              >
                <Layers className="h-4 w-4 shrink-0 text-primary" />
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
              <p className="text-xs font-medium text-muted-foreground">{t('nameHistory')}</p>
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
                className="inline-flex items-center gap-1.5 text-sm text-primary underline-offset-2 hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {t('viewOnKnesset')}
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bottom grid: initiators + votes */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Initiators */}
        <Card className="glass-card overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-primary" />
              {t('initiators')}
              {initiatorRows.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground">
                  ({initiatorRows.length})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {initiatorRows.length > 0 ? (
              <div className="divide-y">
                {initiatorRows.map((m) => (
                  <Link
                    key={m.memberId}
                    href={`/members/${m.memberId}`}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 transition-colors hover:bg-muted/50 -mx-2 px-2 rounded-lg"
                  >
                    <MemberAvatar
                      member={m}
                      size="sm"
                      ring="ring-2 ring-background"
                      className="h-10 w-10 shadow-sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">
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
            ) : (
              <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
                <Users className="h-10 w-10 opacity-20" />
                <p className="text-sm">{t('noInitiators')}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Related votes — interactive stage pipeline */}
        <Card className="glass-card overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Vote className="h-5 w-5 text-primary" />
              {t('relatedVotes')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {relatedVotes.length > 0 ? (
              <div className="space-y-4">
                {/* Stage-grouped interactive pipeline with vote panels */}
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
                  }))}
                />

                {/* Flat list fallback for all votes (billStage unavailable until migration) */}
                {relatedVotes.length > 0 && (
                  <div className="mt-4 space-y-2 border-t pt-4">
                    <p className="text-xs font-medium text-muted-foreground">{t('relatedVotes')}</p>
                    {relatedVotes.map((v) => (
                      <Link
                        key={v.id}
                        href={`/votes/${v.id}`}
                        className="block rounded-lg border p-3 transition-colors hover:bg-muted"
                      >
                        <p className="text-sm font-medium">{v.title}</p>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          {v.voteDate && (
                            <span>{new Date(v.voteDate).toLocaleDateString()}</span>
                          )}
                          <Badge variant={v.isAccepted ? 'default' : 'destructive'} className="text-[10px]">
                            {v.isAccepted ? t('accepted') : t('rejected')}
                          </Badge>
                          <span>
                            {v.forCount ?? 0}/{v.againstCount ?? 0}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
                <Vote className="h-10 w-10 opacity-20" />
                <p className="text-sm">{t('noVotes')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
