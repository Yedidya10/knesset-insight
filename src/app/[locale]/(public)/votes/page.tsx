import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { Vote, Check, X } from 'lucide-react';
import { desc, asc, eq, sql, ilike, and } from 'drizzle-orm';
import { Link } from '@/i18n/navigation';
import { db } from '@/lib/db';
import { votes } from '@/lib/db/schema';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import PaginationNav from '@/components/ui/pagination-nav';
import VotesFilter from '@/components/votes/VotesFilter';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('seo.votes');
  return {
    title: t('title'),
    description: t('description'),
    openGraph: { title: t('title'), description: t('description') },
  };
}

interface Props {
  searchParams: Promise<{
    knesset?: string;
    result?: string;
    search?: string;
    sort?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 30;

export const dynamic = 'force-dynamic';

export default async function VotesPage({ searchParams }: Props) {
  const t = await getTranslations('votes');
  const params = await searchParams;
  const knessetNum = params.knesset ? Number(params.knesset) : undefined;
  const resultFilter = params.result ?? '';
  const searchQuery = params.search ?? '';
  const sortBy = params.sort ?? 'dateDesc';
  const page = Math.max(1, Number(params.page ?? '1'));
  const offset = (page - 1) * PAGE_SIZE;

  const conditions = [];
  if (searchQuery) {
    conditions.push(ilike(votes.title, `%${searchQuery}%`));
  }
  if (resultFilter === 'approved') {
    conditions.push(eq(votes.isAccepted, true));
  } else if (resultFilter === 'rejected') {
    conditions.push(eq(votes.isAccepted, false));
  }
  if (knessetNum) {
    conditions.push(eq(votes.knessetNum, knessetNum));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  let orderByClause;
  switch (sortBy) {
    case 'dateAsc':
      orderByClause = asc(votes.voteDate);
      break;
    case 'mostVotes':
      orderByClause = desc(
        sql`${votes.forCount} + ${votes.againstCount} + ${votes.abstainCount}`,
      );
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
        knessetNum: votes.knessetNum,
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
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(votes)
      .where(whereClause),
  ]);

  const total = countResult[0]?.count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <div className="bg-primary/10 ring-primary/20 flex h-14 w-14 items-center justify-center rounded-2xl ring-1">
          <Vote className="text-primary h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t('title')}
          </h1>
          <p className="text-muted-foreground text-sm">
            {total.toLocaleString()}{' '}
            {t('totalVoters') ? t('title').toLowerCase() : ''}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <VotesFilter />
      </div>

      {/* Results */}
      {data.length === 0 ? (
        <div className="text-muted-foreground mt-16 flex flex-col items-center gap-3">
          <div className="bg-muted flex h-16 w-16 items-center justify-center rounded-2xl">
            <Vote className="h-8 w-8 opacity-40" />
          </div>
          <p className="text-sm">{t('noResults')}</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {data.map((vote) => {
              const total =
                (vote.forCount ?? 0) +
                (vote.againstCount ?? 0) +
                (vote.abstainCount ?? 0);
              const forPct =
                total > 0 ? ((vote.forCount ?? 0) / total) * 100 : 0;

              return (
                <Link key={vote.id} href={`/votes/${vote.id}`}>
                  <Card className="glass-card hover-lift border-s-primary/30 overflow-hidden border-s-4">
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm leading-snug font-medium">
                          {vote.title}
                        </p>
                        <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                          {vote.voteDate && (
                            <span>
                              {new Date(vote.voteDate).toLocaleDateString()}
                            </span>
                          )}
                          {vote.knessetNum && (
                            <span>
                              {t('knessetNum')} {vote.knessetNum}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        {/* Mini bar */}
                        <div className="hidden w-24 sm:block">
                          <div className="flex items-center gap-1.5 text-[10px]">
                            <span className="text-green-600 dark:text-green-400">
                              {vote.forCount ?? 0}
                            </span>
                            <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-red-500/20">
                              <div
                                className="rounded-s-full bg-emerald-500"
                                style={{ width: `${forPct}%` }}
                              />
                            </div>
                            <span className="text-red-600 dark:text-red-400">
                              {vote.againstCount ?? 0}
                            </span>
                          </div>
                        </div>

                        <Badge
                          variant={vote.isAccepted ? 'default' : 'destructive'}
                          className="text-[10px]"
                        >
                          {vote.isAccepted ? (
                            <span className="flex items-center gap-0.5">
                              <Check className="h-3 w-3" />
                              {t('approved')}
                            </span>
                          ) : (
                            <span className="flex items-center gap-0.5">
                              <X className="h-3 w-3" />
                              {t('rejected')}
                            </span>
                          )}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="mt-8">
              <PaginationNav
                currentPage={page}
                totalPages={totalPages}
                buildPageUrl={(p) => {
                  const urlParams = new URLSearchParams();
                  if (searchQuery) urlParams.set('search', searchQuery);
                  if (knessetNum) urlParams.set('knesset', String(knessetNum));
                  if (resultFilter) urlParams.set('result', resultFilter);
                  if (sortBy && sortBy !== 'dateDesc')
                    urlParams.set('sort', sortBy);
                  if (p > 1) urlParams.set('page', String(p));
                  const qs = urlParams.toString();
                  return `/votes${qs ? `?${qs}` : ''}`;
                }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
