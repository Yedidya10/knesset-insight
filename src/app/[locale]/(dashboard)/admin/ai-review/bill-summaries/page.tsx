import { getTranslations, getLocale } from 'next-intl/server';
import { FileText } from 'lucide-react';
import { eq, and, inArray, isNull, isNotNull, sql, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { bills, billStageSummaries } from '@/lib/db/schema';
import { Card, CardContent } from '@/components/ui/card';
import AdminBillSummariesTable from '@/components/admin/AdminBillSummariesTable';
import type { BillSummaryRow } from '@/components/admin/AdminBillSummariesTable';

export const dynamic = 'force-dynamic';

type Filter = 'all' | 'missing' | 'ai_only' | 'official' | 'needs_review';

interface Props {
  searchParams: Promise<{
    knesset?: string;
    filter?: string;
    q?: string;
  }>;
}

const ALLOWED_KNESSETS = [25, 24, 23, 22, 21, 20] as const;

export default async function AdminBillSummariesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const t = await getTranslations('admin.billSummaries');
  const locale = await getLocale();

  const knesset = ALLOWED_KNESSETS.find((k) => String(k) === sp.knesset) as
    | number
    | undefined;
  const filter: Filter = (
    ['all', 'missing', 'ai_only', 'official', 'needs_review'].includes(
      sp.filter ?? '',
    )
      ? sp.filter
      : 'all'
  ) as Filter;
  const q = sp.q?.trim() ?? '';

  // SQL expression: bill needs review
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

  const conditions = [
    knesset ? eq(bills.knessetNum, knesset) : undefined,
    q.length > 0 ? sql`${bills.name} ILIKE ${'%' + q + '%'}` : undefined,
    filter === 'missing'
      ? and(isNull(bills.summary), isNull(bills.aiSummary))
      : undefined,
    filter === 'ai_only'
      ? and(isNull(bills.summary), isNotNull(bills.aiSummary))
      : undefined,
    filter === 'official' ? isNotNull(bills.summary) : undefined,
    filter === 'needs_review' ? needsReviewExpr : undefined,
  ].filter(Boolean);

  const rows = await db
    .select({
      id: bills.id,
      knessetId: bills.knessetId,
      name: bills.name,
      knessetNum: bills.knessetNum,
      status: bills.status,
      billType: bills.billType,
      currentStage: bills.currentStage,
      lastUpdate: bills.lastUpdate,
      hasOfficial: sql<boolean>`(${bills.summary} IS NOT NULL AND length(trim(${bills.summary})) > 0)`,
      hasAi: sql<boolean>`${bills.aiSummary} IS NOT NULL`,
      aiSourceType: sql<
        string | null
      >`${bills.metadata}->>'aiSummarySourceType'`,
      aiGeneratedAt: sql<
        string | null
      >`${bills.metadata}->>'aiSummaryGeneratedAt'`,
      needsReview: needsReviewExpr,
    })
    .from(bills)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(bills.lastUpdate))
    .limit(200);

  // Count aggregates for the tabs
  const [aggRow] = await db
    .select({
      total: sql<number>`count(*)::int`,
      missing: sql<number>`count(*) FILTER (WHERE ${bills.summary} IS NULL AND ${bills.aiSummary} IS NULL)::int`,
      aiOnly: sql<number>`count(*) FILTER (WHERE ${bills.summary} IS NULL AND ${bills.aiSummary} IS NOT NULL)::int`,
      official: sql<number>`count(*) FILTER (WHERE ${bills.summary} IS NOT NULL)::int`,
      needsReview: sql<number>`count(*) FILTER (WHERE ${needsReviewExpr})::int`,
    })
    .from(bills)
    .where(knesset ? eq(bills.knessetNum, knesset) : undefined);

  const counts = {
    all: aggRow?.total ?? 0,
    missing: aggRow?.missing ?? 0,
    ai_only: aggRow?.aiOnly ?? 0,
    official: aggRow?.official ?? 0,
    needs_review: aggRow?.needsReview ?? 0,
  };

  const tableRows: BillSummaryRow[] = rows.map((r) => ({
    id: r.id,
    knessetId: r.knessetId,
    name: r.name,
    knessetNum: r.knessetNum,
    status: r.status,
    billType: r.billType,
    currentStage: r.currentStage,
    lastUpdate: r.lastUpdate?.toISOString() ?? null,
    hasOfficial: r.hasOfficial,
    hasAi: r.hasAi,
    aiSourceType: r.aiSourceType,
    aiGeneratedAt: r.aiGeneratedAt,
    needsReview: r.needsReview,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="text-primary h-7 w-7" />
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground text-sm">{t('description')}</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <AdminBillSummariesTable
            rows={tableRows}
            counts={counts}
            filter={filter}
            knesset={knesset}
            query={q}
            knessetOptions={[...ALLOWED_KNESSETS]}
            locale={locale}
          />
        </CardContent>
      </Card>
    </div>
  );
}
