import { getTranslations, getLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import {
  Gavel,
  GitMerge,
  GitBranch,
  Pause,
  ArrowLeftRight,
  Sparkles,
} from 'lucide-react';
import { desc, asc, eq, sql, ilike, and, or, exists } from 'drizzle-orm';
import { Link } from '@/i18n/navigation';
import { db } from '@/lib/db';
import { bills, billNames } from '@/lib/db/schema';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import TranslatedText from '@/components/ui/translated-text';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('seo.legislation');
  return {
    title: t('title'),
    description: t('description'),
    openGraph: { title: t('title'), description: t('description') },
  };
}
import PaginationNav from '@/components/ui/pagination-nav';
import LegislationFilter from '@/components/legislation/LegislationFilter';
import EntityActivityPopover from '@/components/admin/inline/EntityActivityPopover';
import { getBillStatusText } from '@/lib/knesset/bill-status';
import { computeBillStage } from '@/lib/knesset/bill-stages';

// Mapping between URL-friendly English slugs and Hebrew billType stored in DB
const BILL_TYPE_SLUGS = ['government', 'private', 'committee'] as const;
type BillTypeSlug = (typeof BILL_TYPE_SLUGS)[number];
const SLUG_TO_HEBREW: Record<BillTypeSlug, string> = {
  government: 'ממשלתית',
  private: 'פרטית',
  committee: 'ועדה',
};

