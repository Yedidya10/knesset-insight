'use client';

import { useTranslations } from 'next-intl';
import { Building, ExternalLink, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Affiliation {
  id: number;
  companyNumber: string;
  companyName: string;
  role: string;
  status: string | null;
  startDate: string | null;
  endDate: string | null;
  sourceUrl: string | null;
  potentialConflict: boolean | null;
  conflictDescription: string | null;
}

interface CorporateAffiliationsProps {
  affiliations: Affiliation[];
}

export default function CorporateAffiliations({ affiliations }: CorporateAffiliationsProps) {
  const t = useTranslations('integrity');

  if (affiliations.length === 0) return null;

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building className="h-5 w-5" />
          {t('corporateAffiliations')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {affiliations.map((aff) => (
            <div
              key={aff.id}
              className="flex items-start gap-3 rounded-lg p-3 ring-1 ring-border/30 hover:bg-muted/30 transition-colors"
            >
              <Building className="h-4 w-4 shrink-0 mt-1 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{aff.companyName}</p>
                  {aff.potentialConflict && (
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {t(`roles.${aff.role}`)}
                  </Badge>
                  <Badge
                    variant={aff.status === 'active' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {t(`affiliationStatus.${aff.status ?? 'active'}`)}
                  </Badge>
                </div>
                <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                  <span>#{aff.companyNumber}</span>
                  {aff.startDate && (
                    <span>{new Date(aff.startDate).toLocaleDateString('he-IL')}</span>
                  )}
                  {aff.endDate && (
                    <span>— {new Date(aff.endDate).toLocaleDateString('he-IL')}</span>
                  )}
                </div>
                {aff.potentialConflict && aff.conflictDescription && (
                  <p className="mt-1 text-xs text-orange-600 dark:text-orange-400">
                    {aff.conflictDescription}
                  </p>
                )}
              </div>
              {aff.sourceUrl && (
                <a
                  href={aff.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
