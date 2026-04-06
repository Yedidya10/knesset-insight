'use client';

import { useTranslations } from 'next-intl';
import {
  AlertTriangle,
  Info,
  AlertCircle,
  XCircle,
  ExternalLink,
  Calendar,
  FileText,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface IntegrityCase {
  id: number;
  category: string;
  severity: string;
  status: string;
  title: string;
  titleEn: string | null;
  description: string | null;
  sourceType: string;
  sourceName: string;
  sourceUrl: string | null;
  eventDate: string;
  resolutionDate: string | null;
  decision: string | null;
  sanctionType: string | null;
  aiSummary: string | null;
  verified: boolean | null;
}

interface IntegrityCaseCardProps {
  case_: IntegrityCase;
}

const severityConfig = {
  info: { icon: Info, color: 'text-blue-600 dark:text-blue-400', border: 'border-s-blue-500' },
  warning: { icon: AlertTriangle, color: 'text-yellow-600 dark:text-yellow-400', border: 'border-s-yellow-500' },
  serious: { icon: AlertCircle, color: 'text-orange-600 dark:text-orange-400', border: 'border-s-orange-500' },
  critical: { icon: XCircle, color: 'text-red-600 dark:text-red-400', border: 'border-s-red-500' },
} as const;

const statusVariant: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  reported: 'outline',
  under_investigation: 'secondary',
  decided: 'default',
  appealed: 'secondary',
  closed: 'outline',
  convicted: 'destructive',
  acquitted: 'default',
  sanctions_applied: 'destructive',
};

export default function IntegrityCaseCard({ case_ }: IntegrityCaseCardProps) {
  const t = useTranslations('integrity');

  const config = severityConfig[case_.severity as keyof typeof severityConfig] ?? severityConfig.info;
  const Icon = config.icon;

  return (
    <Card className={`glass-card border-s-4 ${config.border}`}>
      <CardContent className="space-y-3 py-4">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${config.color}`} />
          <div className="min-w-0 flex-1">
            <h4 className="font-medium leading-tight">{case_.title}</h4>
            {case_.description && (
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                {case_.description}
              </p>
            )}
          </div>
        </div>

        {/* Metadata badges */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-1 text-xs">
            <FileText className="h-3 w-3" />
            {t(`categories.${case_.category}`)}
          </Badge>
          <Badge variant={statusVariant[case_.status] ?? 'outline'} className="text-xs">
            {t(`statuses.${case_.status}`)}
          </Badge>
          {case_.sanctionType && (
            <Badge variant="destructive" className="text-xs">
              {t(`sanctions.${case_.sanctionType}`)}
            </Badge>
          )}
          {case_.verified && (
            <Badge variant="default" className="text-xs">
              {t('verified')}
            </Badge>
          )}
        </div>

        {/* Date & source */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(case_.eventDate).toLocaleDateString('he-IL')}
          </span>
          <span>{case_.sourceName}</span>
          {case_.sourceUrl && (
            <a
              href={case_.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-primary hover:underline"
            >
              {t('viewSource')}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        {/* AI Summary */}
        {case_.aiSummary && (
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <p className="text-xs font-semibold text-muted-foreground mb-1">
              {t('aiSummary')}
            </p>
            <p>{case_.aiSummary}</p>
          </div>
        )}

        {/* Decision */}
        {case_.decision && (
          <div className="border-t pt-2">
            <p className="text-sm">
              <span className="font-semibold">{t('decision')}:</span>{' '}
              {case_.decision}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
