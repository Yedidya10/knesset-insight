import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import {
  FileText,
  Info,
  Server,
  Database,
  Bot,
  UserCog,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('seo.terms');
  return {
    title: t('title'),
    description: t('description'),
    openGraph: { title: t('title'), description: t('description') },
  };
}

export default async function TermsPage() {
  const t = await getTranslations('termsPage');

  const sections = [
    {
      titleKey: 'introTitle' as const,
      textKey: 'introText' as const,
      icon: Info,
    },
    {
      titleKey: 'serviceTitle' as const,
      textKey: 'serviceText' as const,
      icon: Server,
    },
    {
      titleKey: 'dataTitle' as const,
      textKey: 'dataText' as const,
      icon: Database,
    },
    { titleKey: 'aiTitle' as const, textKey: 'aiText' as const, icon: Bot },
    {
      titleKey: 'accountTitle' as const,
      textKey: 'accountText' as const,
      icon: UserCog,
    },
    {
      titleKey: 'limitationTitle' as const,
      textKey: 'limitationText' as const,
      icon: ShieldAlert,
    },
    {
      titleKey: 'changesTitle' as const,
      textKey: 'changesText' as const,
      icon: RefreshCw,
    },
  ] as const;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-2 flex items-center gap-3">
        <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
          <FileText className="text-primary h-5 w-5" />
        </div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
      </div>
      <p className="text-muted-foreground/60 mb-8 text-sm">
        {t('lastUpdated')}
      </p>

      <div className="space-y-8">
        {sections.map(({ titleKey, textKey, icon: Icon }) => (
          <section key={titleKey}>
            <div className="mb-3 flex items-center gap-2">
              <Icon className="text-primary h-5 w-5" />
              <h2 className="text-lg font-semibold">{t(titleKey)}</h2>
            </div>
            <p className="text-muted-foreground">{t(textKey)}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
