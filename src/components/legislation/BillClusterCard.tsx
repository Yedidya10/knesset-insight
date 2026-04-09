'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Layers, Vote, ArrowRight, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AIConfidenceBadge } from './AIConfidenceBadge';
import EntityActivityPopover from '@/components/admin/inline/EntityActivityPopover';

interface BillClusterCardProps {
  id: number;
  name: string;
  description?: string | null;
  category?: string | null;
  currentStage?: number | null;
  billType?: string | null;
  latestKnessetNum?: number | null;
  billCount: number;
  hasCrossTermBills?: boolean | null;
  aiProcessed?: boolean | null;
  aiConfidence?: number | null;
  latestUpdate?: string | Date | null;
  voteCount?: number;
}

export function BillClusterCard({
  id,
  name,
  description,
  category,
  billType,
  latestKnessetNum,
  billCount,
  hasCrossTermBills,
  aiProcessed,
  aiConfidence,
  latestUpdate,
  voteCount,
}: BillClusterCardProps) {
  const t = useTranslations('legislation');

  return (
    <div className="group relative">
      <Link href={`/legislation/laws/${id}`}>
        <Card className="glass-card hover-lift overflow-hidden transition-all">
        <div className="h-1 bg-gradient-to-r from-primary/40 via-chart-2/30 to-chart-4/30" />
        <CardContent className="p-4">
          {/* Title */}
          <h3 className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {name}
          </h3>

          {/* Description */}
          {description && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
              {description}
            </p>
          )}

          {/* Badges row */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {category && (
              <Badge variant="outline" className="text-[10px]">
                {t(`clusters.category.${category}` as any)}
              </Badge>
            )}
            {billType && (
              <Badge variant="secondary" className="text-[10px]">
                {billType}
              </Badge>
            )}
            {latestKnessetNum && (
              <Badge variant="outline" className="text-[10px]">
                {t('knessetNum', { num: latestKnessetNum })}
              </Badge>
            )}
            {hasCrossTermBills && (
              <Badge
                variant="outline"
                className="text-[10px] border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400"
              >
                <Calendar className="me-1 h-3 w-3" />
                {t('clusters.crossTerm')}
              </Badge>
            )}
            {aiProcessed && aiConfidence && (
              <AIConfidenceBadge confidence={aiConfidence} />
            )}
          </div>

          {/* Stats row */}
          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Layers className="h-3 w-3" />
              {t('clusters.billCount', { count: billCount })}
            </span>
            {voteCount != null && voteCount > 0 && (
              <span className="flex items-center gap-1">
                <Vote className="h-3 w-3" />
                {t('clusters.voteCount', { count: voteCount })}
              </span>
            )}
            <ArrowRight className="ms-auto h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-60" />
          </div>
        </CardContent>
      </Card>
    </Link>
    <div className="absolute top-2 inset-e-2 z-10">
      <EntityActivityPopover
        entityType="cluster"
        entityId={String(id)}
      />
    </div>
  </div>
  );
}
