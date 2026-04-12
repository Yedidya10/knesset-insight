'use client';

import { useTranslations } from 'next-intl';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import MemberAvatar from '@/components/members/MemberAvatar';

interface FactionCounts {
  for: number;
  against: number;
  abstain: number;
  absent: number;
  isCoalition: boolean | null;
}

export interface FactionVoter {
  memberId: number;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  voteValue: string;
}

interface FactionBreakdownProps {
  coalitionFactions: [string, FactionCounts][];
  oppositionFactions: [string, FactionCounts][];
  voters?: Map<string, FactionVoter[]>;
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

function TotalBadges({ entries }: { entries: [string, FactionCounts][] }) {
  const totals = sumCounts(entries);
  const total = totals.for + totals.against + totals.abstain;
  if (total === 0) return null;
  return (
    <div className="flex items-center gap-1.5">
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

const voteColorMap = {
  for: 'text-green-600 dark:text-green-400',
  against: 'text-red-600 dark:text-red-400',
  abstain: 'text-yellow-600 dark:text-yellow-400',
} as const;

function FactionVoterPopover({
  voters,
  labels,
  children,
}: {
  voters: FactionVoter[];
  labels: { for: string; against: string; abstain: string };
  children: React.ReactNode;
}) {
  const grouped = {
    for: voters.filter((v) => v.voteValue === 'for'),
    against: voters.filter((v) => v.voteValue === 'against'),
    abstain: voters.filter((v) => v.voteValue === 'abstain'),
  };

  return (
    <Popover delay={300} closeDelay={300}>
      <PopoverTrigger openOnHover render={<div />}>
        {children}
      </PopoverTrigger>
      <PopoverContent className="max-h-72 w-64 overflow-y-auto p-3">
        <div className="space-y-2">
          {(['for', 'against', 'abstain'] as const).map((value) => {
            const group = grouped[value];
            if (group.length === 0) return null;
            return (
              <div key={value}>
                <p
                  className={`mb-1 text-xs font-semibold ${voteColorMap[value]}`}
                >
                  {labels[value]} ({group.length})
                </p>
                <div className="space-y-0.5">
                  {group.map((v) => (
                    <div
                      key={v.memberId}
                      className="flex items-center gap-1.5 text-xs"
                    >
                      <MemberAvatar
                        member={{
                          firstName: v.firstName,
                          lastName: v.lastName,
                          imageUrl: v.imageUrl,
                        }}
                        size="sm"
                      />
                      <span className="truncate">
                        {v.firstName} {v.lastName}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function FactionBarList({
  entries,
  labels,
  voters,
}: {
  entries: [string, FactionCounts][];
  labels: { for: string; against: string; abstain: string };
  voters?: Map<string, FactionVoter[]>;
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
        const factionVoters = voters?.get(partyName);

        const barContent = (
          <div className="bg-muted/30 hover:bg-muted/50 cursor-pointer rounded-lg px-3 py-2 transition-colors">
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
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <div className="bg-muted/60 h-1.5 w-full overflow-hidden rounded-full" />
                  }
                >
                  <div
                    className="flex h-full overflow-hidden rounded-full transition-all"
                    style={{ width: `${barWidth}%` }}
                  >
                    {counts.for > 0 && (
                      <div
                        className="h-full bg-green-500 dark:bg-green-600"
                        style={{ width: `${(counts.for / total) * 100}%` }}
                      />
                    )}
                    {counts.against > 0 && (
                      <div
                        className="h-full bg-red-500 dark:bg-red-600"
                        style={{ width: `${(counts.against / total) * 100}%` }}
                      />
                    )}
                    {counts.abstain > 0 && (
                      <div
                        className="h-full bg-yellow-500 dark:bg-yellow-600"
                        style={{ width: `${(counts.abstain / total) * 100}%` }}
                      />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="flex gap-3 text-xs font-medium">
                    {counts.for > 0 && (
                      <span>
                        <span className="font-semibold">{labels.for}:</span>{' '}
                        {counts.for}
                      </span>
                    )}
                    {counts.against > 0 && (
                      <span>
                        <span className="font-semibold">{labels.against}:</span>{' '}
                        {counts.against}
                      </span>
                    )}
                    {counts.abstain > 0 && (
                      <span>
                        <span className="font-semibold">{labels.abstain}:</span>{' '}
                        {counts.abstain}
                      </span>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        );

        if (factionVoters && factionVoters.length > 0) {
          return (
            <FactionVoterPopover
              key={partyName}
              voters={factionVoters}
              labels={labels}
            >
              {barContent}
            </FactionVoterPopover>
          );
        }

        return <div key={partyName}>{barContent}</div>;
      })}
    </div>
  );
}

export default function FactionBreakdown({
  coalitionFactions,
  oppositionFactions,
  voters,
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
              <TotalBadges entries={coalitionFactions} />
            </div>
            <FactionBarList
              entries={coalitionFactions}
              labels={labels}
              voters={voters}
            />
          </div>
        )}
        {hasOpposition && (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-muted-foreground text-sm font-semibold">
                {t('oppositionBreakdown')}
              </h3>
              <TotalBadges entries={oppositionFactions} />
            </div>
            <FactionBarList
              entries={oppositionFactions}
              labels={labels}
              voters={voters}
            />
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
                <TotalBadges entries={coalitionFactions} />
              </TabsTrigger>
              <TabsTrigger value="opposition" className="gap-1.5">
                {t('oppositionBreakdown')}
                <TotalBadges entries={oppositionFactions} />
              </TabsTrigger>
            </TabsList>
            <TabsContent value="coalition" className="mt-3">
              <FactionBarList
                entries={coalitionFactions}
                labels={labels}
                voters={voters}
              />
            </TabsContent>
            <TabsContent value="opposition" className="mt-3">
              <FactionBarList
                entries={oppositionFactions}
                labels={labels}
                voters={voters}
              />
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
                  <TotalBadges entries={coalitionFactions} />
                </div>
                <FactionBarList
                  entries={coalitionFactions}
                  labels={labels}
                  voters={voters}
                />
              </div>
            )}
            {hasOpposition && (
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="text-muted-foreground text-sm font-semibold">
                    {t('oppositionBreakdown')}
                  </h3>
                  <TotalBadges entries={oppositionFactions} />
                </div>
                <FactionBarList
                  entries={oppositionFactions}
                  labels={labels}
                  voters={voters}
                />
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
