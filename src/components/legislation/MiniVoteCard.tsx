'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { VoteTalliesBar } from './VoteTalliesBar';

interface MiniVoteCardProps {
  id: number;
  title: string;
  voteDate: string | Date | null;
  forCount: number;
  againstCount: number;
  abstainCount: number;
  isAccepted: boolean | null;
  billStage?: number | null;
}

export function MiniVoteCard({
  id,
  title,
  voteDate,
  forCount,
  againstCount,
  abstainCount,
  isAccepted,
}: MiniVoteCardProps) {
  const t = useTranslations('legislation');

  return (
    <div className="rounded-lg border bg-muted/20 p-3 transition-colors hover:bg-muted/40">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{title}</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            {voteDate && (
              <span>{new Date(voteDate).toLocaleDateString()}</span>
            )}
            <Badge
              variant={isAccepted ? 'default' : 'destructive'}
              className="text-[10px]"
            >
              {isAccepted ? t('accepted') : t('rejected')}
            </Badge>
          </div>
        </div>
        <Link
          href={`/votes/${id}`}
          className="shrink-0 text-muted-foreground hover:text-primary"
          aria-label={t('votes.viewFullVote')}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="mt-2">
        <VoteTalliesBar
          forCount={forCount}
          againstCount={againstCount}
          abstainCount={abstainCount}
          isAccepted={isAccepted}
          compact
        />
      </div>
    </div>
  );
}
