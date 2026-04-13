'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

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

  return (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t('national.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">{t('national.eligible')}</p>
            <p className="text-lg font-semibold tabular-nums">
              {totalEligible.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{t('national.voters')}</p>
            <p className="text-lg font-semibold tabular-nums">
              {totalVoters.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{t('national.turnout')}</p>
            <div className="flex items-center gap-2">
              <p className="text-lg font-semibold tabular-nums">
                {turnoutPercent.toFixed(1)}%
              </p>
            </div>
            <Progress value={turnoutPercent} className="mt-1 h-1.5" />
          </div>
          <div>
            <p className="text-muted-foreground">{t('national.cities')}</p>
            <p className="text-lg font-semibold tabular-nums">
              {cityCount.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Top parties */}
        {topParties.length > 0 && (
          <div>
            <h4 className="text-muted-foreground mb-2 text-sm font-medium">
              {t('national.topParties', { count: 5 })}
            </h4>
            <div className="space-y-2">
              {topParties.slice(0, 5).map((party) => (
                <div key={party.ballotLetters} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate">{party.partyName}</span>
                    <span className="text-muted-foreground shrink-0 tabular-nums">
                      {party.percent.toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={party.percent} className="h-1.5" />
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
