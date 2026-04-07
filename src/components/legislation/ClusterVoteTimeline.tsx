'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Badge } from '@/components/ui/badge';
import { VoteTalliesBar } from './VoteTalliesBar';
import { cn } from '@/lib/utils';

interface TimelineVote {
  id: number;
  title: string;
  voteDate: string | Date | null;
  billId: number | null;
  billName?: string;
  billStage?: number | null;
  forCount: number;
  againstCount: number;
  abstainCount: number;
  isAccepted: boolean | null;
  knessetNum?: number;
}

interface ClusterVoteTimelineProps {
  votes: TimelineVote[];
}

const KNESSET_DOT_COLORS: Record<number, string> = {
  20: 'bg-blue-500',
  21: 'bg-violet-500',
  22: 'bg-amber-500',
  23: 'bg-emerald-500',
  24: 'bg-rose-500',
  25: 'bg-cyan-500',
};

export function ClusterVoteTimeline({ votes }: ClusterVoteTimelineProps) {
  const t = useTranslations('legislation');

  if (votes.length === 0) return null;

  // Sort chronologically (oldest first)
  const sorted = [...votes].sort((a, b) => {
    const da = a.voteDate ? new Date(a.voteDate).getTime() : 0;
    const db = b.voteDate ? new Date(b.voteDate).getTime() : 0;
    return da - db;
  });

  return (
    <div className="relative">
      {/* Vertical rail */}
      <div className="absolute start-4 top-0 bottom-0 w-[2px] bg-muted" />

      <div className="space-y-4">
        {sorted.map((vote, idx) => {
          const kNum = vote.knessetNum;
          const dotColor = kNum
            ? (KNESSET_DOT_COLORS[kNum] ?? 'bg-gray-500')
            : 'bg-primary';

          return (
            <div key={vote.id} className="relative flex gap-4 ps-10">
              {/* Timeline dot */}
              <div
                className={cn(
                  'absolute start-[10px] top-1 h-3 w-3 rounded-full ring-2 ring-background',
                  dotColor,
                )}
              />

              {/* Vote content */}
              <Link
                href={`/votes/${vote.id}`}
                className="flex-1 rounded-lg border p-3 transition-colors hover:bg-muted/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug line-clamp-2">
                      {vote.title}
                    </p>
                    {vote.billName && (
                      <p className="mt-0.5 text-xs text-muted-foreground truncate">
                        {vote.billName}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant={vote.isAccepted ? 'default' : 'destructive'}
                    className="shrink-0 text-[10px]"
                  >
                    {vote.isAccepted ? t('accepted') : t('rejected')}
                  </Badge>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  {vote.voteDate && (
                    <span>
                      {new Date(vote.voteDate).toLocaleDateString()}
                    </span>
                  )}
                  {kNum && (
                    <span className="flex items-center gap-1">
                      <span
                        className={cn(
                          'inline-block h-2 w-2 rounded-full',
                          dotColor,
                        )}
                      />
                      K{kNum}
                    </span>
                  )}
                </div>
                <div className="mt-2">
                  <VoteTalliesBar
                    forCount={vote.forCount}
                    againstCount={vote.againstCount}
                    abstainCount={vote.abstainCount}
                    isAccepted={vote.isAccepted}
                    compact
                  />
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
