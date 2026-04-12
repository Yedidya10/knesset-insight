'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, FileText, Users, GitMerge, GitBranch, Pause, ArrowLeftRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BillStagePipeline } from './BillStagePipeline';
import { MiniVoteCard } from './MiniVoteCard';
import { AIConfidenceBadge } from './AIConfidenceBadge';
import EntityActivityPopover from '@/components/admin/inline/EntityActivityPopover';
import type { StageInfo, SpecialStatus } from '@/lib/knesset/bill-stages';

interface BillVote {
  id: number;
  title: string;
  voteDate: string | Date | null;
  forCount: number;
  againstCount: number;
  abstainCount: number;
  isAccepted: boolean | null;
  billStage?: number | null;
}

interface BillInClusterCardProps {
  id: number;
  name: string;
  knessetNum: number | null;
  proposedDate: string | null;
  stages: StageInfo[];
  specialStatus: SpecialStatus;
  votes: BillVote[];
  isPrimary: boolean;
  relationshipType: string;
  confidence: number | null;
  aiReasoning?: string | null;
  initiators?: { firstName: string | null; lastName: string | null; isPrimary: boolean }[];
}

export function BillInClusterCard({
  id,
  name,
  knessetNum,
  proposedDate,
  stages,
  specialStatus,
  votes,
  isPrimary,
  relationshipType,
  confidence,
  aiReasoning,
  initiators,
}: BillInClusterCardProps) {
  const [isOpen, setIsOpen] = useState(isPrimary);
  const t = useTranslations('legislation');

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card
        className={cn(
          'group overflow-hidden transition-all',
          isPrimary && 'ring-2 ring-primary/30',
        )}
      >
        <div className="relative">
          <CollapsibleTrigger render={<CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors pb-3" />}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-sm font-semibold leading-snug line-clamp-2">
                    {name}
                  </CardTitle>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {isPrimary && (
                      <Badge variant="default" className="text-[10px]">
                        {t('primaryInitiator')}
                      </Badge>
                    )}
                    {knessetNum && (
                      <Badge variant="outline" className="text-[10px]">
                        {t('knessetNum', { num: knessetNum })}
                      </Badge>
                    )}
                    {proposedDate && (
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(proposedDate).toLocaleDateString()}
                      </span>
                    )}
                    {relationshipType === 'ai' && (
                      <AIConfidenceBadge
                        confidence={confidence}
                        reasoning={aiReasoning}
                      />
                    )}
                    {specialStatus === 'merged' && (
                      <Badge variant="outline" className="gap-0.5 border-violet-300 text-[10px] text-violet-700 dark:border-violet-700 dark:text-violet-300">
                        <GitMerge className="h-2.5 w-2.5" />
                        {t('special.merged')}
                      </Badge>
                    )}
                    {specialStatus === 'split' && (
                      <Badge variant="outline" className="gap-0.5 border-sky-300 text-[10px] text-sky-700 dark:border-sky-700 dark:text-sky-300">
                        <GitBranch className="h-2.5 w-2.5" />
                        {t('special.split')}
                      </Badge>
                    )}
                    {specialStatus === 'stopped' && (
                      <Badge variant="outline" className="gap-0.5 border-amber-300 text-[10px] text-amber-700 dark:border-amber-700 dark:text-amber-300">
                        <Pause className="h-2.5 w-2.5" />
                        {t('special.stopped')}
                      </Badge>
                    )}
                    {specialStatus === 'converted' && (
                      <Badge variant="outline" className="gap-0.5 border-teal-300 text-[10px] text-teal-700 dark:border-teal-700 dark:text-teal-300">
                        <ArrowLeftRight className="h-2.5 w-2.5" />
                        {t('special.converted')}
                      </Badge>
                    )}
                    {votes.length > 0 && (
                      <Badge variant="secondary" className="text-[10px]">
                        {t('clusters.voteCount', { count: votes.length })}
                      </Badge>
                    )}
                  </div>
                </div>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                    isOpen && 'rotate-180',
                  )}
                />
              </div>
          </CollapsibleTrigger>
          <div className="absolute top-2 inset-e-8 z-10">
            <EntityActivityPopover
              entityType="bill"
              entityId={String(id)}
            />
          </div>
        </div>

        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* Stage pipeline */}
            <BillStagePipeline stages={stages} specialStatus={specialStatus} />

            {/* Initiators */}
            {initiators && initiators.length > 0 && (
              <div>
                <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Users className="h-3 w-3" />
                  {t('initiators')}
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {initiators.slice(0, 5).map((init, i) => (
                    <Badge key={i} variant="outline" className="text-[10px]">
                      {init.firstName} {init.lastName}
                    </Badge>
                  ))}
                  {initiators.length > 5 && (
                    <Badge variant="outline" className="text-[10px]">
                      +{initiators.length - 5}
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Votes for this bill */}
            {votes.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground">
                  {t('relatedVotes')}
                </h4>
                {votes.map((v) => (
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

            {/* Link to full bill detail page */}
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" render={<Link href={`/legislation/${id}`} className="gap-1.5 text-xs" />}>
                  <FileText className="h-3 w-3" />
                  {t('viewOnKnesset')}
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
