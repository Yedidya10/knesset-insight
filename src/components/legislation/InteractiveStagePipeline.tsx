'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Check,
  X,
  ChevronDown,
  Pencil,
  GitMerge,
  GitBranch,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { StageVotePanel } from './StageVotePanel';
import { BillStage } from '@/lib/knesset/bill-stages';
import type { StageInfo, SpecialStatus } from '@/lib/knesset/bill-stages';
import { useAdminEdit } from '@/components/admin/AdminEditProvider';
import BillStageOverride from '@/components/admin/inline/BillStageOverride';

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

export interface RelationshipEvent {
  type: 'mergedInto' | 'splitFrom' | 'splitInto' | 'mergedFrom';
  billId: number;
  billName: string | null;
  date: string | null;
}

interface InteractiveStagePipelineProps {
  stages: StageInfo[];
  specialStatus: SpecialStatus;
  votes: StageVote[];
  relationshipEvents?: RelationshipEvent[];
  stageKeyToIndex?: Record<string, number>;
  billId?: number;
  currentStatusId?: string | null;
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
  relationshipEvents,
  stageKeyToIndex,
  billId,
  currentStatusId,
}: InteractiveStagePipelineProps) {
  const t = useTranslations('legislation.stages');
  const tLeg = useTranslations('legislation');
  const { isAdmin } = useAdminEdit();

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

  // Assign untagged votes to the latest non-PASSED completed stage.
  // Stage assignment is done in the pipeline using synced data
  // (bill_names, vote dates, bill status). The client trusts the DB.
  if (unassignedVotes.length > 0) {
    // Find the latest completed stage that isn't PASSED (for voting context)
    const currentStage = stages.find((s) => s.status === 'current');
    const latestVotingStage = [...stages]
      .reverse()
      .find((s) => s.status === 'completed' && s.stage !== BillStage.PASSED);
    const latestCompleted = [...stages]
      .reverse()
      .find((s) => s.status === 'completed');
    const targetKey =
      currentStage?.key ?? latestVotingStage?.key ?? latestCompleted?.key;
    if (targetKey) {
      if (!votesByStage.has(targetKey)) votesByStage.set(targetKey, []);
      votesByStage.get(targetKey)!.push(...unassignedVotes);
    }
  }

  // Place relationship events at correct legislative stage
  // Splits and merges happen during COMMITTEE_SECOND (committee preparation
  // for 2nd+3rd reading) per Knesset regulations.
  const eventsByStage = new Map<string, RelationshipEvent[]>();
  if (relationshipEvents && relationshipEvents.length > 0) {
    const stageKeys = new Set(stages.map((s) => s.key));
    for (const event of relationshipEvents) {
      // Determine correct stage for each event type
      let targetKey: string | undefined;
      if (event.type === 'splitInto' || event.type === 'mergedFrom') {
        // Parent bill: committee splits/absorbs during committeeSecond
        targetKey = stageKeys.has('committeeSecond')
          ? 'committeeSecond'
          : undefined;
      } else if (event.type === 'mergedInto') {
        // Child bill merged back: termination at committeeSecond
        targetKey = stageKeys.has('committeeSecond')
          ? 'committeeSecond'
          : undefined;
      } else if (event.type === 'splitFrom') {
        // Child bill born from split: origin at committeeSecond (parent's committee work)
        targetKey = stageKeys.has('committeeSecond')
          ? 'committeeSecond'
          : undefined;
      }
      // Fallback to current/latest stage if committeeSecond isn't in this pipeline
      if (!targetKey) {
        const currentStageKey = stages.find((s) => s.status === 'current')?.key;
        const latestCompletedKey = [...stages]
          .reverse()
          .find((s) => s.status === 'completed')?.key;
        targetKey = currentStageKey ?? latestCompletedKey;
      }
      if (targetKey) {
        if (!eventsByStage.has(targetKey)) eventsByStage.set(targetKey, []);
        eventsByStage.get(targetKey)!.push(event);
      }
    }
  }

  // Default to the latest stage that has votes or events
  const defaultStage = (() => {
    for (let i = stages.length - 1; i >= 0; i--) {
      const key = stages[i].key;
      if (votesByStage.has(key) || eventsByStage.has(key)) return key;
    }
    return null;
  })();

  const [selectedStage, setSelectedStage] = useState<string | null>(
    defaultStage,
  );

  return (
    <div className="w-full">
      {/* Admin stage override */}
      {isAdmin && billId && (
        <div className="mb-3 flex justify-end">
          <Popover>
            <PopoverTrigger
              render={
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <Pencil className="h-3 w-3" />
                  {t('adminOverrideStage')}
                </Button>
              }
            />
            <PopoverContent side="bottom" align="end" className="w-80">
              <BillStageOverride
                billId={billId}
                currentStatusId={currentStatusId ?? null}
              />
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Desktop: horizontal stepper */}
      <div className="hidden md:block">
        <div
          className="flex items-start"
          style={{ minWidth: stages.length * 130 }}
        >
          {stages.map((stage, idx) => {
            const isLast = idx === stages.length - 1;
            const stageVotes = votesByStage.get(stage.key) ?? [];
            const stageEvents = eventsByStage.get(stage.key) ?? [];
            const hasVotes = stageVotes.length > 0;
            const hasContent = hasVotes || stageEvents.length > 0;

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
                    hasVotes={hasContent}
                    isExpanded={selectedStage === stage.key}
                    onToggle={() => setSelectedStage(stage.key)}
                    voteResult={
                      hasVotes
                        ? stageVotes[0].isAccepted
                          ? 'accepted'
                          : 'rejected'
                        : undefined
                    }
                    hasRelationshipEvents={stageEvents.length > 0}
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

        {/* Expanded panel below pipeline — votes + relationship events */}
        {selectedStage &&
          (votesByStage.has(selectedStage) ||
            eventsByStage.has(selectedStage)) && (
            <div className="mt-4 space-y-3">
              {eventsByStage.has(selectedStage) && (
                <RelationshipEventsPanel
                  events={eventsByStage.get(selectedStage)!}
                />
              )}
              {votesByStage.has(selectedStage) && (
                <StageVotePanel
                  stageName={t(selectedStage)}
                  votes={votesByStage.get(selectedStage)!}
                  billId={billId}
                />
              )}
            </div>
          )}
      </div>

      {/* Mobile: vertical stepper with inline vote panels */}
      <div className="md:hidden">
        <div className="flex flex-col">
          {stages.map((stage, idx) => {
            const isLast = idx === stages.length - 1;
            const stageVotes = votesByStage.get(stage.key) ?? [];
            const stageEvents = eventsByStage.get(stage.key) ?? [];
            const hasVotes = stageVotes.length > 0;
            const hasContent = hasVotes || stageEvents.length > 0;

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
                      hasVotes={hasContent}
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
                      disabled={!hasContent}
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
                      {hasContent && (
                        <ChevronDown
                          className={cn(
                            'text-muted-foreground h-4 w-4 transition-transform',
                            selectedStage === stage.key && 'rotate-180',
                          )}
                        />
                      )}
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 space-y-3">
                      {stageEvents.length > 0 && (
                        <RelationshipEventsPanel events={stageEvents} />
                      )}
                      {hasVotes && (
                        <StageVotePanel
                          stageName={t(stage.key)}
                          votes={stageVotes}
                          billId={billId}
                        />
                      )}
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
  hasRelationshipEvents,
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
  hasRelationshipEvents?: boolean;
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
            {hasRelationshipEvents && (
              <div className="mt-0.5 flex items-center gap-0.5">
                <GitMerge className="h-2.5 w-2.5 text-violet-500" />
                <GitBranch className="h-2.5 w-2.5 text-sky-500" />
              </div>
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

// ── Relationship Events Panel ───────────────────────────────────

function RelationshipEventsPanel({ events }: { events: RelationshipEvent[] }) {
  const t = useTranslations('legislation.special');

  const typeConfig: Record<
    RelationshipEvent['type'],
    { icon: typeof GitMerge; label: string; color: string }
  > = {
    mergedInto: {
      icon: GitMerge,
      label: t('mergedWith'),
      color: 'text-violet-600 dark:text-violet-400',
    },
    mergedFrom: {
      icon: GitMerge,
      label: t('includesMerge'),
      color: 'text-violet-600 dark:text-violet-400',
    },
    splitFrom: {
      icon: GitBranch,
      label: t('splitFrom'),
      color: 'text-sky-600 dark:text-sky-400',
    },
    splitInto: {
      icon: GitBranch,
      label: t('splitInto'),
      color: 'text-sky-600 dark:text-sky-400',
    },
  };

  // Sort by date
  const sorted = [...events].sort(
    (a, b) => new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime(),
  );

  return (
    <div className="bg-muted/10 rounded-lg border-s-4 border-s-violet-400/50 p-3">
      <div className="space-y-2">
        {sorted.map((event, idx) => {
          const cfg = typeConfig[event.type];
          const Icon = cfg.icon;
          return (
            <div
              key={`${event.type}-${event.billId}-${idx}`}
              className="flex items-start gap-2"
            >
              <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', cfg.color)} />
              <div className="min-w-0 flex-1">
                <span className={cn('text-xs font-medium', cfg.color)}>
                  {cfg.label}
                </span>
                <Link
                  href={`/legislation/${event.billId}`}
                  className="text-primary mt-0.5 block truncate text-sm underline-offset-2 hover:underline"
                >
                  {event.billName ?? `#${event.billId}`}
                </Link>
              </div>
              {event.date && (
                <span className="text-muted-foreground shrink-0 pt-0.5 text-[10px]">
                  {new Date(event.date).toLocaleDateString('he-IL')}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
