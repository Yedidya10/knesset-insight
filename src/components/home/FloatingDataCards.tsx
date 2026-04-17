'use client';

import { useTranslations } from 'next-intl';
import { Check, X, Gavel, Vote, CalendarDays, Building2 } from 'lucide-react';

interface FloatingDataCardsProps {
  latestVote: {
    title: string;
    isAccepted: boolean | null;
    forCount: number;
    againstCount: number;
  } | null;
  activeBillsCount: number;
  electionDaysLeft: number | null;
  factionStats: {
    total: number;
    coalitionSeats: number;
    oppositionSeats: number;
  };
}

export default function FloatingDataCards({
  latestVote,
  activeBillsCount,
  electionDaysLeft,
  factionStats,
}: FloatingDataCardsProps) {
  const t = useTranslations('home.hero');

  const totalVotes = latestVote
    ? latestVote.forCount + latestVote.againstCount
    : 0;
  const forPct = totalVotes > 0 ? (latestVote!.forCount / totalVotes) * 100 : 0;

  return (
    <div className="pointer-events-none absolute inset-0 hidden lg:block">
      {/* Latest Vote — top-left */}
      {latestVote && (
        <div className="animate-hero-float-1 pointer-events-auto absolute start-4 top-8 max-w-[220px] xl:start-8">
          <div className="glass-card rounded-xl p-3 shadow-lg">
            <div className="mb-1.5 flex items-center gap-2">
              <Vote className="text-chart-2 h-4 w-4 shrink-0" />
              <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                {t('latestVote')}
              </span>
            </div>
            <p className="line-clamp-2 text-xs leading-snug font-medium">
              {latestVote.title}
            </p>
            <div className="mt-2 flex items-center gap-2">
              {latestVote.isAccepted ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <Check className="h-3 w-3" />
                  {t('approved')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">
                  <X className="h-3 w-3" />
                  {t('rejected')}
                </span>
              )}
              {/* Mini for/against bar */}
              <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-red-500/20">
                <div
                  className="rounded-s-full bg-emerald-500"
                  style={{ width: `${forPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Bills — top-right */}
      <div className="animate-hero-float-2 pointer-events-auto absolute end-4 top-12 xl:end-8">
        <div className="glass-card rounded-xl p-3 shadow-lg">
          <div className="mb-1 flex items-center gap-2">
            <Gavel className="text-chart-3 h-4 w-4 shrink-0" />
            <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
              {t('activeBillsLabel')}
            </span>
          </div>
          <p className="text-2xl font-bold tracking-tight">
            {activeBillsCount.toLocaleString()}
          </p>
          <p className="text-muted-foreground text-[10px]">
            {t('activeBills')}
          </p>
        </div>
      </div>

      {/* Election Countdown — bottom-left (conditional) */}
      {electionDaysLeft !== null && electionDaysLeft > 0 && (
        <div className="animate-hero-float-3 pointer-events-auto absolute start-4 bottom-16 xl:start-12">
          <div className="glass-card rounded-xl p-3 shadow-lg">
            <div className="mb-1 flex items-center gap-2">
              <CalendarDays className="text-chart-4 h-4 w-4 shrink-0" />
              <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                {t('electionIn')}
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold tracking-tight">
                {electionDaysLeft}
              </span>
              <span className="text-muted-foreground text-xs">{t('days')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Parliament Split — bottom-right */}
      <div className="animate-hero-float-4 pointer-events-auto absolute end-4 bottom-20 xl:end-12">
        <div className="glass-card rounded-xl p-3 shadow-lg">
          <div className="mb-1 flex items-center gap-2">
            <Building2 className="text-chart-1 h-4 w-4 shrink-0" />
            <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
              {factionStats.total} {t('factions')}
            </span>
          </div>
          <div className="flex gap-3 text-xs">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {factionStats.coalitionSeats}
            </span>
            <span className="text-muted-foreground">/</span>
            <span className="font-semibold text-red-600 dark:text-red-400">
              {factionStats.oppositionSeats}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
