'use client';

import { useTranslations } from 'next-intl';
import { Check, X } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { StageInfo, SpecialStatus } from '@/lib/knesset/bill-stages';

interface BillStagePipelineProps {
  stages: StageInfo[];
  specialStatus: SpecialStatus;
}

export function BillStagePipeline({
  stages,
  specialStatus,
}: BillStagePipelineProps) {
  const t = useTranslations('legislation.stages');

  const isTerminated =
    specialStatus === 'merged' ||
    specialStatus === 'stopped' ||
    specialStatus === 'converted' ||
    specialStatus === 'continuityRejected' ||
    specialStatus === 'removedFromAgenda';

  const allCompleted = stages.every((s) => s.status === 'completed');

  return (
    <div
      role="progressbar"
      aria-valuenow={stages.findIndex((s) => s.status === 'current') + 1}
      aria-valuemin={0}
      aria-valuemax={stages.length}
      className="w-full overflow-x-auto"
    >
      {/* Desktop: horizontal stepper */}
      <div className="hidden overflow-x-auto md:block">
        <div
          className="flex items-start"
          style={{ minWidth: stages.length * 120 }}
        >
          {stages.map((stage, idx) => {
            const isLast = idx === stages.length - 1;
            return (
              <div
                key={stage.key}
                className={cn(
                  'flex items-start',
                  isLast ? 'shrink-0' : 'flex-1',
                )}
              >
                {/* Node */}
                <StageNode
                  stage={stage}
                  label={t(stage.key)}
                  stepNumber={idx + 1}
                  isTerminated={isTerminated}
                  allCompleted={allCompleted}
                />
                {/* Connector */}
                {!isLast && (
                  <StageConnector
                    from={stage.status}
                    to={stages[idx + 1].status}
                    isTerminated={isTerminated}
                    allCompleted={allCompleted}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile: vertical stepper */}
      <div className="md:hidden">
        <div className="flex flex-col">
          {stages.map((stage, idx) => {
            const isLast = idx === stages.length - 1;
            return (
              <div key={stage.key} className="flex gap-4">
                {/* Rail */}
                <div className="flex flex-col items-center">
                  <StageCircle
                    stage={stage}
                    isTerminated={isTerminated}
                    allCompleted={allCompleted}
                  />
                  {!isLast && (
                    <div
                      className={cn(
                        'min-h-8 w-0.75 flex-1 rounded-full',
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
                {/* Label */}
                <div className={cn('pt-2 pb-5', isLast && 'pb-0')}>
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
              </div>
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
  size = 'md',
}: {
  stage: StageInfo;
  isTerminated: boolean;
  allCompleted: boolean;
  size?: 'sm' | 'md';
}) {
  const { status } = stage;
  const dim = size === 'sm' ? 'h-9 w-9' : 'h-10 w-10';
  const iconDim = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';

  if (status === 'completed') {
    return (
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full shadow-sm',
          dim,
          allCompleted
            ? 'bg-emerald-500 text-white shadow-emerald-500/25 dark:bg-emerald-500 dark:shadow-emerald-400/20'
            : 'bg-emerald-500/90 text-white shadow-emerald-500/20 dark:bg-emerald-500/80',
        )}
      >
        <Check className={iconDim} strokeWidth={3} />
      </div>
    );
  }

  if (status === 'current' && !isTerminated) {
    const outerRing = size === 'sm' ? 'h-9 w-9' : 'h-10 w-10';
    const innerDot = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
    return (
      <div
        className={cn(
          'relative flex shrink-0 items-center justify-center',
          outerRing,
        )}
      >
        <span
          className={cn(
            'bg-primary/10 absolute animate-[pulse_2.5s_ease-in-out_infinite] rounded-full',
            outerRing,
          )}
        />
        <div
          className={cn(
            'border-primary/80 bg-background shadow-primary/20 dark:bg-muted relative rounded-full border-[3px] shadow-sm',
            outerRing,
          )}
        />
        <div className={cn('bg-primary absolute rounded-full', innerDot)} />
      </div>
    );
  }

  if (status === 'current' && isTerminated) {
    return (
      <div
        className={cn(
          'bg-destructive/10 ring-destructive/30 flex shrink-0 items-center justify-center rounded-full shadow-sm ring-2',
          dim,
        )}
      >
        <X className={cn(iconDim, 'text-destructive')} strokeWidth={3} />
      </div>
    );
  }

  // upcoming
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full border-[3px]',
        dim,
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

// ── Stage Node (desktop) ────────────────────────────────────────

interface StageNodeProps {
  stage: StageInfo;
  label: string;
  stepNumber: number;
  isTerminated: boolean;
  allCompleted: boolean;
}

function StageNode({
  stage,
  label,
  stepNumber,
  isTerminated,
  allCompleted,
}: StageNodeProps) {
  const t = useTranslations('legislation.stages');
  const { status } = stage;

  const ariaLabel = `${label} — ${
    status === 'completed'
      ? t('completed')
      : status === 'current'
        ? t('current')
        : t('upcoming')
  }`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <div
              className="flex w-25 shrink-0 flex-col items-center gap-2.5"
              aria-label={ariaLabel}
            />
          }
        >
          <StageCircle
            stage={stage}
            isTerminated={isTerminated}
            allCompleted={allCompleted}
            size="sm"
          />
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-muted-foreground/70 text-[10px] font-medium tracking-wide uppercase">
              {t('step', { num: stepNumber })}
            </span>
            <span
              className={cn(
                'max-w-24 text-center text-xs leading-tight font-semibold',
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
          </div>
        </TooltipTrigger>
        <TooltipContent>{ariaLabel}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ── Stage Connector ─────────────────────────────────────────────

interface StageConnectorProps {
  from: StageInfo['status'];
  to: StageInfo['status'];
  isTerminated: boolean;
  allCompleted: boolean;
}

function StageConnector({
  from,
  to,
  isTerminated,
  allCompleted,
}: StageConnectorProps) {
  const filled =
    from === 'completed' && (to === 'completed' || to === 'current');

  return (
    <div className="flex flex-1 items-center pt-4.5">
      <div
        className={cn(
          'h-0.75 w-full rounded-full',
          filled &&
            !isTerminated &&
            allCompleted &&
            'bg-emerald-500 dark:bg-emerald-400',
          filled &&
            !isTerminated &&
            !allCompleted &&
            'bg-emerald-400/50 dark:bg-emerald-500/40',
          filled && isTerminated && 'bg-destructive/25',
          !filled && 'bg-muted',
        )}
      />
    </div>
  );
}
