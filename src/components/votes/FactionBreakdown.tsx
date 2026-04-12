'use client';

import { useTranslations } from 'next-intl';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface FactionCounts {
  for: number;
  against: number;
  abstain: number;
  absent: number;
  isCoalition: boolean | null;
}

interface FactionBreakdownProps {
  coalitionFactions: [string, FactionCounts][];
  oppositionFactions: [string, FactionCounts][];
}

function sumCounts(entries: [string, FactionCounts][]) {
  return entries.reduce(
    (acc, [, c]) => ({
      for: acc.for + c.for,
      against: acc.against + c.against,
      abstain: acc.abstain + c.abstain,
    }),
    { for: 0, against: 0, abstain: 0 },
  );
}

function TotalBadges({
  entries,
  labels,
}: {
  entries: [string, FactionCounts][];
  labels: { for: string; against: string; abstain: string };
}) {
  const totals = sumCounts(entries);
  const total = totals.for + totals.against + totals.abstain;
  if (total === 0) return null;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground text-xs font-medium tabular-nums">
        ({total})
      </span>
      {totals.for > 0 && (
        <span className="inline-flex min-w-5 items-center justify-center rounded-md bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700 tabular-nums dark:bg-green-950/50 dark:text-green-400">
          {totals.for}
        </span>
      )}
      {totals.against > 0 && (
        <span className="inline-flex min-w-5 items-center justify-center rounded-md bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700 tabular-nums dark:bg-red-950/50 dark:text-red-400">
          {totals.against}
        </span>
      )}
      {totals.abstain > 0 && (
        <span className="inline-flex min-w-5 items-center justify-center rounded-md bg-yellow-100 px-1.5 py-0.5 text-xs font-medium text-yellow-700 tabular-nums dark:bg-yellow-950/50 dark:text-yellow-400">
          {totals.abstain}
        </span>
      )}
    </div>
  );
}

function FactionBarList({
  entries,
  labels,
}: {
  entries: [string, FactionCounts][];
  labels: { for: string; against: string; abstain: string };
}) {
  const sorted = [...entries].sort(
    (a, b) =>
      b[1].for +
      b[1].against +
      b[1].abstain -
      (a[1].for + a[1].against + a[1].abstain),
  );
  const maxTotal = Math.max(
    ...sorted.map(([, c]) => c.for + c.against + c.abstain),
    1,
  );

  return (
    <div className="space-y-1.5">
      {sorted.map(([partyName, counts]) => {
        const total = counts.for + counts.against + counts.abstain;
        if (total === 0) return null;
        const barWidth = (total / maxTotal) * 100;
        return (
          <div
            key={partyName}
            className="bg-muted/30 hover:bg-muted/50 rounded-lg px-3 py-2 transition-colors"
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">{partyName}</span>
              <div className="flex shrink-0 items-center gap-1.5">
                {counts.for > 0 && (
                  <span className="inline-flex min-w-5 items-center justify-center rounded-md bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700 tabular-nums dark:bg-green-950/50 dark:text-green-400">
                    {counts.for}
                  </span>
                )}
                {counts.against > 0 && (
                  <span className="inline-flex min-w-5 items-center justify-center rounded-md bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700 tabular-nums dark:bg-red-950/50 dark:text-red-400">
                    {counts.against}
                  </span>
                )}
                {counts.abstain > 0 && (
                  <span className="inline-flex min-w-5 items-center justify-center rounded-md bg-yellow-100 px-1.5 py-0.5 text-xs font-medium text-yellow-700 tabular-nums dark:bg-yellow-950/50 dark:text-yellow-400">
                    {counts.abstain}
                  </span>
                )}
              </div>
            </div>
            <div className="bg-muted/60 h-1.5 w-full overflow-hidden rounded-full">
              <div
                className="flex h-full overflow-hidden rounded-full transition-all"
                style={{ width: `${barWidth}%` }}
              >
                {counts.for > 0 && (
                  <div
                    className="h-full bg-green-500 dark:bg-green-600"
                    style={{ width: `${(counts.for / total) * 100}%` }}
                    title={`${labels.for}: ${counts.for}`}
                  />
                )}
                {counts.against > 0 && (
                  <div
                    className="h-full bg-red-500 dark:bg-red-600"
                    style={{ width: `${(counts.against / total) * 100}%` }}
                    title={`${labels.against}: ${counts.against}`}
                  />
                )}
                {counts.abstain > 0 && (
                  <div
                    className="h-full bg-yellow-500 dark:bg-yellow-600"
                    style={{ width: `${(counts.abstain / total) * 100}%` }}
                    title={`${labels.abstain}: ${counts.abstain}`}
                  />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function FactionBreakdown({
  coalitionFactions,
  oppositionFactions,
}: FactionBreakdownProps) {
  const t = useTranslations('votes');
  const labels = {
    for: t('for'),
    against: t('against'),
    abstain: t('abstain'),
  };

  const hasCoalition = coalitionFactions.length > 0;
  const hasOpposition = oppositionFactions.length > 0;

  if (!hasCoalition && !hasOpposition) return null;

  return (
    <>
      {/* Desktop: side-by-side columns */}
      <div className="hidden md:grid md:grid-cols-2 md:gap-6">
        {hasCoalition && (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-muted-foreground text-sm font-semibold">
                {t('coalitionBreakdown')}
              </h3>
              <TotalBadges entries={coalitionFactions} labels={labels} />
            </div>
            <FactionBarList entries={coalitionFactions} labels={labels} />
          </div>
        )}
        {hasOpposition && (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-muted-foreground text-sm font-semibold">
                {t('oppositionBreakdown')}
              </h3>
              <TotalBadges entries={oppositionFactions} labels={labels} />
            </div>
            <FactionBarList entries={oppositionFactions} labels={labels} />
          </div>
        )}
      </div>

      {/* Mobile: tabs */}
      <div className="md:hidden">
        {hasCoalition && hasOpposition ? (
          <Tabs defaultValue="coalition">
            <TabsList className="w-full">
              <TabsTrigger value="coalition" className="gap-1.5">
                {t('coalitionBreakdown')}
                <span className="text-muted-foreground text-xs tabular-nums">
                  (
                  {sumCounts(coalitionFactions).for +
                    sumCounts(coalitionFactions).against +
                    sumCounts(coalitionFactions).abstain}
                  )
                </span>
              </TabsTrigger>
              <TabsTrigger value="opposition" className="gap-1.5">
                {t('oppositionBreakdown')}
                <span className="text-muted-foreground text-xs tabular-nums">
                  (
                  {sumCounts(oppositionFactions).for +
                    sumCounts(oppositionFactions).against +
                    sumCounts(oppositionFactions).abstain}
                  )
                </span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="coalition" className="mt-3">
              <FactionBarList entries={coalitionFactions} labels={labels} />
            </TabsContent>
            <TabsContent value="opposition" className="mt-3">
              <FactionBarList entries={oppositionFactions} labels={labels} />
            </TabsContent>
          </Tabs>
        ) : (
          <>
            {hasCoalition && (
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="text-muted-foreground text-sm font-semibold">
                    {t('coalitionBreakdown')}
                  </h3>
                  <TotalBadges entries={coalitionFactions} labels={labels} />
                </div>
                <FactionBarList entries={coalitionFactions} labels={labels} />
              </div>
            )}
            {hasOpposition && (
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="text-muted-foreground text-sm font-semibold">
                    {t('oppositionBreakdown')}
                  </h3>
                  <TotalBadges entries={oppositionFactions} labels={labels} />
                </div>
                <FactionBarList entries={oppositionFactions} labels={labels} />
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
