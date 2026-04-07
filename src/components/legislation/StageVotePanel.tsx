'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Vote } from 'lucide-react';
import { MiniVoteCard } from './MiniVoteCard';
import { VoteTalliesBar } from './VoteTalliesBar';

interface StageVote {
  id: number;
  title: string;
  voteDate: string | Date | null;
  forCount: number;
  againstCount: number;
  abstainCount: number;
  isAccepted: boolean | null;
  billStage?: number | null;
}

interface StageVotePanelProps {
  stageName: string;
  votes: StageVote[];
}

export function StageVotePanel({ stageName, votes }: StageVotePanelProps) {
  const t = useTranslations('legislation');

  if (votes.length === 0) return null;

  // Aggregate totals for the stage
  const totalFor = votes.reduce((s, v) => s + (v.forCount ?? 0), 0);
  const totalAgainst = votes.reduce((s, v) => s + (v.againstCount ?? 0), 0);
  const totalAbstain = votes.reduce((s, v) => s + (v.abstainCount ?? 0), 0);

  // Identify main vote (highest total participation) vs reservations
  const sorted = [...votes].sort(
    (a, b) =>
      (b.forCount + b.againstCount + b.abstainCount) -
      (a.forCount + a.againstCount + a.abstainCount),
  );
  const mainVote = sorted[0];
  const reservations = sorted.slice(1);

  return (
    <Card className="border-s-4 border-s-primary/30 bg-muted/10">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Vote className="h-4 w-4 text-primary" />
          {t('votes.voteAtStage', { stage: stageName })}
          <Badge variant="outline" className="text-[10px]">
            {votes.length > 1 ? `${votes.length} ${t('votes.reservations')}` : ''}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Main vote with full bar */}
        <div>
          <MiniVoteCard
            id={mainVote.id}
            title={mainVote.title}
            voteDate={mainVote.voteDate}
            forCount={mainVote.forCount}
            againstCount={mainVote.againstCount}
            abstainCount={mainVote.abstainCount}
            isAccepted={mainVote.isAccepted}
          />
        </div>

        {/* Reservations */}
        {reservations.length > 0 && (
          <div className="space-y-2 ps-3 border-s-2 border-muted">
            <p className="text-xs font-medium text-muted-foreground">
              {t('votes.reservations')} ({reservations.length})
            </p>
            {reservations.map((v) => (
              <MiniVoteCard
                key={v.id}
                id={v.id}
                title={v.title}
                voteDate={v.voteDate}
                forCount={v.forCount}
                againstCount={v.againstCount}
                abstainCount={v.abstainCount}
                isAccepted={v.isAccepted}
              />
            ))}
          </div>
        )}

        {/* Aggregated bar for entire stage */}
        {votes.length > 1 && (
          <div className="pt-2 border-t">
            <p className="mb-1 text-xs text-muted-foreground">{t('votes.stageVote')}</p>
            <VoteTalliesBar
              forCount={totalFor}
              againstCount={totalAgainst}
              abstainCount={totalAbstain}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
