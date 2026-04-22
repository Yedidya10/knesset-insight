import { getTranslations } from 'next-intl/server';
import { Brain, GitFork, Shield, FileText } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { sql, eq, and, lt, isNull, isNotNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  billClusters,
  integrityCases,
  bills,
  billStageSummaries,
} from '@/lib/db/schema';
import { appConfig } from '@/../app.config';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function AIReviewPage() {
  const t = await getTranslations('admin.aiReview');

  const needsReviewExpr = sql<boolean>`(
    ${bills.summary} IS NULL
    AND ${bills.aiSummary} IS NOT NULL
    AND (
      ${bills.lastUpdate} > COALESCE((${bills.metadata}->>'aiSummaryGeneratedAt')::timestamptz, '1970-01-01'::timestamptz)
      OR (
        ${bills.currentStage} IS NOT NULL
        AND ${bills.currentStage} > COALESCE(
          (SELECT MAX(${billStageSummaries.stage}) FROM ${billStageSummaries} WHERE ${billStageSummaries.billId} = ${bills.id}),
          -1
        )
      )
    )
  )`;

  const [pendingClusters, pendingIntegrity, pendingSummaries] =
    await Promise.all([
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
      db
        .select({ count: sql<number>`count(*)` })
        .from(integrityCases)
        .where(eq(integrityCases.verified, false)),
      db
        .select({
          missing: sql<number>`count(*) FILTER (WHERE ${isNull(bills.summary)} AND ${isNull(bills.aiSummary)})::int`,
          review: sql<number>`count(*) FILTER (WHERE ${needsReviewExpr})::int`,
        })
        .from(bills)
        .where(isNotNull(bills.knessetNum)),
    ]);

  const summariesPending =
    Number(pendingSummaries[0]?.missing ?? 0) +
    Number(pendingSummaries[0]?.review ?? 0);

  const reviewSections = [
    {
      key: 'billSummaries',
      href: '/admin/ai-review/bill-summaries',
      icon: FileText,
      pending: summariesPending,
    },
    {
      key: 'clusters',
      href: '/admin/ai-review/clusters',
      icon: GitFork,
      pending: Number(pendingClusters[0]?.count ?? 0),
    },
    {
      key: 'integrity',
      href: '/admin/integrity',
      icon: Shield,
      pending: Number(pendingIntegrity[0]?.count ?? 0),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Brain className="text-primary h-7 w-7" />
        <h1 className="text-2xl font-bold">{t('title')}</h1>
      </div>

      <p className="text-muted-foreground">{t('description')}</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {reviewSections.map(({ key, href, icon: Icon, pending }) => (
          <Link key={key} href={href}>
            <Card className="hover:border-primary/50 transition-colors">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="bg-primary/10 rounded-lg p-3">
                  <Icon className="text-primary h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">{t(`sections.${key}`)}</h3>
                  <p className="text-muted-foreground text-sm">
                    {t(`sections.${key}Description`)}
                  </p>
                </div>
                {pending > 0 && <Badge variant="destructive">{pending}</Badge>}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
