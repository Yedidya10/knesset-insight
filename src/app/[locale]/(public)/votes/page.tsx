import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { Vote, Check, X } from 'lucide-react';
import { desc, asc, eq, sql, ilike, and, gte, lte, inArray } from 'drizzle-orm';
import { Link } from '@/i18n/navigation';
import { db } from '@/lib/db';
import { votes, members, memberVotes, factions } from '@/lib/db/schema';
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
    sortDir?: string;
    page?: string;
    dateFrom?: string;
    dateTo?: string;
    voteType?: string;
    stage?: string;
    reservation?: string;
    activityType?: string;
    factionId?: string;
    memberId?: string;
    voteDirection?: string;
  }>;
}

const PAGE_SIZE = 30;

export const dynamic = 'force-dynamic';

export default async function VotesPage({ searchParams }: Props) {
  const t = await getTranslations('votes');
  const params = await searchParams;
  const knessetRaw = params.knesset ?? '';
  const resultFilter = params.result ?? '';
  const searchQuery = params.search ?? '';
  // Normalize sort: new format is sort=date|mostVotes|mostControversial + sortDir=asc|desc
  // Legacy format (dateDesc, dateAsc) is handled below for backward compat
  const rawSort = params.sort ?? 'date';
  const rawSortDir = (params.sortDir ?? 'desc') as 'asc' | 'desc';
  let sortFieldKey: string;
  let sortDir: 'asc' | 'desc';
  if (rawSort === 'dateDesc') {
    sortFieldKey = 'date';
    sortDir = 'desc';
  } else if (rawSort === 'dateAsc') {
    sortFieldKey = 'date';
    sortDir = 'asc';
  } else {
    sortFieldKey = rawSort;
    sortDir = rawSortDir;
  }
  const page = Math.max(1, Number(params.page ?? '1'));
  const offset = (page - 1) * PAGE_SIZE;
  const dateFrom = params.dateFrom ?? '';
  const dateTo = params.dateTo ?? '';
  const voteType = params.voteType ?? '';
  const stage = params.stage ?? '';
  const reservation = params.reservation ?? '';
  const activityType = params.activityType ?? '';
  const factionId = params.factionId ?? '';
  const memberId = params.memberId ?? '';
  const voteDirection = params.voteDirection ?? '';

  // ── Fetch filter option data ──
  const [factionList, memberList] = await Promise.all([
    db
      .select({ id: factions.id, name: factions.name })
      .from(factions)
      .where(eq(factions.isCurrent, true))
      .orderBy(factions.name),
    db
      .select({
        id: members.id,
        name: sql<string>`${members.firstName} || ' ' || ${members.lastName}`,
      })
      .from(members)
      .where(eq(members.isCurrent, true))
      .orderBy(members.lastName, members.firstName),
  ]);

  // ── Build WHERE conditions ──
  const conditions = [];
  if (searchQuery) {
    conditions.push(ilike(votes.title, `%${searchQuery}%`));
  }
  // result: comma-separated approved,rejected
  const resultValues = resultFilter.split(',').filter(Boolean);
  if (resultValues.length === 1) {
    if (resultValues[0] === 'approved')
      conditions.push(eq(votes.isAccepted, true));
    else if (resultValues[0] === 'rejected')
      conditions.push(eq(votes.isAccepted, false));
  }
  // if both selected → no filter
  const knessetNums = knessetRaw.split(',').filter(Boolean).map(Number);
  if (knessetNums.length === 1) {
    conditions.push(eq(votes.knessetNum, knessetNums[0]));
  } else if (knessetNums.length > 1) {
    conditions.push(inArray(votes.knessetNum, knessetNums));
  }
  if (dateFrom) {
    conditions.push(gte(votes.voteDate, new Date(dateFrom)));
  }
  if (dateTo) {
    conditions.push(lte(votes.voteDate, new Date(dateTo)));
  }
  // voteType: comma-separated 1,2,3,4
  const voteTypes = voteType.split(',').filter(Boolean);
  if (voteTypes.length === 1) {
    conditions.push(eq(votes.voteType, voteTypes[0]));
  } else if (voteTypes.length > 1) {
    conditions.push(inArray(votes.voteType, voteTypes));
  }
  // stage: comma-separated 1,3,5,6
  const stageValues = stage.split(',').filter(Boolean);
  if (stageValues.length === 1) {
    conditions.push(eq(votes.billStage, Number(stageValues[0])));
  } else if (stageValues.length > 1) {
    conditions.push(inArray(votes.billStage, stageValues.map(Number)));
  }
  if (reservation === 'true') {
    conditions.push(eq(votes.isReservation, true));
  }
  // Parliamentary activity type — uses the persisted votes.activity_type
  // column (backfilled + maintained by sync-votes + link-votes-to-bills).
  const activityTypes = activityType
    ? activityType.split(',').filter(Boolean)
    : [];
  if (activityTypes.length === 1) {
    conditions.push(eq(votes.activityType, activityTypes[0]));
  } else if (activityTypes.length > 1) {
    conditions.push(inArray(votes.activityType, activityTypes));
  }
  // Member-level filters (faction / member / vote direction)
  const voteDirections = voteDirection.split(',').filter(Boolean);
  const memberIds = memberId.split(',').filter(Boolean);
  const factionIds = factionId.split(',').filter(Boolean);
  if (
    memberIds.length > 0 ||
    voteDirections.length > 0 ||
    factionIds.length > 0
  ) {
    const subParts = [sql`mv.vote_id = ${votes.id}`];
    if (memberIds.length === 1) {
      subParts.push(sql`mv.member_id = ${Number(memberIds[0])}`);
    } else if (memberIds.length > 1) {
      const memberIdParams = sql.join(
        memberIds.map((id) => sql`${Number(id)}`),
        sql`, `,
      );
      subParts.push(sql`mv.member_id IN (${memberIdParams})`);
    }
    if (voteDirections.length === 1) {
      subParts.push(sql`mv.vote_value = ${voteDirections[0]}`);
    } else if (voteDirections.length > 1) {
      const dirCond = sql.join(
        voteDirections.map((v) => sql`mv.vote_value = ${v}`),
        sql` OR `,
      );
      subParts.push(sql`(${dirCond})`);
    }
    if (factionIds.length === 1) {
      subParts.push(sql`m.faction_id = ${Number(factionIds[0])}`);
    } else if (factionIds.length > 1) {
      const factionIdParams = sql.join(
        factionIds.map((id) => sql`${Number(id)}`),
        sql`, `,
      );
      subParts.push(sql`m.faction_id IN (${factionIdParams})`);
    }
    const subWhere = sql.join(subParts, sql` AND `);
    if (factionIds.length > 0) {
      conditions.push(
        sql`EXISTS (SELECT 1 FROM member_votes mv JOIN members m ON mv.member_id = m.id WHERE ${subWhere})`,
      );
    } else {
      conditions.push(
        sql`EXISTS (SELECT 1 FROM member_votes mv WHERE ${subWhere})`,
      );
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  let orderByClause;
  switch (sortFieldKey) {
    case 'date':
      orderByClause =
        sortDir === 'asc' ? asc(votes.voteDate) : desc(votes.voteDate);
      break;
    case 'mostVotes':
      orderByClause =
        sortDir === 'asc'
          ? asc(
              sql`${votes.forCount} + ${votes.againstCount} + ${votes.abstainCount}`,
            )
          : desc(
              sql`${votes.forCount} + ${votes.againstCount} + ${votes.abstainCount}`,
            );
      break;
    case 'mostControversial':
      // Most controversial = smallest gap between for/against
      // sortDir=desc → most controversial first (asc abs diff)
      // sortDir=asc  → least controversial first (desc abs diff)
      orderByClause =
        sortDir === 'desc'
          ? asc(sql`abs(${votes.forCount} - ${votes.againstCount})`)
          : desc(sql`abs(${votes.forCount} - ${votes.againstCount})`);
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
        <VotesFilter factions={factionList} currentMembers={memberList} />
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
                  if (knessetRaw) urlParams.set('knesset', knessetRaw);
                  if (resultFilter) urlParams.set('result', resultFilter);
                  if (sortFieldKey && sortFieldKey !== 'date')
                    urlParams.set('sort', sortFieldKey);
                  if (sortDir && sortDir !== 'desc')
                    urlParams.set('sortDir', sortDir);
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
