'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ChevronDown, Pencil, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { VoteTalliesBar } from './VoteTalliesBar';
import { InlineVoteDetail } from './InlineVoteDetail';
import { useAdminEdit } from '@/components/admin/AdminEditProvider';
import VoteBillLinker from '@/components/admin/inline/VoteBillLinker';
import VoteStageReassign from '@/components/admin/inline/VoteStageReassign';

interface MiniVoteCardProps {
  id: number;
  title: string;
  voteDate: string | Date | null;
  forCount: number;
  againstCount: number;
  abstainCount: number;
  isAccepted: boolean | null;
  billStage?: number | null;
  billId?: number;
}

export function MiniVoteCard({
  id,
  title,
  voteDate,
  forCount,
  againstCount,
  abstainCount,
  isAccepted,
  billStage,
  billId,
}: MiniVoteCardProps) {
  const t = useTranslations('legislation');
  const tVotes = useTranslations('votes.detail');
  const tAdmin = useTranslations('admin.inline');
  const [open, setOpen] = useState(false);
  const { isAdmin } = useAdminEdit();

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
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 w-full gap-1.5 text-xs"
              render={<Link href={`/votes/${id}`} />}
            >
              <ExternalLink className="h-3 w-3" />
              {tVotes('viewFullVote')}
            </Button>
          </div>
        </CollapsibleContent>

        {/* Admin actions */}
        {isAdmin && (
          <div className="flex gap-2 border-t px-3 py-2">
            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 text-[11px]"
                  >
                    <Pencil className="h-3 w-3" />
                    {tAdmin('relinkVote')}
                  </Button>
                }
              />
              <PopoverContent side="bottom" className="w-72">
                <VoteBillLinker voteId={id} currentBillId={billId ?? null} />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 text-[11px]"
                  >
                    <Pencil className="h-3 w-3" />
                    {tAdmin('reassignVoteStage')}
                  </Button>
                }
              />
              <PopoverContent side="bottom" className="w-72">
                <VoteStageReassign
                  voteId={id}
                  currentStage={billStage ?? null}
                />
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>
    </Collapsible>
  );
}
