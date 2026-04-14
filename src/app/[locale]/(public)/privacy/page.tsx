import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import {
  ShieldCheck,
  Database,
  Eye,
  Share2,
  Cookie,
  UserCheck,
  Mail,
} from 'lucide-react';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('seo.privacy');
  return {
    title: t('title'),
    description: t('description'),
    openGraph: { title: t('title'), description: t('description') },
  };
}

export default async function PrivacyPage() {
  const t = await getTranslations('privacyPage');

  const sections = [
    {
      titleKey: 'introTitle' as const,
      icon: ShieldCheck,
      content: 'text' as const,
      textKey: 'introText' as const,
    },
    {
      titleKey: 'collectTitle' as const,
      icon: Database,
      content: 'list' as const,
      items: ['account', 'usage', 'ai'] as const,
      listNamespace: 'collectItems' as const,
    },
    {
      titleKey: 'useTitle' as const,
      icon: Eye,
      content: 'list' as const,
      items: ['service', 'improve', 'security'] as const,
      listNamespace: 'useItems' as const,
    },
    {
      titleKey: 'sharingTitle' as const,
      icon: Share2,
      content: 'text' as const,
      textKey: 'sharingText' as const,
    },
    {
      titleKey: 'cookiesTitle' as const,
      icon: Cookie,
      content: 'text' as const,
      textKey: 'cookiesText' as const,
    },
    {
      titleKey: 'rightsTitle' as const,
      icon: UserCheck,
      content: 'text' as const,
      textKey: 'rightsText' as const,
    },
    {
      titleKey: 'contactTitle' as const,
      icon: Mail,
      content: 'text' as const,
      textKey: 'contactText' as const,
    },
  ] as const;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-2 flex items-center gap-3">
        <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
          <ShieldCheck className="text-primary h-5 w-5" />
        </div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
      </div>
      <p className="text-muted-foreground/60 mb-8 text-sm">
        {t('lastUpdated')}
      </p>

      <div className="space-y-8">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <section key={section.titleKey}>
              <div className="mb-3 flex items-center gap-2">
                <Icon className="text-primary h-5 w-5" />
                <h2 className="text-lg font-semibold">{t(section.titleKey)}</h2>
              </div>
              {section.content === 'text' ? (
                <p className="text-muted-foreground">{t(section.textKey)}</p>
              ) : (
                <ul className="text-muted-foreground list-inside list-disc space-y-1.5">
                  {section.items.map((item) => (
                    <li key={item}>{t(`${section.listNamespace}.${item}`)}</li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
