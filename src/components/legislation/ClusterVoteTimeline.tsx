'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { VoteTalliesBar } from './VoteTalliesBar';
import { InlineVoteDetail } from './InlineVoteDetail';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

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

function TimelineItem({
  vote,
  dotColor,
  t,
}: {
  vote: TimelineVote;
  dotColor: string;
  t: ReturnType<typeof useTranslations<'legislation'>>;
}) {
  const [open, setOpen] = useState(false);
  const kNum = vote.knessetNum;

  return (
    <div className="relative flex gap-4 ps-10">
      {/* Timeline dot */}
      <div
        className={cn(
          'ring-background absolute start-[10px] top-1 h-3 w-3 rounded-full ring-2',
          dotColor,
        )}
      />

      {/* Vote content */}
      <Collapsible open={open} onOpenChange={setOpen} className="flex-1">
        <div className="hover:bg-muted/30 rounded-lg border transition-colors">
          <CollapsibleTrigger
            render={<button className="w-full cursor-pointer p-3 text-start" />}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm leading-snug font-medium">
                  {vote.title}
                </p>
                {vote.billName && (
                  <p className="text-muted-foreground mt-0.5 truncate text-xs">
                    {vote.billName}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Badge
                  variant={vote.isAccepted ? 'default' : 'destructive'}
                  className="text-[10px]"
                >
                  {vote.isAccepted ? t('accepted') : t('rejected')}
                </Badge>
                <ChevronDown
                  className={`text-muted-foreground h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
                />
              </div>
            </div>
            <div className="text-muted-foreground mt-2 flex items-center gap-2 text-xs">
              {vote.voteDate && (
                <span>{new Date(vote.voteDate).toLocaleDateString()}</span>
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
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="border-t px-3 pb-3">
              <InlineVoteDetail voteId={vote.id} />
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}

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
      <div className="bg-muted absolute start-4 top-0 bottom-0 w-[2px]" />

      <div className="space-y-4">
        {sorted.map((vote) => {
          const kNum = vote.knessetNum;
          const dotColor = kNum
            ? (KNESSET_DOT_COLORS[kNum] ?? 'bg-gray-500')
            : 'bg-primary';

          return (
            <TimelineItem key={vote.id} vote={vote} dotColor={dotColor} t={t} />
          );
        })}
      </div>
    </div>
  );
}
