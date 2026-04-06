'use client';

import { useTranslations } from 'next-intl';
import { ShieldAlert, Building, Users, AlertTriangle, Info, AlertCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface CaseSummary {
  category: string;
  severity: string;
  count: number;
}

interface IntegritySummaryProps {
  totalCases: number;
  caseSummary: CaseSummary[];
  corporateAffiliations: number;
  lobbyistConnections: number;
}

const severityConfig = {
  info: { icon: Info, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30' },
  warning: { icon: AlertTriangle, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-950/30' },
  serious: { icon: AlertCircle, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/30' },
  critical: { icon: XCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30' },
} as const;

export default function IntegritySummary({
  totalCases,
  caseSummary,
  corporateAffiliations,
  lobbyistConnections,
}: IntegritySummaryProps) {
  const t = useTranslations('integrity');

  if (totalCases === 0 && corporateAffiliations === 0 && lobbyistConnections === 0) {
    return (
      <Card className="glass-card">
        <CardContent className="flex items-center gap-3 py-6">
          <ShieldAlert className="h-5 w-5 text-green-600" />
          <p className="text-sm text-muted-foreground">{t('noRecords')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldAlert className="h-5 w-5" />
          {t('title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-muted/50 p-3 text-center ring-1 ring-border/30">
            <p className="text-2xl font-bold">{totalCases}</p>
            <p className="text-xs text-muted-foreground">{t('totalCases')}</p>
          </div>
          <div className="rounded-xl bg-muted/50 p-3 text-center ring-1 ring-border/30">
            <div className="flex items-center justify-center gap-1">
              <Building className="h-4 w-4" />
              <p className="text-2xl font-bold">{corporateAffiliations}</p>
            </div>
            <p className="text-xs text-muted-foreground">{t('corporateAffiliations')}</p>
          </div>
          <div className="rounded-xl bg-muted/50 p-3 text-center ring-1 ring-border/30">
            <div className="flex items-center justify-center gap-1">
              <Users className="h-4 w-4" />
              <p className="text-2xl font-bold">{lobbyistConnections}</p>
            </div>
            <p className="text-xs text-muted-foreground">{t('lobbyistConnections')}</p>
          </div>
        </div>

        {/* Severity breakdown */}
        {caseSummary.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">{t('bySeverity')}</h4>
            <div className="flex flex-wrap gap-2">
              {caseSummary.map((item) => {
                const config = severityConfig[item.severity as keyof typeof severityConfig] ?? severityConfig.info;
                const Icon = config.icon;
                return (
                  <Badge
                    key={`${item.category}-${item.severity}`}
                    variant="outline"
                    className={`${config.bg} gap-1`}
                  >
                    <Icon className={`h-3 w-3 ${config.color}`} />
                    <span>{t(`categories.${item.category}`)}</span>
                    <span className="font-bold">({item.count})</span>
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <p className="text-xs text-muted-foreground italic border-t pt-3">
          {t('disclaimer')}
        </p>
      </CardContent>
    </Card>
  );
}
