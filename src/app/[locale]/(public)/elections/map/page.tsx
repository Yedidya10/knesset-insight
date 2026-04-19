import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { Map } from 'lucide-react';
import { desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { electionCityResults } from '@/lib/db/schema';
import { Link } from '@/i18n/navigation';
import AppBreadcrumb from '@/components/layout/AppBreadcrumb';
import ElectionMapClient from '@/components/elections/map/ElectionMapClient';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('seo.electionMap');
  return {
    title: t('title'),
    description: t('description'),
    openGraph: { title: t('title'), description: t('description') },
  };
}

export default async function ElectionMapPage() {
  const t = await getTranslations('electionMap');
  const tNav = await getTranslations('nav');

  // Get available knesset numbers from the database
  const rows = await db
    .selectDistinct({ knessetNum: electionCityResults.knessetNum })
    .from(electionCityResults)
    .orderBy(desc(electionCityResults.knessetNum));

  const availableKnessets = rows.map((r) => r.knessetNum);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <AppBreadcrumb
        items={[
          { label: tNav('home'), href: '/' },
          { label: tNav('elections'), href: '/elections' },
          { label: t('title') },
        ]}
      />

      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <div className="bg-primary/10 ring-primary/20 flex h-14 w-14 items-center justify-center rounded-2xl ring-1">
          <Map className="text-primary h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t('title')}
          </h1>
          <p className="text-muted-foreground text-sm">{t('description')}</p>
        </div>
      </div>

      {/* Map client component */}
      <ElectionMapClient availableKnessets={availableKnessets} />
    </div>
  );
}
