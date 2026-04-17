import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { Vote, ArrowRight, Map, Ban } from 'lucide-react';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { electoralLists } from '@/lib/db/schema';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Link } from '@/i18n/navigation';
import { appConfig } from '../../../../../app.config';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('seo.elections');
  return {
    title: t('title'),
    description: t('description'),
    openGraph: { title: t('title'), description: t('description') },
  };
}

interface Props {
  searchParams: Promise<{ knesset?: string }>;
}

export const dynamic = 'force-dynamic';

export default async function ElectionsPage({ searchParams }: Props) {
  const t = await getTranslations('elections');
  const t2026 = await getTranslations('elections2026');
  const tMap = await getTranslations('electionMap');
  const params = await searchParams;
  const knessetFilter = params.knesset ? Number(params.knesset) : null;

  // Get distinct knesset numbers that have electoral lists
  const knessetNums = await db
    .selectDistinct({ knessetNum: electoralLists.knessetNum })
    .from(electoralLists)
    .orderBy(desc(electoralLists.knessetNum));
  const availableKnessets = knessetNums.map((k) => k.knessetNum);

  const activeKnesset =
    knessetFilter ??
    (availableKnessets[0] || appConfig.knesset.syncKnessets[0]);

  // Fetch electoral lists for the selected knesset
  const data = await db
    .select({
      id: electoralLists.id,
      name: electoralLists.name,
      ballotLetters: electoralLists.ballotLetters,
      knessetNum: electoralLists.knessetNum,
      totalVotes: electoralLists.totalVotes,
      votePercentage: electoralLists.votePercentage,
      seats: electoralLists.seats,
      isElected: electoralLists.isElected,
    })
    .from(electoralLists)
    .where(eq(electoralLists.knessetNum, activeKnesset))
    .orderBy(desc(electoralLists.seats));

  const maxSeats = Math.max(...data.map((d) => d.seats), 1);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <div className="bg-primary/10 ring-primary/20 flex h-14 w-14 items-center justify-center rounded-2xl ring-1">
          <Vote className="text-primary h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t('title')}
          </h1>
        </div>
      </div>

      {/* Elections 2026 banner */}
      <div className="mb-6">
        <Link href="/elections/2026">
          <Card className="border-primary/30 from-primary/5 to-primary/10 hover:border-primary/50 overflow-hidden bg-gradient-to-r transition-colors">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <h2 className="text-lg font-bold">{t2026('bannerTitle')}</h2>
                <p className="text-muted-foreground text-sm">
                  {t2026('bannerDescription')}
                </p>
              </div>
              <ArrowRight className="text-primary h-5 w-5 shrink-0 rtl:rotate-180" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Election map banner */}
      <div className="mb-6">
        <Link href="/elections/map">
          <Card className="border-chart-1/30 from-chart-1/5 to-chart-1/10 hover:border-chart-1/50 overflow-hidden bg-gradient-to-r transition-colors">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Map className="text-chart-1 h-5 w-5 shrink-0" />
                <div>
                  <h2 className="text-lg font-bold">{tMap('title')}</h2>
                  <p className="text-muted-foreground text-sm">
                    {tMap('description')}
                  </p>
                </div>
              </div>
              <ArrowRight className="text-chart-1 h-5 w-5 shrink-0 rtl:rotate-180" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Knesset tabs */}
      {availableKnessets.length > 0 && (
        <div className="bg-muted/60 mb-6 flex flex-wrap gap-1.5 rounded-xl p-1.5 backdrop-blur-sm">
          {availableKnessets.map((num) => (
            <Link
              key={num}
              href={`/elections${num === availableKnessets[0] ? '' : `?knesset=${num}`}`}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                activeKnesset === num
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('knesset', { num })}
            </Link>
          ))}
        </div>
      )}

      {data.length > 0 ? (
        <div className="space-y-2">
          {/* Header row — desktop only */}
          <div className="text-muted-foreground hidden items-center gap-4 px-4 ps-5 pb-1 text-xs font-medium tracking-wider uppercase sm:flex">
            <span className="w-16 text-center">{t('ballotLetters')}</span>
            <span className="flex-1">{t('listName')}</span>
            <span className="w-28 text-end">{t('totalVotes')}</span>
            <span className="w-16 text-end">{t('percentage')}</span>
            <span className="w-32 pe-2 text-end">{t('seats')}</span>
            <span className="w-8" />
          </div>

          <TooltipProvider>
            {data.map((list) => (
              <div key={list.id} className="group relative">
                <Link href={`/elections/${list.id}`}>
                  <Card
                    className={`glass-card hover-lift overflow-hidden ${
                      list.isElected
                        ? 'border-s-4 border-s-green-500/50'
                        : 'border-s-destructive/30 border-s-4'
                    }`}
                  >
                    <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
                      {/* Ballot letters */}
                      <span className="bg-primary/10 text-primary inline-flex w-16 items-center justify-center rounded-lg py-1 font-mono text-lg font-bold">
                        {list.ballotLetters}
                      </span>

                      {/* Party name */}
                      <div className="min-w-0 flex-1">
                        <span className="line-clamp-1 leading-tight font-medium">
                          {list.name}
                        </span>
                        {/* Mobile stats */}
                        <div className="mt-1.5 flex items-center gap-3 sm:hidden">
                          <span className="text-muted-foreground text-xs tabular-nums">
                            {list.totalVotes?.toLocaleString() ?? '—'}
                          </span>
                          <span className="text-muted-foreground text-xs tabular-nums">
                            {list.votePercentage
                              ? `${list.votePercentage}%`
                              : '—'}
                          </span>
                          <span className="text-sm font-bold tabular-nums">
                            {list.seats} {t('seats')}
                          </span>
                          {!list.isElected && (
                            <Ban className="text-destructive/60 h-3.5 w-3.5" />
                          )}
                        </div>
                      </div>

                      {/* Total votes — desktop */}
                      <span className="hidden w-28 text-end text-sm tabular-nums sm:block">
                        {list.totalVotes?.toLocaleString() ?? '—'}
                      </span>

                      {/* Percentage — desktop */}
                      <span className="hidden w-16 text-end text-sm tabular-nums sm:block">
                        {list.votePercentage ? `${list.votePercentage}%` : '—'}
                      </span>

                      {/* Seats + progress bar — desktop */}
                      <div className="hidden w-32 items-center gap-2 sm:flex">
                        <Progress
                          value={(list.seats / maxSeats) * 100}
                          className="h-2 flex-1"
                        />
                        <span className="w-8 text-end text-sm font-bold tabular-nums">
                          {list.seats}
                        </span>
                      </div>

                      {/* Threshold icon — desktop, only for parties that didn't pass */}
                      <div className="hidden w-8 items-center justify-center sm:flex">
                        {!list.isElected && (
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <span className="text-destructive/60 cursor-default" />
                              }
                            >
                              <Ban className="h-4 w-4" />
                            </TooltipTrigger>
                            <TooltipContent>{t('notElected')}</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            ))}
          </TooltipProvider>
        </div>
      ) : (
        <div className="text-muted-foreground mt-16 flex flex-col items-center gap-3">
          <div className="bg-muted flex h-16 w-16 items-center justify-center rounded-2xl">
            <Vote className="h-8 w-8 opacity-40" />
          </div>
          <p className="text-sm">{t('noResults')}</p>
        </div>
      )}
    </div>
  );
}
