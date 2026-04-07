'use client';

import { useTranslations } from 'next-intl';
import { Bot } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface AIConfidenceBadgeProps {
  confidence: number | null;
  reasoning?: string | null;
}

export function AIConfidenceBadge({ confidence, reasoning }: AIConfidenceBadgeProps) {
  const t = useTranslations('legislation.clusters');

  if (!confidence) return null;

  const percent = Math.round(confidence * 100);
  const variant = confidence >= 0.8 ? 'default' : confidence >= 0.6 ? 'secondary' : 'outline';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={<Badge variant={variant} className="gap-1 text-[10px]" />}>
            <Bot className="h-3 w-3" />
            {t('aiConfidence', { percent })}
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-xs font-medium">{t('aiMatched')}</p>
          {reasoning && (
            <p className="mt-1 text-xs text-muted-foreground">{reasoning}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
