'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

const PARTY_COLORS = [
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
  '#6366f1',
  '#84cc16',
];

interface TopParty {
  ballotLetters: string;
  partyName: string;
  votes: number;
  percent: number;
}

interface NationalSummaryProps {
  totalEligible: number;
  totalVoters: number;
  totalValid: number;
  totalInvalid: number;
  turnoutPercent: number;
  cityCount: number;
  topParties: TopParty[];
}

export default function NationalSummary({
  totalEligible,
  totalVoters,
  turnoutPercent,
  cityCount,
  topParties,
}: NationalSummaryProps) {
  const t = useTranslations('electionMap');
  const maxPercent = topParties.length > 0 ? topParties[0].percent : 1;

  return (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold">
          {t('national.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-muted-foreground text-xs">
              {t('national.eligible')}
            </p>
            <p className="text-xl font-bold tabular-nums">
              {totalEligible.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">
              {t('national.voters')}
            </p>
            <p className="text-xl font-bold tabular-nums">
              {totalVoters.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-muted-foreground text-xs">
              {t('national.turnout')}
            </p>
            <p className="text-2xl font-black tabular-nums">
              {turnoutPercent.toFixed(1)}%
            </p>
            <Progress value={turnoutPercent} className="mt-1.5 h-2.5" />
          </div>
          <div>
            <p className="text-muted-foreground text-xs">
              {t('national.cities')}
            </p>
            <p className="text-2xl font-black tabular-nums">
              {cityCount.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Top parties — colored bars */}
        {topParties.length > 0 && (
          <div>
            <h4 className="text-muted-foreground mb-3 text-sm font-semibold">
              {t('national.topParties', { count: 5 })}
            </h4>
            <div className="space-y-2.5">
              {topParties.slice(0, 5).map((party, i) => {
                const color = PARTY_COLORS[i % PARTY_COLORS.length];
                const barWidth =
                  maxPercent > 0 ? (party.percent / maxPercent) * 100 : 0;
                return (
                  <div key={party.ballotLetters}>
                    <div className="mb-0.5 flex items-baseline justify-between">
                      <span className="text-sm font-semibold">
                        {party.partyName}
                      </span>
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {party.votes.toLocaleString()} (
                        {party.percent.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="bg-muted h-3 w-full overflow-hidden rounded-sm">
                      <div
                        className="h-full rounded-sm transition-all duration-300"
                        style={{
                          width: `${barWidth}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
