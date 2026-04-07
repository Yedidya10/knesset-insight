'use client';

import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { Layers, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LegislationViewToggleProps {
  currentView: string;
}

export default function LegislationViewToggle({ currentView }: LegislationViewToggleProps) {
  const t = useTranslations('legislation.clusters');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const switchView = (view: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', view);
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="inline-flex rounded-lg border bg-muted/30 p-1">
      <button
        type="button"
        onClick={() => switchView('clusters')}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
          currentView === 'clusters'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <Layers className="h-4 w-4" />
        {t('viewClusters')}
      </button>
      <button
        type="button"
        onClick={() => switchView('bills')}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
          currentView !== 'clusters'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <FileText className="h-4 w-4" />
        {t('viewIndividual')}
      </button>
    </div>
  );
}