interface Props {
  searchParams: Promise<{
    knesset?: string;
    type?: string;
    status?: string;
    search?: string;
    sort?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 50;

export const dynamic = 'force-dynamic';

export default async function LegislationPage({ searchParams }: Props) {
  const t = await getTranslations('legislation');
  const tCommon = await getTranslations('common');
  const locale = await getLocale();
  const params = await searchParams;
  const knessetNum = params.knesset ? Number(params.knesset) : undefined;
  const billType = params.type ?? '';
  const statusFilter = params.status ?? '';
  const searchQuery = params.search ?? '';
  const sortBy = params.sort ?? 'dateDesc';
  const page = Math.max(1, Number(params.page ?? '1'));
  const offset = (page - 1) * PAGE_SIZE;

  const conditions = [];
  if (knessetNum) conditions.push(eq(bills.knessetNum, knessetNum));
  if (billType && billType in SLUG_TO_HEBREW)
    conditions.push(
      eq(bills.billType, SLUG_TO_HEBREW[billType as BillTypeSlug]),
    );
  if (statusFilter) conditions.push(eq(bills.status, statusFilter));
  if (searchQuery) {
    conditions.push(
      or(
        ilike(bills.name, `%${searchQuery}%`),
        exists(
          db
            .select({ one: sql`1` })
            .from(billNames)
            .where(
              and(
                eq(billNames.billId, bills.id),
                ilike(billNames.name, `%${searchQuery}%`),
              ),
            ),
        ),
      ),
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const orderByClause =
    sortBy === 'dateAsc'
      ? asc(bills.proposedDate)
      : sortBy === 'nameAsc'
        ? asc(bills.name)
        : sortBy === 'nameDesc'
          ? desc(bills.name)
          : desc(bills.knessetId);

  const [data, countResult] = await Promise.all([
    db
      .select({
        id: bills.id,
        knessetId: bills.knessetId,
        name: bills.name,
        status: bills.status,
        billType: bills.billType,
        subTypeId: bills.subTypeId,
        knessetNum: bills.knessetNum,
        proposedDate: bills.proposedDate,
        aiSummary: bills.aiSummary,
      })
      .from(bills)
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(PAGE_SIZE)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(bills)
      .where(whereClause),
  ]);

  const totalCount = countResult[0]?.count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Bill type slugs for filter (static list — no DB query needed)

  // Distinct statuses for filter
  const rawStatuses = await db
    .selectDistinct({ status: bills.status })
    .from(bills)
    .where(sql`${bills.status} IS NOT NULL`)
    .orderBy(bills.status);
  const statusOptions = rawStatuses
    .filter((s) => s.status)
    .map((s) => ({
      value: s.status!,
      label: getBillStatusText(s.status),
    }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <div className="bg-primary/10 ring-primary/20 flex h-14 w-14 items-center justify-center rounded-2xl ring-1">
          <Gavel className="text-primary h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t('title')}
          </h1>
          <p className="text-muted-foreground text-sm">
            {totalCount.toLocaleString()} {t('title')}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <LegislationFilter
          billTypes={[...BILL_TYPE_SLUGS]}
          statusOptions={statusOptions}
        />
      </div>

      {data.length > 0 ? (
        <>
          <div className="stagger-children space-y-3">
            {data.map((bill) => {
              const { specialStatus } = computeBillStage(
                bill.status,
                bill.subTypeId,
                bill.billType,
              );
              return (
                <div key={bill.id} className="group relative">
                  <Link href={`/legislation/${bill.id}`}>
                    <Card className="glass-card hover-lift border-s-primary/30 overflow-hidden border-s-4">
                      <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <h3 className="leading-tight font-semibold">
                            <TranslatedText text={bill.name} />
                          </h3>
                          <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-2 text-sm">
                            {bill.proposedDate && (
                              <span>
                                {new Date(bill.proposedDate).toLocaleDateString(
                                  'he-IL',
                                )}
                              </span>
                            )}
                            {bill.knessetNum && (
                              <span>
                                • {t('knesset')} {bill.knessetNum}
                              </span>
                            )}
                          </div>
                          {bill.aiSummary && (
                            <p className="text-muted-foreground mt-1.5 line-clamp-2 text-sm leading-relaxed">
                              <Sparkles className="me-1 inline h-3.5 w-3.5 text-amber-500" />
                              {bill.aiSummary[locale] ?? bill.aiSummary.he}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {specialStatus === 'merged' && (
                            <Badge
                              variant="outline"
                              className="gap-1 border-violet-300 text-violet-700 dark:border-violet-700 dark:text-violet-300"
                            >
                              <GitMerge className="h-3 w-3" />
                              {t('special.merged')}
                            </Badge>
                          )}
                          {specialStatus === 'split' && (
                            <Badge
                              variant="outline"
                              className="gap-1 border-sky-300 text-sky-700 dark:border-sky-700 dark:text-sky-300"
                            >
                              <GitBranch className="h-3 w-3" />
                              {t('special.split')}
                            </Badge>
                          )}
                          {specialStatus === 'stopped' && (
                            <Badge
                              variant="outline"
                              className="gap-1 border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300"
                            >
                              <Pause className="h-3 w-3" />
                              {t('special.stopped')}
                            </Badge>
                          )}
                          {specialStatus === 'converted' && (
                            <Badge
                              variant="outline"
                              className="gap-1 border-teal-300 text-teal-700 dark:border-teal-700 dark:text-teal-300"
                            >
                              <ArrowLeftRight className="h-3 w-3" />
                              {t('special.converted')}
                            </Badge>
                          )}
                          {bill.billType && (
                            <Badge variant="outline">
                              <TranslatedText text={bill.billType} />
                            </Badge>
                          )}
                          {bill.status && (
                            <Badge variant="secondary">
                              <TranslatedText
                                text={getBillStatusText(bill.status)}
                              />
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                  <div className="absolute inset-e-2 top-2 z-10">
                    <EntityActivityPopover
                      entityType="bill"
                      entityId={String(bill.id)}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          <PaginationNav
            currentPage={page}
            totalPages={totalPages}
            buildPageUrl={(p) => {
              const urlParams = new URLSearchParams();
              if (knessetNum) urlParams.set('knesset', String(knessetNum));
              if (billType) urlParams.set('type', billType);
              if (statusFilter) urlParams.set('status', statusFilter);
              if (searchQuery) urlParams.set('search', searchQuery);
              if (sortBy && sortBy !== 'dateDesc')
                urlParams.set('sort', sortBy);
              if (p > 1) urlParams.set('page', String(p));
              const qs = urlParams.toString();
              return `/legislation${qs ? `?${qs}` : ''}`;
            }}
            previousLabel={tCommon('previous')}
            nextLabel={tCommon('next')}
          />
        </>
      ) : (
        <div className="text-muted-foreground mt-16 flex flex-col items-center gap-3">
          <div className="bg-muted flex h-16 w-16 items-center justify-center rounded-2xl">
            <Gavel className="h-8 w-8 opacity-40" />
          </div>
          <p className="text-sm">{t('noResults')}</p>
        </div>
      )}
    </div>
  );
}
