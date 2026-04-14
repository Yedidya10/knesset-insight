import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import {
  Database,
  Globe,
  RefreshCw,
  Clock,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('seo.dataSources');
  return {
    title: t('title'),
    description: t('description'),
    openGraph: { title: t('title'), description: t('description') },
  };
}

export default async function DataSourcesPage() {
  const t = await getTranslations('dataSourcesPage');

  const sources = [
    {
      titleKey: 'knessetApiTitle' as const,
      textKey: 'knessetApiText' as const,
      urlKey: 'knessetApiUrl' as const,
      frequency: 'updateEvery6Hours' as const,
    },
    {
      titleKey: 'oknessetTitle' as const,
      textKey: 'oknessetText' as const,
      urlKey: 'oknessetUrl' as const,
      frequency: 'updateDaily' as const,
    },
    {
      titleKey: 'openBudgetTitle' as const,
      textKey: 'openBudgetText' as const,
      urlKey: 'openBudgetUrl' as const,
      frequency: 'updateDaily' as const,
    },
    {
      titleKey: 'electionResultsTitle' as const,
      textKey: 'electionResultsText' as const,
      urlKey: 'electionResultsUrl' as const,
      frequency: 'updateOnElection' as const,
    },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
          <Database className="text-primary h-5 w-5" />
        </div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
      </div>

      <p className="text-muted-foreground mb-8 leading-relaxed">{t('intro')}</p>

      {/* Sources */}
      <div className="space-y-6">
        {sources.map(({ titleKey, textKey, urlKey, frequency }) => (
          <div
            key={titleKey}
            className="bg-card rounded-lg border p-5 shadow-sm"
          >
            <div className="mb-2 flex items-center gap-2">
              <Globe className="text-primary h-5 w-5" />
              <h2 className="text-lg font-semibold">{t(titleKey)}</h2>
            </div>
            <p className="text-muted-foreground mb-3 text-sm">{t(textKey)}</p>
            <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-xs">
              <span className="flex items-center gap-1">
                <ExternalLink className="h-3.5 w-3.5" />
                {t(urlKey)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {t('updateFrequency')}: {t(frequency)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Accuracy note */}
      <div className="mt-8 flex items-start gap-3 rounded-lg border border-yellow-500/30 bg-yellow-50/50 p-4 dark:bg-yellow-900/10">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600 dark:text-yellow-400" />
        <p className="text-muted-foreground text-sm">{t('accuracyNote')}</p>
      </div>

      {/* Refresh indicator */}
      <div className="mt-6 flex justify-center">
        <div className="text-muted-foreground/60 flex items-center gap-2 text-xs">
          <RefreshCw className="h-3.5 w-3.5" />
          {t('updateFrequency')}
        </div>
      </div>
    </div>
  );
}
