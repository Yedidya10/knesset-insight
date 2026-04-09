import { getTranslations } from 'next-intl/server';
import {
  Shield,
  BarChart3,
  Bot,
  GitFork,
  Type,
  ClipboardList,
  Database,
  Brain,
} from 'lucide-react';
import { eq, and, lt, desc, sql } from 'drizzle-orm';
import { Link } from '@/i18n/navigation';
import { db } from '@/lib/db';
import { bills, billClusters, billClusterMembers, billEmbeddings } from '@/lib/db/schema';
import { appConfig } from '@/../app.config';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import AdminClusterActions from '@/components/legislation/AdminClusterActions';
import AdminManualLinkForm from '@/components/legislation/AdminManualLinkForm';

export default async function AdminClustersReviewPage() {
  const t = await getTranslations('admin');
  const tStats = await getTranslations('admin.stats');

  // Fetch stats and review queue in parallel
  const [
    totalClustersR,
    aiClustersR,
    formalClustersR,
    nameSimilarityR,
    approvedAiR,
    totalBillsR,
    embeddedBillsR,
    pendingReviewR,
    queueItems,
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
          lt(
            billClusters.aiConfidence,
            appConfig.billClusters.aiConfidenceThreshold,
          ),
        ),
      ),
    // Review queue: low-confidence AI clusters
    db
      .select({
        id: billClusters.id,
        name: billClusters.name,
        description: billClusters.description,
        billCount: billClusters.billCount,
        aiConfidence: billClusters.aiConfidence,
        latestKnessetNum: billClusters.latestKnessetNum,
        category: billClusters.category,
      })
      .from(billClusters)
      .where(
        and(
          eq(billClusters.aiProcessed, true),
          lt(
            billClusters.aiConfidence,
            appConfig.billClusters.aiConfidenceThreshold,
          ),
        ),
      )
      .orderBy(billClusters.aiConfidence)
      .limit(20),
  ]);

  const totalClusters = Number(totalClustersR[0]?.count ?? 0);
  const aiClusters = Number(aiClustersR[0]?.count ?? 0);
  const formalClusters = Number(formalClustersR[0]?.count ?? 0);
  const nameSimilarity = Number(nameSimilarityR[0]?.count ?? 0);
  const approvedAi = Number(approvedAiR[0]?.count ?? 0);
  const totalBills = Number(totalBillsR[0]?.count ?? 0);
  const embeddedBills = Number(embeddedBillsR[0]?.count ?? 0);
  const pendingReview = Number(pendingReviewR[0]?.count ?? 0);
  const aiAccuracy = aiClusters > 0 ? Math.round((approvedAi / aiClusters) * 100) : 0;
  const embeddingCoverage =
    totalBills > 0 ? Math.round((embeddedBills / totalBills) * 100) : 0;

  // Get member bills for queue items
  const queueWithBills = await Promise.all(
    queueItems.map(async (item) => {
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

  const statCards = [
    {
      label: tStats('totalClusters'),
      value: totalClusters,
      icon: Database,
      color: 'text-blue-500',
    },
    {
      label: tStats('formalClusters'),
      value: formalClusters,
      icon: GitFork,
      color: 'text-violet-500',
    },
    {
      label: tStats('nameSimilarity'),
      value: nameSimilarity,
      icon: Type,
      color: 'text-amber-500',
    },
    {
      label: tStats('aiClusters'),
      value: aiClusters,
      icon: Bot,
      color: 'text-primary',
    },
    {
      label: tStats('aiAccuracy'),
      value: `${aiAccuracy}%`,
      icon: BarChart3,
      color: aiAccuracy >= 80 ? 'text-green-500' : aiAccuracy >= 50 ? 'text-amber-500' : 'text-red-500',
    },
    {
      label: tStats('embeddingCoverage'),
      value: `${embeddingCoverage}%`,
      icon: Brain,
      color: 'text-cyan-500',
    },
    {
      label: tStats('totalBills'),
      value: totalBills,
      icon: ClipboardList,
      color: 'text-muted-foreground',
    },
    {
      label: tStats('pendingReview'),
      value: pendingReview,
      icon: Shield,
      color: pendingReview > 0 ? 'text-orange-500' : 'text-green-500',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">{t('clusterReview')}</h1>
          <p className="text-muted-foreground">
            {t('pendingReview', { count: pendingReview })}
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <section>
        <h2 className="text-xl font-semibold mb-4">{tStats('title')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  <span className="text-sm text-muted-foreground">{stat.label}</span>
                </div>
                <p className="text-2xl font-bold">{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Embedding progress bar */}
        <div className="mt-4">
          <div className="flex justify-between text-sm text-muted-foreground mb-1">
            <span>{tStats('embeddingCoverage')}</span>
            <span>
              {embeddedBills} / {totalBills}
            </span>
          </div>
          <Progress value={embeddingCoverage} className="h-2" />
        </div>
      </section>

      {/* Manual Link Form */}
      <section>
        <h2 className="text-xl font-semibold mb-4">{t('manualLink')}</h2>
        <Card>
          <CardContent className="p-4">
            <AdminManualLinkForm />
          </CardContent>
        </Card>
      </section>

      {/* Review Queue */}
      <section>
        <h2 className="text-xl font-semibold mb-4">{t('reviewQueue')}</h2>
        {queueWithBills.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              {t('noItemsInQueue')}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {queueWithBills.map((cluster) => (
              <Card key={cluster.id}>
                <CardContent className="p-4 space-y-3">
                  {/* Cluster header */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/legislation/laws/${cluster.id}`}
                          className="font-semibold hover:text-primary transition-colors truncate"
                        >
                          {cluster.name}
                        </Link>
                        <Badge variant="outline" className="text-xs">
                          K{cluster.latestKnessetNum}
                        </Badge>
                        {cluster.category && (
                          <Badge variant="secondary" className="text-xs">
                            {cluster.category}
                          </Badge>
                        )}
                      </div>
                      {cluster.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {cluster.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-end">
                        <span className="text-xs text-muted-foreground">
                          {t('confidence')}
                        </span>
                        <p className="text-lg font-bold text-orange-500">
                          {cluster.aiConfidence != null
                            ? `${Math.round(cluster.aiConfidence * 100)}%`
                            : '—'}
                        </p>
                      </div>
                      <AdminClusterActions clusterId={cluster.id} />
                    </div>
                  </div>

                  {/* Member bills */}
                  {cluster.bills.length > 0 && (
                    <div className="border-t pt-3">
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        {t('memberBills')} ({cluster.billCount})
                      </p>
                      <div className="space-y-2">
                        {cluster.bills.map((bill) => (
                          <div
                            key={bill.billId}
                            className="flex flex-wrap items-center gap-2 text-sm"
                          >
                            <Link
                              href={`/legislation/${bill.billId}`}
                              className="hover:text-primary transition-colors"
                            >
                              {bill.billName}
                            </Link>
                            <Badge
                              variant="outline"
                              className="text-xs"
                            >
                              {bill.relationshipType}
                            </Badge>
                            {bill.confidence != null && (
                              <span className="text-xs text-muted-foreground">
                                ({Math.round(bill.confidence * 100)}%)
                              </span>
                            )}
                            {bill.aiReasoning && (
                              <span
                                className="text-xs text-muted-foreground truncate max-w-xs"
                                title={bill.aiReasoning}
                              >
                                — {bill.aiReasoning}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
