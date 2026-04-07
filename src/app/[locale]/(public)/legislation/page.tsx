import { getTranslations } from 'next-intl/server';
import { Gavel } from 'lucide-react';
import { desc, asc, eq, sql, ilike, and } from 'drizzle-orm';
import { Link } from '@/i18n/navigation';
import { db } from '@/lib/db';
import { bills, billClusters } from '@/lib/db/schema';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import TranslatedText from '@/components/ui/translated-text';
import PaginationNav from '@/components/ui/pagination-nav';
import LegislationFilter from '@/components/legislation/LegislationFilter';
import { BillClusterCard } from '@/components/legislation/BillClusterCard';
import LegislationViewToggle from '@/components/legislation/LegislationViewToggle';
import { getBillStatusText } from '@/lib/knesset/bill-status';

interface Props {
  searchParams: Promise<{
    view?: string;
    knesset?: string;
    type?: string;
    status?: string;
    search?: string;
    sort?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 50;

export default async function LegislationPage({ searchParams }: Props) {
  const t = await getTranslations('legislation');
  const tCommon = await getTranslations('common');
  const params = await searchParams;
  const view = params.view ?? 'clusters';
  const knessetNum = params.knesset ? Number(params.knesset) : undefined;
  const billType = params.type ?? '';
  const statusFilter = params.status ?? '';
  const searchQuery = params.search ?? '';
  const sortBy = params.sort ?? 'dateDesc';
  const page = Math.max(1, Number(params.page ?? '1'));
  const offset = (page - 1) * PAGE_SIZE;

  // Clusters view
  if (view === 'clusters') {
    const clusterConditions = [];
    if (knessetNum) clusterConditions.push(eq(billClusters.latestKnessetNum, knessetNum));
    if (billType) clusterConditions.push(eq(billClusters.billType, billType));
    if (searchQuery) clusterConditions.push(ilike(billClusters.name, `%${searchQuery}%`));
    const clusterWhere = clusterConditions.length > 0 ? and(...clusterConditions) : undefined;

    const clusterOrder =
      sortBy === 'dateAsc'
        ? asc(billClusters.latestUpdate)
        : sortBy === 'nameAsc'
          ? asc(billClusters.name)
          : sortBy === 'nameDesc'
            ? desc(billClusters.name)
            : desc(billClusters.latestUpdate);

    const [clusterData, clusterCount] = await Promise.all([
      db
        .select({
          id: billClusters.id,
          name: billClusters.name,
          description: billClusters.description,
          category: billClusters.category,
          currentStage: billClusters.currentStage,
          billType: billClusters.billType,
          latestKnessetNum: billClusters.latestKnessetNum,
          billCount: billClusters.billCount,
          hasCrossTermBills: billClusters.hasCrossTermBills,
          aiProcessed: billClusters.aiProcessed,
          aiConfidence: billClusters.aiConfidence,
          latestUpdate: billClusters.latestUpdate,
        })
        .from(billClusters)
        .where(clusterWhere)
        .orderBy(clusterOrder)
        .limit(PAGE_SIZE)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(billClusters)
        .where(clusterWhere),
    ]);

    const clusterTotal = clusterCount[0]?.count ?? 0;
    const clusterTotalPages = Math.ceil(clusterTotal / PAGE_SIZE);

    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
            <Gavel className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('clusters.title')}</h1>
            <p className="text-sm text-muted-foreground">
              {clusterTotal.toLocaleString()} {t('clusters.title')}
            </p>
          </div>
        </div>

        <div className="mb-6 flex flex-col gap-4">
          <LegislationViewToggle currentView={view} />
          <LegislationFilter
            currentSearch={searchQuery}
            currentKnessetNum={knessetNum ? String(knessetNum) : ''}
            currentBillType={billType}
            currentStatus={statusFilter}
            currentSort={sortBy}
            billTypes={[]}
            statusOptions={[]}
          />
        </div>

        {clusterData.length > 0 ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
              {clusterData.map((cluster) => (
                <BillClusterCard
                  key={cluster.id}
                  id={cluster.id}
                  name={cluster.name}
                  description={cluster.description}
                  category={cluster.category}
                  currentStage={cluster.currentStage}
                  billType={cluster.billType}
                  latestKnessetNum={cluster.latestKnessetNum}
                  billCount={cluster.billCount ?? 1}
                  hasCrossTermBills={cluster.hasCrossTermBills}
                  aiProcessed={cluster.aiProcessed}
                  aiConfidence={cluster.aiConfidence}
                  latestUpdate={cluster.latestUpdate}
                />
              ))}
            </div>

            <PaginationNav
              currentPage={page}
              totalPages={clusterTotalPages}
              buildPageUrl={(p) => {
                const urlParams = new URLSearchParams();
                urlParams.set('view', 'clusters');
                if (knessetNum) urlParams.set('knesset', String(knessetNum));
                if (billType) urlParams.set('type', billType);
                if (searchQuery) urlParams.set('search', searchQuery);
                if (sortBy && sortBy !== 'dateDesc') urlParams.set('sort', sortBy);
                if (p > 1) urlParams.set('page', String(p));
                const qs = urlParams.toString();
                return `/legislation${qs ? `?${qs}` : ''}`;
              }}
              previousLabel={tCommon('previous')}
              nextLabel={tCommon('next')}
            />
          </>
        ) : (
          <div className="mt-16 flex flex-col items-center gap-3 text-muted-foreground">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <Gavel className="h-8 w-8 opacity-40" />
            </div>
            <p className="text-sm">{t('noResults')}</p>
          </div>
        )}
      </div>
    );
  }

  // Individual bills view (original)

  const conditions = [];
  if (knessetNum) conditions.push(eq(bills.knessetNum, knessetNum));
  if (billType) conditions.push(eq(bills.billType, billType));
  if (statusFilter) conditions.push(eq(bills.status, statusFilter));
  if (searchQuery) conditions.push(ilike(bills.name, `%${searchQuery}%`));

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
        knessetNum: bills.knessetNum,
        proposedDate: bills.proposedDate,
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

  // Distinct bill types for filter
  const billTypes = await db
    .selectDistinct({ billType: bills.billType })
    .from(bills)
    .where(sql`${bills.billType} IS NOT NULL`)
    .orderBy(bills.billType);

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
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
          <Gavel className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">
            {totalCount.toLocaleString()} {t('title')}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-4">
        <LegislationViewToggle currentView={view} />
        <LegislationFilter
          currentSearch={searchQuery}
          currentKnessetNum={knessetNum ? String(knessetNum) : ''}
          currentBillType={billType}
          currentStatus={statusFilter}
          currentSort={sortBy}
          billTypes={billTypes.map((bt) => bt.billType).filter((v): v is string => !!v)}
          statusOptions={statusOptions}
        />
      </div>

      {data.length > 0 ? (
        <>
          <div className="space-y-3 stagger-children">
            {data.map((bill) => (
              <div key={bill.id}>
                <Link href={`/legislation/${bill.id}`}>
                  <Card className="glass-card hover-lift overflow-hidden border-s-4 border-s-primary/30">
                    <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold leading-tight"><TranslatedText text={bill.name} /></h3>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          {bill.proposedDate && (
                            <span>
                              {new Date(bill.proposedDate).toLocaleDateString('he-IL')}
                            </span>
                          )}
                          {bill.knessetNum && <span>• {t('knesset')} {bill.knessetNum}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {bill.billType && (
                          <Badge variant="outline"><TranslatedText text={bill.billType} /></Badge>
                        )}
                        {bill.status && (
                          <Badge variant="secondary"><TranslatedText text={getBillStatusText(bill.status)} /></Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <PaginationNav
            currentPage={page}
            totalPages={totalPages}
            buildPageUrl={(p) => {
              const urlParams = new URLSearchParams();
              urlParams.set('view', 'bills');
              if (knessetNum) urlParams.set('knesset', String(knessetNum));
              if (billType) urlParams.set('type', billType);
              if (statusFilter) urlParams.set('status', statusFilter);
              if (searchQuery) urlParams.set('search', searchQuery);
              if (sortBy && sortBy !== 'dateDesc') urlParams.set('sort', sortBy);
              if (p > 1) urlParams.set('page', String(p));
              const qs = urlParams.toString();
              return `/legislation${qs ? `?${qs}` : ''}`;
            }}
            previousLabel={tCommon('previous')}
            nextLabel={tCommon('next')}
          />
        </>
      ) : (
        <div className="mt-16 flex flex-col items-center gap-3 text-muted-foreground">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <Gavel className="h-8 w-8 opacity-40" />
          </div>
          <p className="text-sm">{t('noResults')}</p>
        </div>
      )}
    </div>
  );
}
