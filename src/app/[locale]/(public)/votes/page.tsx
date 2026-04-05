import { getTranslations } from 'next-intl/server';
import { Vote, ThumbsUp, ThumbsDown, Minus, ChevronDown } from 'lucide-react';
import { desc, asc, sql, eq, and, ilike, gte, lte } from 'drizzle-orm';
import { Link } from '@/i18n/navigation';
import { db } from '@/lib/db';
import { votes } from '@/lib/db/schema';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import VotesFilter from '@/components/votes/VotesFilter';
import TranslatedText from '@/components/ui/translated-text';
import PaginationNav from '@/components/ui/pagination-nav';

interface Props {
  searchParams: Promise<{
    page?: string;
    search?: string;
    knessetNum?: string;
    result?: string;
    dateFrom?: string;
    dateTo?: string;
    sort?: string;
  }>;
}

const PAGE_SIZE = 30;

export default async function VotesPage({ searchParams }: Props) {
  const t = await getTranslations('votes');
  const tCommon = await getTranslations('common');
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? '1'));
  const offset = (page - 1) * PAGE_SIZE;

  const search = params.search ?? '';
  const knessetNum = params.knessetNum ? Number(params.knessetNum) : undefined;
  const resultFilter = params.result ?? '';
  const dateFrom = params.dateFrom ?? '';
  const dateTo = params.dateTo ?? '';
  const sortBy = params.sort ?? 'dateDesc';

  // Build where conditions
  const conditions = [];
  if (search) {
    conditions.push(ilike(votes.title, `%${search}%`));
  }
  if (resultFilter === 'approved') {
    conditions.push(eq(votes.isAccepted, true));
  } else if (resultFilter === 'rejected') {
    conditions.push(eq(votes.isAccepted, false));
  }
  if (knessetNum !== undefined) {
    conditions.push(eq(votes.knessetNum, knessetNum));
  }
  if (dateFrom) {
    conditions.push(gte(votes.voteDate, new Date(dateFrom)));
  }
  if (dateTo) {
    conditions.push(lte(votes.voteDate, new Date(dateTo)));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Build order clause
  let orderByClause;
  switch (sortBy) {
    case 'dateAsc':
      orderByClause = asc(votes.voteDate);
      break;
    case 'mostVotes':
      orderByClause = desc(sql`${votes.forCount} + ${votes.againstCount} + ${votes.abstainCount}`);
      break;
    case 'mostControversial':
      orderByClause = asc(sql`abs(${votes.forCount} - ${votes.againstCount})`);
      break;
    default:
      orderByClause = desc(votes.voteDate);
  }

  const [data, countResult] = await Promise.all([
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
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(PAGE_SIZE)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(votes).where(whereClause),
  ]);

  const totalCount = countResult[0]?.count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Group votes by sessItemId — reservations (הסתייגויות) become children of the main vote
  type VoteRow = (typeof data)[number];
  interface VoteGroup {
    main: VoteRow;
    children: VoteRow[];
  }

  const groups: VoteGroup[] = [];
  const sessItemMap = new Map<number, VoteGroup>();

  for (const vote of data) {
    if (vote.sessItemId) {
      const existing = sessItemMap.get(vote.sessItemId);
      if (existing) {
        // If the new vote looks like the main vote (accepted or has more voters), swap
        const isMain =
          vote.isAccepted ||
          (vote.forCount ?? 0) + (vote.againstCount ?? 0) >
            (existing.main.forCount ?? 0) + (existing.main.againstCount ?? 0);
        if (isMain && !existing.main.isAccepted) {
          existing.children.push(existing.main);
          existing.main = vote;
        } else {
          existing.children.push(vote);
        }
      } else {
        const group: VoteGroup = { main: vote, children: [] };
        sessItemMap.set(vote.sessItemId, group);
        groups.push(group);
      }
    } else {
      groups.push({ main: vote, children: [] });
    }
  }

  // Build pagination URL preserving current filters
  const buildPageUrl = (p: number) => {
    const urlParams = new URLSearchParams();
    if (p > 1) urlParams.set('page', String(p));
    if (search) urlParams.set('search', search);
    if (knessetNum !== undefined) urlParams.set('knessetNum', String(knessetNum));
    if (resultFilter) urlParams.set('result', resultFilter);
    if (dateFrom) urlParams.set('dateFrom', dateFrom);
    if (dateTo) urlParams.set('dateTo', dateTo);
    if (sortBy !== 'dateDesc') urlParams.set('sort', sortBy);
    const qs = urlParams.toString();
    return `/votes${qs ? `?${qs}` : ''}`;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
          <Vote className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">
            {totalCount.toLocaleString()} {t('title')}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <VotesFilter
          currentSearch={search}
          currentKnessetNum={knessetNum !== undefined ? String(knessetNum) : ''}
          currentResult={resultFilter}
          currentDateFrom={dateFrom}
          currentDateTo={dateTo}
          currentSort={sortBy}
        />
      </div>

      {groups.length > 0 ? (
        <>
          <div className="space-y-3 stagger-children">
            {groups.map((group) => (
              <div key={group.main.id}>
                {/* Main vote card */}
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
                              <span>
                                {new Date(group.main.voteDate).toLocaleDateString('he-IL')}
                              </span>
                            )}
                            {group.main.knessetNum && (
                              <span className="text-xs">
                                {t('knessetNum')} {group.main.knessetNum}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {hasTally ? (
                            <>
                              {/* Vote tallies */}
                              <div className="flex items-center gap-1.5 rounded-md bg-green-50 px-2 py-1 dark:bg-green-950/30">
                                <ThumbsUp className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                                <span className="text-sm font-semibold text-green-700 dark:text-green-300">
                                  {group.main.forCount ?? 0}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-1 dark:bg-red-950/30">
                                <ThumbsDown className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                                <span className="text-sm font-semibold text-red-700 dark:text-red-300">
                                  {group.main.againstCount ?? 0}
                                </span>
                              </div>
                              {(group.main.abstainCount ?? 0) > 0 && (
                                <div className="flex items-center gap-1.5 rounded-md bg-yellow-50 px-2 py-1 dark:bg-yellow-950/30">
                                  <Minus className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />
                                  <span className="text-sm font-semibold text-yellow-700 dark:text-yellow-300">
                                    {group.main.abstainCount}
                                  </span>
                                </div>
                              )}
                              <Badge variant={group.main.isAccepted ? 'default' : 'secondary'}>
                                {group.main.isAccepted ? t('approved') : t('rejected')}
                              </Badge>
                            </>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              {t('noTallyData')}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                    );
                  })()}
                </Link>

                {/* Child reservation votes */}
                {group.children.length > 0 && (
                  <div className="ms-6 mt-1 space-y-1 border-s-2 border-border/40 ps-4">
                    <p className="text-xs font-medium text-muted-foreground">
                      <ChevronDown className="inline-block h-3 w-3" /> {t('reservations')} ({group.children.length})
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
                                  {child.isAccepted ? t('approved') : t('rejected')}
                                </Badge>
                              </>
                            ) : (
                              <Badge variant="outline" className="text-xs text-muted-foreground">
                                {t('noTallyData')}
                              </Badge>
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

          {/* Pagination */}
          <PaginationNav
            currentPage={page}
            totalPages={totalPages}
            buildPageUrl={buildPageUrl}
            previousLabel={tCommon('previous')}
            nextLabel={tCommon('next')}
          />
        </>
      ) : (
        <div className="mt-16 flex flex-col items-center gap-3 text-muted-foreground">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <Vote className="h-8 w-8 opacity-40" />
          </div>
          <p className="text-sm">{t('noResults')}</p>
        </div>
      )}
    </div>
  );
}
