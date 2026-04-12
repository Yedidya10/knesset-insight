'use client';

import { useMemo } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { GitMerge, GitBranch } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface RelatedBill {
  id: number;
  name: string | null;
  knessetNum?: number | null;
  date?: string | null;
}

interface BillRelationshipGraphProps {
  /** This bill was merged INTO these bills */
  unions: RelatedBill[];
  /** This bill was split FROM these bills (parents) */
  splitFrom: RelatedBill[];
  /** Bills that were split FROM this bill (children) */
  splitChildren: RelatedBill[];
  /** Bills that merged INTO this bill */
  mergedFromBills: RelatedBill[];
}

type EventType = 'splitFrom' | 'splitInto' | 'mergedInto' | 'mergedFrom';

interface EventGroup {
  type: EventType;
  bills: RelatedBill[];
  date: string | null;
  sortDate: number;
}

export default function BillRelationshipGraph({
  unions,
  splitFrom,
  splitChildren,
  mergedFromBills,
}: BillRelationshipGraphProps) {
  const t = useTranslations('legislation');
  const format = useFormatter();

  const eventGroups = useMemo(() => {
    const groups: EventGroup[] = [];

    const groupByDate = (bills: RelatedBill[], type: EventType) => {
      const dateMap = new Map<string, RelatedBill[]>();
      for (const bill of bills) {
        const key = bill.date ?? 'unknown';
        if (!dateMap.has(key)) dateMap.set(key, []);
        dateMap.get(key)!.push(bill);
      }
      for (const [date, groupBills] of dateMap) {
        groups.push({
          type,
          bills: groupBills,
          date: date === 'unknown' ? null : date,
          sortDate: date === 'unknown' ? 0 : new Date(date).getTime(),
        });
      }
    };

    groupByDate(splitFrom, 'splitFrom');
    groupByDate(splitChildren, 'splitInto');
    groupByDate(unions, 'mergedInto');
    groupByDate(mergedFromBills, 'mergedFrom');

    groups.sort((a, b) => a.sortDate - b.sortDate);
    return groups;
  }, [unions, splitFrom, splitChildren, mergedFromBills]);

  if (eventGroups.length === 0) return null;

  const isSplit = (type: EventType) =>
    type === 'splitFrom' || type === 'splitInto';

  const typeLabel = (type: EventType) => {
    switch (type) {
      case 'splitFrom':
        return t('special.splitFrom');
      case 'splitInto':
        return t('special.splitInto');
      case 'mergedInto':
        return t('special.mergedWith');
      case 'mergedFrom':
        return t('special.includesMerge');
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      return format.dateTime(new Date(dateStr), {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Card className="glass-card mb-6 overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <GitBranch className="text-primary h-4 w-4" />
          {t('clusters.relationshipGraph')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative ps-8">
          {/* Main trunk line */}
          <div className="bg-border absolute start-[11px] top-2 bottom-2 w-0.5" />

          {eventGroups.map((group, i) => {
            const split = isSplit(group.type);
            const isLast = i === eventGroups.length - 1;

            return (
              <div
                key={`${group.type}-${i}`}
                className={cn('relative', !isLast && 'pb-6')}
              >
                {/* Trunk dot */}
                <div
                  className={cn(
                    'absolute start-[-21px] top-0.5 z-10 flex h-5 w-5 items-center justify-center rounded-full border-2',
                    split
                      ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950'
                      : 'border-green-500 bg-green-50 dark:border-green-400 dark:bg-green-950',
                  )}
                >
                  {split ? (
                    <GitBranch className="h-2.5 w-2.5 text-blue-600 dark:text-blue-300" />
                  ) : (
                    <GitMerge className="h-2.5 w-2.5 text-green-600 dark:text-green-300" />
                  )}
                </div>

                {/* Branch connector line */}
                <div
                  className={cn(
                    'absolute start-[-8px] top-[9px] h-0.5 w-4',
                    split
                      ? 'bg-blue-300 dark:bg-blue-700'
                      : 'bg-green-300 dark:bg-green-700',
                  )}
                />

                {/* Event header */}
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'text-sm font-semibold',
                      split
                        ? 'text-blue-700 dark:text-blue-300'
                        : 'text-green-700 dark:text-green-300',
                    )}
                  >
                    {typeLabel(group.type)}
                  </span>
                  {group.date && (
                    <span className="text-muted-foreground text-xs">
                      {formatDate(group.date)}
                    </span>
                  )}
                </div>

                {/* Bill list */}
                <div className="mt-1.5 space-y-1">
                  {group.bills.map((bill) => (
                    <div key={bill.id} className="flex items-center gap-2">
                      <div
                        className={cn(
                          'h-1.5 w-1.5 shrink-0 rounded-full',
                          split
                            ? 'bg-blue-400 dark:bg-blue-500'
                            : 'bg-green-400 dark:bg-green-500',
                        )}
                      />
                      <Link
                        href={`/legislation/${bill.id}`}
                        className="text-primary line-clamp-1 text-sm underline-offset-2 hover:underline"
                      >
                        {bill.name ?? `#${bill.id}`}
                      </Link>
                      {bill.knessetNum && (
                        <Badge
                          variant="outline"
                          className="shrink-0 px-1 py-0 text-[10px]"
                        >
                          K{bill.knessetNum}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
