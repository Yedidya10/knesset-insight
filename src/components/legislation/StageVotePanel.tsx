'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Vote } from 'lucide-react';
import { MiniVoteCard } from './MiniVoteCard';

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

/** Regex to detect reservation votes by title */
const RESERVATION_RE = /הסתייגו/;

export function StageVotePanel({ stageName, votes }: StageVotePanelProps) {
  const t = useTranslations('legislation');

  if (votes.length === 0) return null;

  // Classify votes by title pattern — not by participation count
  const mainVotes: StageVote[] = [];
  const reservations: StageVote[] = [];
  for (const v of votes) {
    if (RESERVATION_RE.test(v.title)) {
      reservations.push(v);
    } else {
      mainVotes.push(v);
    }
  }

  // Sort: main votes by date desc, reservations by title number
  mainVotes.sort(
    (a, b) =>
      new Date(b.voteDate ?? 0).getTime() - new Date(a.voteDate ?? 0).getTime(),
  );
  reservations.sort(
    (a, b) =>
      new Date(b.voteDate ?? 0).getTime() - new Date(a.voteDate ?? 0).getTime(),
  );

  const reservationCount = reservations.length;

  return (
    <Card className="border-s-primary/30 bg-muted/10 border-s-4">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Vote className="text-primary h-4 w-4" />
          {t('votes.voteAtStage', { stage: stageName })}
          {reservationCount > 0 && (
            <Badge variant="outline" className="text-[10px]">
              {reservationCount} {t('votes.reservations')}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Main votes */}
        {mainVotes.map((v) => (
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

        {/* Reservations — collapsible list */}
        {reservationCount > 0 && (
          <details className="group">
            <summary className="text-muted-foreground hover:bg-muted/40 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium">
              {t('votes.reservations')} ({reservationCount})
              <span className="transition-transform group-open:rotate-90">
                ▸
              </span>
            </summary>
            <div className="border-muted mt-2 space-y-2 border-s-2 ps-3">
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
          </details>
        )}
      </CardContent>
    </Card>
  );
}
