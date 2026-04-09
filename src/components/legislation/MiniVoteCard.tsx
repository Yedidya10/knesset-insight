'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { VoteTalliesBar } from './VoteTalliesBar';
import { InlineVoteDetail } from './InlineVoteDetail';

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
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="bg-muted/20 hover:bg-muted/40 rounded-lg border transition-colors">
        <CollapsibleTrigger
          render={<button className="w-full cursor-pointer p-3 text-start" />}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{title}</p>
              <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
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
            <ChevronDown
              className={`text-muted-foreground h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
            />
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
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t px-3 pb-3">
            <InlineVoteDetail voteId={id} />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
