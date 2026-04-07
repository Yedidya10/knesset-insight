import { getTranslations } from 'next-intl/server';
import { Gavel, Vote, ThumbsUp, ThumbsDown, Minus, ChevronDown } from 'lucide-react';
import { desc, asc, eq, sql, ilike, and, gte, lte } from 'drizzle-orm';
import { Link } from '@/i18n/navigation';
import { db } from '@/lib/db';
import { bills, billClusters, votes } from '@/lib/db/schema';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import TranslatedText from '@/components/ui/translated-text';
import PaginationNav from '@/components/ui/pagination-nav';
import LegislationFilter from '@/components/legislation/LegislationFilter';
import { BillClusterCard } from '@/components/legislation/BillClusterCard';
import LegislationViewToggle from '@/components/legislation/LegislationViewToggle';
import VotesFilter from '@/components/votes/VotesFilter';
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
    // Votes-specific
    result?: string;
    dateFrom?: string;
    dateTo?: string;
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

  if (view === 'votes') {
    const tVotes = await getTranslations('votes');
    const search = params.search ?? '';
    const voteKnessetNum = params.knesset ? Number(params.knesset) : undefined;
    const resultFilter = params.result ?? '';
    const dateFrom = params.dateFrom ?? '';
    const dateTo = params.dateTo ?? '';
    const voteSortBy = params.sort ?? 'dateDesc';

    const voteConditions = [];
    if (search) voteConditions.push(ilike(votes.title, `%${search}%`));
    if (resultFilter === 'approved') voteConditions.push(eq(votes.isAccepted, true));
    else if (resultFilter === 'rejected') voteConditions.push(eq(votes.isAccepted, false));
    if (voteKnessetNum !== undefined) voteConditions.push(eq(votes.knessetNum, voteKnessetNum));
    if (dateFrom) voteConditions.push(gte(votes.voteDate, new Date(dateFrom)));
    if (dateTo) voteConditions.push(lte(votes.voteDate, new Date(dateTo)));

    const voteWhere = voteConditions.length > 0 ? and(...voteConditions) : undefined;

    let voteOrder;
    switch (voteSortBy) {
      case 'dateAsc': voteOrder = asc(votes.voteDate); break;
      case 'mostVotes': voteOrder = desc(sql`${votes.forCount} + ${votes.againstCount} + ${votes.abstainCount}`); break;
      case 'mostControversial': voteOrder = asc(sql`abs(${votes.forCount} - ${votes.againstCount})`); break;
      default: voteOrder = desc(votes.voteDate);
    }

    const VOTE_PAGE_SIZE = 30;
    const voteOffset = (page - 1) * VOTE_PAGE_SIZE;

    const [voteData, voteCountResult] = await Promise.all([
      db
        .select({
          id: votes.id,
          title: votes.title,
          voteDate: votes.voteDate,
          voteType: votes.voteType,
          knessetNum: votes.knessetNum,
          sessItemId: votes.sessItemId,
          forCount: votes.forCount,
          againstCount: votes.againstCount,
          abstainCount: votes.abstainCount,
          isAccepted: votes.isAccepted,
        })
        .from(votes)
        .where(voteWhere)
        .orderBy(voteOrder)
        .limit(VOTE_PAGE_SIZE)
        .offset(voteOffset),
      db.select({ count: sql<number>`count(*)::int` }).from(votes).where(voteWhere),
    ]);

    const voteTotalCount = voteCountResult[0]?.count ?? 0;
    const voteTotalPages = Math.ceil(voteTotalCount / VOTE_PAGE_SIZE);

    // Group votes by sessItemId
    type VoteRow = (typeof voteData)[number];
    interface VoteGroup { main: VoteRow; children: VoteRow[] }
    const groups: VoteGroup[] = [];
    const sessItemMap = new Map<number, VoteGroup>();
    for (const vote of voteData) {
      if (vote.sessItemId) {
        const existing = sessItemMap.get(vote.sessItemId);
        if (existing) {
          const isMain = vote.isAccepted || (vote.forCount ?? 0) + (vote.againstCount ?? 0) > (existing.main.forCount ?? 0) + (existing.main.againstCount ?? 0);
          if (isMain && !existing.main.isAccepted) { existing.children.push(existing.main); existing.main = vote; }
          else { existing.children.push(vote); }
        } else {
          const group: VoteGroup = { main: vote, children: [] };
          sessItemMap.set(vote.sessItemId, group);
          groups.push(group);
        }
      } else {
        groups.push({ main: vote, children: [] });
      }
    }

    const buildVotePageUrl = (p: number) => {
      const urlParams = new URLSearchParams();
      urlParams.set('view', 'votes');
      if (p > 1) urlParams.set('page', String(p));
      if (search) urlParams.set('search', search);
      if (voteKnessetNum !== undefined) urlParams.set('knesset', String(voteKnessetNum));
      if (resultFilter) urlParams.set('result', resultFilter);
      if (dateFrom) urlParams.set('dateFrom', dateFrom);
      if (dateTo) urlParams.set('dateTo', dateTo);
      if (voteSortBy !== 'dateDesc') urlParams.set('sort', voteSortBy);
      const qs = urlParams.toString();
      return `/legislation${qs ? `?${qs}` : ''}`;
    };

    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
            <Vote className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{tVotes('title')}</h1>
            <p className="text-sm text-muted-foreground">
              {voteTotalCount.toLocaleString()} {tVotes('title')}
            </p>
          </div>
        </div>

        <div className="mb-6 flex flex-col gap-4">
          <LegislationViewToggle currentView={view} />
          <VotesFilter
            currentSearch={search}
            currentKnessetNum={voteKnessetNum !== undefined ? String(voteKnessetNum) : ''}
            currentResult={resultFilter}
            currentDateFrom={dateFrom}
            currentDateTo={dateTo}
            currentSort={voteSortBy}
          />
        </div>

        {groups.length > 0 ? (
          <>
            <div className="space-y-3 stagger-children">
              {groups.map((group) => (
                <div key={group.main.id}>
                  <Link href={`/votes/${group.main.id}`}>
                    {(() => {
                      const hasTally = (group.main.forCount ?? 0) + (group.main.againstCount ?? 0) + (group.main.abstainCount ?? 0) > 0;
                      return (
                    <Card className={`glass-card hover-lift overflow-hidden border-s-4 ${hasTally ? (group.main.isAccepted ? 'border-s-green-500/60' : 'border-s-red-500/60') : 'border-s-muted-foreground/30'}`}>
                      <CardContent className="p-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold leading-tight"><TranslatedText text={group.main.title} /></h3>
                            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                              {group.main.voteDate && (
                                <span>{new Date(group.main.voteDate).toLocaleDateString('he-IL')}</span>
                              )}
                              {group.main.knessetNum && (
                                <span className="text-xs">{tVotes('knessetNum')} {group.main.knessetNum}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {hasTally ? (
                              <>
                                <div className="flex items-center gap-1.5 rounded-md bg-green-50 px-2 py-1 dark:bg-green-950/30">
                                  <ThumbsUp className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                                  <span className="text-sm font-semibold text-green-700 dark:text-green-300">{group.main.forCount ?? 0}</span>
                                </div>
                                <div className="flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-1 dark:bg-red-950/30">
                                  <ThumbsDown className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                                  <span className="text-sm font-semibold text-red-700 dark:text-red-300">{group.main.againstCount ?? 0}</span>
                                </div>
                                {(group.main.abstainCount ?? 0) > 0 && (
                                  <div className="flex items-center gap-1.5 rounded-md bg-yellow-50 px-2 py-1 dark:bg-yellow-950/30">
                                    <Minus className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />
                                    <span className="text-sm font-semibold text-yellow-700 dark:text-yellow-300">{group.main.abstainCount}</span>
                                  </div>
                                )}
                                <Badge variant={group.main.isAccepted ? 'default' : 'secondary'}>
                                  {group.main.isAccepted ? tVotes('approved') : tVotes('rejected')}
                                </Badge>
                              </>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">{tVotes('noTallyData')}</Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                      );
                    })()}
                  </Link>

                  {group.children.length > 0 && (
                    <div className="ms-6 mt-1 space-y-1 border-s-2 border-border/40 ps-4">
                      <p className="text-xs font-medium text-muted-foreground">
                        <ChevronDown className="inline-block h-3 w-3" /> {tVotes('reservations')} ({group.children.length})
                      </p>
                      {group.children.map((child) => {
                        const childHasTally = (child.forCount ?? 0) + (child.againstCount ?? 0) + (child.abstainCount ?? 0) > 0;
                        return (
                        <Link key={child.id} href={`/votes/${child.id}`}>
                          <div className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-2 text-sm transition-colors hover:bg-muted">
                            <span className="min-w-0 flex-1 truncate"><TranslatedText text={child.title} /></span>
                            <div className="flex items-center gap-2">
                              {childHasTally ? (
                                <>
                                  <span className="text-green-600 dark:text-green-400">{child.forCount ?? 0}</span>
                                  <span className="text-muted-foreground">/</span>
                                  <span className="text-red-600 dark:text-red-400">{child.againstCount ?? 0}</span>
                                  <Badge variant={child.isAccepted ? 'default' : 'secondary'} className="text-xs">
                                    {child.isAccepted ? tVotes('approved') : tVotes('rejected')}
                                  </Badge>
                                </>
                              ) : (
                                <Badge variant="outline" className="text-xs text-muted-foreground">{tVotes('noTallyData')}</Badge>
                              )}
                            </div>
                          </div>
                        </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <PaginationNav
              currentPage={page}
              totalPages={voteTotalPages}
              buildPageUrl={buildVotePageUrl}
              previousLabel={tCommon('previous')}
              nextLabel={tCommon('next')}
            />
          </>
        ) : (
          <div className="mt-16 flex flex-col items-center gap-3 text-muted-foreground">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <Vote className="h-8 w-8 opacity-40" />
            </div>
            <p className="text-sm">{tVotes('noResults')}</p>
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
