'use client';

import { useTranslations } from 'next-intl';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface VoteTalliesBarProps {
  forCount: number;
  againstCount: number;
  abstainCount: number;
  isAccepted?: boolean | null;
  compact?: boolean;
}

export function VoteTalliesBar({
  forCount,
  againstCount,
  abstainCount,
  compact = false,
}: VoteTalliesBarProps) {
  const t = useTranslations('votes');
  const total = forCount + againstCount + abstainCount;
  if (total === 0) return null;

  const forPct = (forCount / total) * 100;
  const againstPct = (againstCount / total) * 100;
  const abstainPct = (abstainCount / total) * 100;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={<div className="w-full" />}>
          {!compact && (
            <div className="text-muted-foreground mb-1 flex justify-between text-xs tabular-nums">
              <span className="text-green-600 dark:text-green-400">
                {forCount} {t('for')}
              </span>
              <span className="text-red-600 dark:text-red-400">
                {againstCount} {t('against')}
              </span>
              {abstainCount > 0 && (
                <span className="text-yellow-600 dark:text-yellow-400">
                  {abstainCount} {t('abstain')}
                </span>
              )}
            </div>
          )}
          <div
            className={`flex w-full overflow-hidden rounded-full ${compact ? 'h-1.5' : 'h-2.5'}`}
            role="meter"
            aria-valuenow={forCount}
            aria-valuemin={0}
            aria-valuemax={total}
          >
            {forCount > 0 && (
              <div
                className="bg-green-500 transition-all dark:bg-green-600"
                style={{ width: `${forPct}%` }}
              />
            )}
            {againstCount > 0 && (
              <div
                className="bg-red-500 transition-all dark:bg-red-600"
                style={{ width: `${againstPct}%` }}
              />
            )}
            {abstainCount > 0 && (
              <div
                className="bg-yellow-500 transition-all dark:bg-yellow-600"
                style={{ width: `${abstainPct}%` }}
              />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="flex gap-3 text-xs font-medium">
            <span>
              <span className="font-semibold">{t('for')}:</span> {forCount}
            </span>
            <span>
              <span className="font-semibold">{t('against')}:</span>{' '}
              {againstCount}
            </span>
            <span>
              <span className="font-semibold">{t('abstain')}:</span>{' '}
              {abstainCount}
            </span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
