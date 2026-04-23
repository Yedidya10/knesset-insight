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
  Eye,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import DocumentViewerDialog from './DocumentViewerDialog';

interface IntegrityDocument {
  id: number;
  title: string;
  docType: string;
  url: string | null;
  storagePath: string | null;
  publishedAt: string | null;
}

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
  /** Official documents attached by admin */
  documents?: IntegrityDocument[];
}

interface IntegrityCaseCardProps {
  case_: IntegrityCase;
}

const severityConfig = {
  info: {
    icon: Info,
    color: 'text-blue-600 dark:text-blue-400',
    border: 'border-s-blue-500',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-yellow-600 dark:text-yellow-400',
    border: 'border-s-yellow-500',
  },
  serious: {
    icon: AlertCircle,
    color: 'text-orange-600 dark:text-orange-400',
    border: 'border-s-orange-500',
  },
  critical: {
    icon: XCircle,
    color: 'text-red-600 dark:text-red-400',
    border: 'border-s-red-500',
  },
} as const;

type Severity = keyof typeof severityConfig;
const severityRank: Record<Severity, number> = {
  info: 0,
  warning: 1,
  serious: 2,
  critical: 3,
};

/** Effective severity — downgraded by terminal status */
function effectiveSeverity(rawSeverity: string, status: string): Severity {
  const raw =
    (rawSeverity as Severity) in severityConfig
      ? (rawSeverity as Severity)
      : 'info';
  if (status === 'acquitted' || status === 'closed') return 'info';
  if (status === 'under_investigation') {
    return severityRank[raw] > severityRank['warning'] ? 'warning' : raw;
  }
  return raw;
}

const statusVariant: Record<
  string,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
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

  const severity = effectiveSeverity(case_.severity, case_.status);
  const config = severityConfig[severity];
  const Icon = config.icon;

  return (
    <Card className={`glass-card border-s-4 ${config.border}`}>
      <CardContent className="space-y-3 py-4">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${config.color}`} />
          <div className="min-w-0 flex-1">
            <h4 className="leading-tight font-medium">{case_.title}</h4>
            {case_.description && (
              <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
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
          <Badge
            variant={statusVariant[case_.status] ?? 'outline'}
            className="text-xs"
          >
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
        <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-xs">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(case_.eventDate).toLocaleDateString('he-IL')}
          </span>
          <span>{case_.sourceName}</span>
          {case_.sourceUrl && !case_.documents?.length && (
            <a
              href={case_.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary flex items-center gap-1 hover:underline"
            >
              {t('viewSource')}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        {/* Official documents */}
        {case_.documents && case_.documents.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs font-semibold">
              {t('documents.officialDocs')}
            </p>
            <ul className="space-y-1">
              {case_.documents.map((doc) => (
                <li key={doc.id}>
                  {doc.url ? (
                    <DocumentViewerDialog
                      document={{
                        title: doc.title,
                        url: doc.url,
                        useGoogleViewer: !doc.storagePath,
                      }}
                      trigger={
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-auto w-full justify-start gap-2 py-1.5 text-xs"
                        >
                          <Eye className="h-3 w-3 shrink-0" />
                          <span className="truncate">{doc.title}</span>
                          {doc.publishedAt && (
                            <span className="text-muted-foreground ms-auto shrink-0">
                              {new Date(doc.publishedAt).toLocaleDateString(
                                'he-IL',
                              )}
                            </span>
                          )}
                        </Button>
                      }
                    />
                  ) : (
                    <div className="text-muted-foreground flex items-center gap-2 rounded border px-3 py-1.5 text-xs">
                      <FileText className="h-3 w-3 shrink-0" />
                      <span className="truncate">{doc.title}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* AI Summary */}
        {case_.aiSummary && (
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <p className="text-muted-foreground mb-1 text-xs font-semibold">
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
