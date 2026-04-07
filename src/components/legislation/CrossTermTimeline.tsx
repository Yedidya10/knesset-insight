'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
    <div className="w-full overflow-x-auto">
      <div className="flex items-end gap-1" style={{ minWidth: allKnessets.length * 120 }}>
        {allKnessets.map((k) => {
          const entry = entryMap.get(k);
          const hasActivity = entry && entry.bills.length > 0;
          const color = KNESSET_COLORS[k] ?? 'bg-gray-500';

          return (
            <div key={k} className="flex flex-1 flex-col items-center gap-2">
              {/* Bills in this Knesset term */}
              <div className="flex flex-col items-center gap-1 min-h-12">
                {hasActivity ? (
                  entry!.bills.map((bill) => (
                    <div
                      key={bill.id}
                      className={cn(
                        'rounded-md px-2 py-1 text-[10px] text-white text-center max-w-[110px] truncate',
                        color,
                        bill.isPrimary && 'ring-2 ring-white/50 font-bold',
                      )}
                      title={bill.name}
                    >
                      {bill.currentStage}
                    </div>
                  ))
                ) : (
                  <div className="h-6 w-px bg-muted" />
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
              {k < maxK && (
                <div className="absolute" />
              )}
            </div>
          );
        })}
      </div>

      {/* Horizontal line connecting all knessets */}
      <div className="mx-6 -mt-[22px] mb-8 h-[2px] bg-muted rounded-full" />

      {/* Legend */}
      {entries.length > 1 && (
        <div className="mt-2 flex items-center justify-center">
          <Badge variant="outline" className="text-[10px]">
            {t('clusters.crossTerm')} · {t('clusters.knessetRange', { from: minK, to: maxK })}
          </Badge>
        </div>
      )}
    </div>
  );
}
