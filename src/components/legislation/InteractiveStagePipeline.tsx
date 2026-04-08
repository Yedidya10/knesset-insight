'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, X, ChevronDown } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { StageVotePanel } from './StageVotePanel';
import { BillStage } from '@/lib/knesset/bill-stages';
import type { StageInfo, SpecialStatus } from '@/lib/knesset/bill-stages';

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

interface InteractiveStagePipelineProps {
  stages: StageInfo[];
  specialStatus: SpecialStatus;
  votes: StageVote[];
  stageKeyToIndex?: Record<string, number>;
}

const DEFAULT_STAGE_KEY_MAP: Record<string, number> = {
  submitted: BillStage.SUBMITTED,
  preliminary: BillStage.PRELIMINARY,
  committeeFirst: BillStage.COMMITTEE_FIRST,
  firstReading: BillStage.FIRST_READING,
  committeeSecond: BillStage.COMMITTEE_SECOND,
  secondThirdReading: BillStage.SECOND_THIRD_READING,
  passed: BillStage.PASSED,
};

export function InteractiveStagePipeline({
  stages,
  specialStatus,
  votes,
  stageKeyToIndex,
}: InteractiveStagePipelineProps) {
  const t = useTranslations('legislation.stages');

  const keyMap = stageKeyToIndex ?? DEFAULT_STAGE_KEY_MAP;

  const isTerminated =
    specialStatus === 'merged' ||
    specialStatus === 'stopped' ||
    specialStatus === 'converted' ||
    specialStatus === 'continuityRejected' ||
    specialStatus === 'removedFromAgenda';

  const allCompleted = stages.every((s) => s.status === 'completed');

  // Group votes by stage
  const votesByStage = new Map<string, StageVote[]>();
  const unassignedVotes: StageVote[] = [];
  for (const vote of votes) {
    if (vote.billStage == null) {
      unassignedVotes.push(vote);
      continue;
    }
    // Find which stage key matches this billStage value
    const stageKey = Object.entries(keyMap).find(
      ([, idx]) => idx === vote.billStage,
    )?.[0];
    if (stageKey) {
      if (!votesByStage.has(stageKey)) votesByStage.set(stageKey, []);
      votesByStage.get(stageKey)!.push(vote);
    } else {
      unassignedVotes.push(vote);
    }
  }

  // Assign untagged votes to the current (or latest completed) stage
  if (unassignedVotes.length > 0) {
    const currentStage = stages.find((s) => s.status === 'current');
    const latestCompleted = [...stages]
      .reverse()
      .find((s) => s.status === 'completed');
    const targetKey = currentStage?.key ?? latestCompleted?.key;
    if (targetKey) {
      if (!votesByStage.has(targetKey)) votesByStage.set(targetKey, []);
      votesByStage.get(targetKey)!.push(...unassignedVotes);
    }
  }

  // Default to the latest stage that has votes
  const defaultStage = (() => {
    for (let i = stages.length - 1; i >= 0; i--) {
      if (votesByStage.has(stages[i].key)) return stages[i].key;
    }
    return null;
  })();

  const [selectedStage, setSelectedStage] = useState<string | null>(
    defaultStage,
  );

  return (
    <div className="w-full">
      {/* Desktop: horizontal stepper */}
      <div className="hidden md:block">
        <div
          className="flex items-start"
          style={{ minWidth: stages.length * 130 }}
        >
          {stages.map((stage, idx) => {
            const isLast = idx === stages.length - 1;
            const stageVotes = votesByStage.get(stage.key) ?? [];
            const hasVotes = stageVotes.length > 0;

            return (
              <div
                key={stage.key}
                className={cn('flex flex-col', isLast ? 'shrink-0' : 'flex-1')}
              >
                <div className="flex items-start">
                  <InteractiveStageNode
                    stage={stage}
                    label={t(stage.key)}
                    stepNumber={idx + 1}
                    isTerminated={isTerminated}
                    allCompleted={allCompleted}
                    hasVotes={hasVotes}
                    isExpanded={selectedStage === stage.key}
                    onToggle={() => setSelectedStage(stage.key)}
                    voteResult={
                      hasVotes
                        ? stageVotes[0].isAccepted
                          ? 'accepted'
                          : 'rejected'
                        : undefined
                    }
                  />
                  {!isLast && (
                    <div className="flex flex-1 items-center pt-[18px]">
                      <div
                        className={cn(
                          'h-[3px] w-full rounded-full',
                          stage.status === 'completed' &&
                            (allCompleted
                              ? 'bg-emerald-500 dark:bg-emerald-400'
                              : 'bg-emerald-400/50 dark:bg-emerald-500/40'),
                          stage.status === 'current' &&
                            !isTerminated &&
                            'bg-primary/25',
                          stage.status === 'current' &&
                            isTerminated &&
                            'bg-destructive/25',
                          stage.status === 'upcoming' && 'bg-muted',
                        )}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Expanded vote panel below pipeline */}
        {selectedStage && votesByStage.has(selectedStage) && (
          <div className="mt-4">
            <StageVotePanel
              stageName={t(selectedStage)}
              votes={votesByStage.get(selectedStage)!}
            />
          </div>
        )}
      </div>

      {/* Mobile: vertical stepper with inline vote panels */}
      <div className="md:hidden">
        <div className="flex flex-col">
          {stages.map((stage, idx) => {
            const isLast = idx === stages.length - 1;
            const stageVotes = votesByStage.get(stage.key) ?? [];
            const hasVotes = stageVotes.length > 0;

            return (
              <Collapsible
                key={stage.key}
                open={selectedStage === stage.key}
                onOpenChange={(open) =>
                  setSelectedStage(open ? stage.key : null)
                }
              >
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <StageCircle
                      stage={stage}
                      isTerminated={isTerminated}
                      allCompleted={allCompleted}
                      hasVotes={hasVotes}
                    />
                    {!isLast && (
                      <div
                        className={cn(
                          'min-h-8 w-[3px] flex-1 rounded-full',
                          stage.status === 'completed' &&
                            (allCompleted
                              ? 'bg-emerald-500 dark:bg-emerald-400'
                              : 'bg-emerald-400/50 dark:bg-emerald-500/40'),
                          stage.status === 'current' &&
                            !isTerminated &&
                            'bg-primary/25',
                          stage.status === 'current' &&
                            isTerminated &&
                            'bg-destructive/25',
                          stage.status === 'upcoming' && 'bg-muted',
                        )}
                      />
                    )}
                  </div>
                  <div className={cn('flex-1 pt-2 pb-5', isLast && 'pb-0')}>
                    <CollapsibleTrigger
                      className="flex w-full items-center justify-between"
                      disabled={!hasVotes}
                    >
                      <div>
                        <p className="text-muted-foreground text-[11px] font-medium">
                          {t('step', { num: idx + 1 })}
                        </p>
                        <p
                          className={cn(
                            'text-sm leading-snug font-semibold',
                            stage.status === 'completed' && 'text-foreground',
                            stage.status === 'current' &&
                              !isTerminated &&
                              'text-primary',
                            stage.status === 'current' &&
                              isTerminated &&
                              'text-destructive line-through',
                            stage.status === 'upcoming' &&
                              (isTerminated
                                ? 'text-muted-foreground/30 line-through'
                                : 'text-muted-foreground/60'),
                          )}
                        >
                          {t(stage.key)}
                        </p>
                      </div>
                      {hasVotes && (
                        <ChevronDown
                          className={cn(
                            'text-muted-foreground h-4 w-4 transition-transform',
                            selectedStage === stage.key && 'rotate-180',
                          )}
                        />
                      )}
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <StageVotePanel
                        stageName={t(stage.key)}
                        votes={stageVotes}
                      />
                    </CollapsibleContent>
                  </div>
                </div>
              </Collapsible>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Stage Circle ────────────────────────────────────────────────

function StageCircle({
  stage,
  isTerminated,
  allCompleted,
  hasVotes,
}: {
  stage: StageInfo;
  isTerminated: boolean;
  allCompleted: boolean;
  hasVotes: boolean;
}) {
  const { status } = stage;

  if (status === 'completed') {
    return (
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-sm',
          allCompleted
            ? 'bg-emerald-500 text-white shadow-emerald-500/25'
            : 'bg-emerald-500/90 text-white shadow-emerald-500/20',
          hasVotes && 'ring-primary/30 ring-2',
        )}
      >
        <Check className="h-5 w-5" strokeWidth={3} />
      </div>
    );
  }

  if (status === 'current' && !isTerminated) {
    return (
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
        <span className="bg-primary/10 absolute h-10 w-10 animate-[pulse_2.5s_ease-in-out_infinite] rounded-full" />
        <div className="border-primary/80 bg-background shadow-primary/20 dark:bg-muted relative h-10 w-10 rounded-full border-[3px] shadow-sm" />
        <div className="bg-primary absolute h-4 w-4 rounded-full" />
      </div>
    );
  }

  if (status === 'current' && isTerminated) {
    return (
      <div className="bg-destructive/10 ring-destructive/30 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-2">
        <X className="text-destructive h-5 w-5" strokeWidth={3} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[3px]',
        isTerminated
          ? 'border-muted-foreground/15 bg-muted/20'
          : 'border-muted bg-muted/30 dark:border-muted dark:bg-muted/20',
      )}
    >
      <div
        className={cn(
          'h-2 w-2 rounded-full',
          isTerminated ? 'bg-muted-foreground/15' : 'bg-muted-foreground/30',
        )}
      />
    </div>
  );
}

// ── Interactive Stage Node (desktop) ────────────────────────────

function InteractiveStageNode({
  stage,
  label,
  stepNumber,
  isTerminated,
  allCompleted,
  hasVotes,
  isExpanded,
  onToggle,
  voteResult,
}: {
  stage: StageInfo;
  label: string;
  stepNumber: number;
  isTerminated: boolean;
  allCompleted: boolean;
  hasVotes: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  voteResult?: 'accepted' | 'rejected';
}) {
  const t = useTranslations('legislation.stages');
  const { status } = stage;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              onClick={hasVotes ? onToggle : undefined}
              className={cn(
                'flex w-[120px] shrink-0 flex-col items-center gap-2.5 transition-opacity',
                hasVotes ? 'cursor-pointer hover:opacity-80' : 'cursor-default',
                isExpanded && 'opacity-100',
              )}
              aria-expanded={isExpanded}
              disabled={!hasVotes}
            />
          }
        >
          <StageCircle
            stage={stage}
            isTerminated={isTerminated}
            allCompleted={allCompleted}
            hasVotes={hasVotes}
          />
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-muted-foreground/70 text-[10px] font-medium tracking-wide uppercase">
              {t('step', { num: stepNumber })}
            </span>
            <span
              className={cn(
                'max-w-[108px] text-center text-xs leading-tight font-semibold',
                status === 'completed' && 'text-foreground',
                status === 'current' && !isTerminated && 'text-primary',
                status === 'current' &&
                  isTerminated &&
                  'text-destructive line-through',
                status === 'upcoming' &&
                  (isTerminated
                    ? 'text-muted-foreground/25 line-through'
                    : 'text-muted-foreground/60'),
              )}
            >
              {label}
            </span>
            {hasVotes && voteResult && (
              <span
                className={cn(
                  'mt-0.5 text-[10px] font-medium',
                  voteResult === 'accepted'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400',
                )}
              >
                {voteResult === 'accepted' ? '✓' : '✗'}
              </span>
            )}
            {hasVotes && (
              <ChevronDown
                className={cn(
                  'text-muted-foreground h-3 w-3 transition-transform',
                  isExpanded && 'rotate-180',
                )}
              />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {label} —{' '}
          {status === 'completed'
            ? t('completed')
            : status === 'current'
              ? t('current')
              : t('upcoming')}
          {hasVotes && ` (${voteResult === 'accepted' ? '✓' : '✗'})`}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
