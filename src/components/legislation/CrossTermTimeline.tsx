'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface TimelineEntry {
  knessetNum: number;
  bills: {
    id: number;
    name: string;
    currentStage: string;
    isPrimary: boolean;
    proposedDate: string | null;
  }[];
}

interface CrossTermTimelineProps {
  entries: TimelineEntry[];
  knessetRange: [number, number];
}

const KNESSET_COLORS: Record<number, string> = {
  20: 'bg-blue-500',
  21: 'bg-violet-500',
  22: 'bg-amber-500',
  23: 'bg-emerald-500',
  24: 'bg-rose-500',
  25: 'bg-cyan-500',
};

export function CrossTermTimeline({
  entries,
  knessetRange,
}: CrossTermTimelineProps) {
  const t = useTranslations('legislation');

  const [minK, maxK] = knessetRange;
  const allKnessets: number[] = [];
  for (let k = minK; k <= maxK; k++) allKnessets.push(k);

  const entryMap = new Map(entries.map((e) => [e.knessetNum, e]));

  return (
    <TooltipProvider>
      <div className="w-full overflow-x-auto">
        <div
          className="flex items-end gap-1"
          style={{ minWidth: allKnessets.length * 120 }}
        >
          {allKnessets.map((k) => {
            const entry = entryMap.get(k);
            const hasActivity = entry && entry.bills.length > 0;
            const color = KNESSET_COLORS[k] ?? 'bg-gray-500';

            return (
              <div key={k} className="flex flex-1 flex-col items-center gap-2">
                {/* Bills in this Knesset term */}
                <div className="flex min-h-12 flex-col items-center gap-1">
                  {hasActivity ? (
                    entry!.bills.map((bill) => (
                      <Tooltip key={bill.id}>
                        <TooltipTrigger
                          render={
                            <div
                              className={cn(
                                'max-w-[110px] truncate rounded-md px-2 py-1 text-center text-[10px] text-white',
                                color,
                                bill.isPrimary &&
                                  'font-bold ring-2 ring-white/50',
                              )}
                            />
                          }
                        >
                          {bill.currentStage}
                        </TooltipTrigger>
                        <TooltipContent>{bill.name}</TooltipContent>
                      </Tooltip>
                    ))
                  ) : (
                    <div className="bg-muted h-6 w-px" />
                  )}
                </div>

                {/* Knesset label */}
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'h-3 w-3 rounded-full',
                      hasActivity ? color : 'bg-muted',
                    )}
                  />
                  <div
                    className={cn(
                      'mt-1 text-xs font-medium',
                      hasActivity
                        ? 'text-foreground'
                        : 'text-muted-foreground/50',
                    )}
                  >
                    {t('knessetNum', { num: k })}
                  </div>
                </div>

                {/* Connector to next */}
                {k < maxK && <div className="absolute" />}
              </div>
            );
          })}
        </div>

        {/* Horizontal line connecting all knessets */}
        <div className="bg-muted mx-6 -mt-[22px] mb-8 h-[2px] rounded-full" />

        {/* Legend */}
        {entries.length > 1 && (
          <div className="mt-2 flex items-center justify-center">
            <Badge variant="outline" className="text-[10px]">
              {t('clusters.crossTerm')} ·{' '}
              {t('clusters.knessetRange', { from: minK, to: maxK })}
            </Badge>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
