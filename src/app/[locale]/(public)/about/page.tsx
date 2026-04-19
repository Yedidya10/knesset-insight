import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import {
  Info,
  Users,
  Vote,
  Scale,
  BarChart3,
  Eye,
  Shield,
  Globe,
  Ban,
  Code,
  Cpu,
} from 'lucide-react';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('seo.about');
  return {
    title: t('title'),
    description: t('description'),
    openGraph: { title: t('title'), description: t('description') },
  };
}

export default async function AboutPage() {
  const t = await getTranslations('aboutPage');

  const whatWeDoItems = [
    { key: 'members' as const, icon: Users },
    { key: 'votes' as const, icon: Vote },
    { key: 'legislation' as const, icon: Scale },
    { key: 'data' as const, icon: BarChart3 },
    { key: 'transparency' as const, icon: Eye },
  ];

  const values = [
    { key: 'transparency' as const, icon: Eye },
    { key: 'accessibility' as const, icon: Globe },
    { key: 'nonPartisan' as const, icon: Ban },
    { key: 'openSource' as const, icon: Code },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
          <Info className="text-primary h-5 w-5" />
        </div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
      </div>

      {/* Mission */}
      <section className="mb-10">
        <h2 className="mb-3 text-xl font-semibold">{t('missionTitle')}</h2>
        <p className="text-muted-foreground leading-relaxed">
          {t('missionText')}
        </p>
      </section>

      {/* What We Do */}
      <section className="mb-10">
        <h2 className="mb-4 text-xl font-semibold">{t('whatWeDoTitle')}</h2>
        <ul className="space-y-3">
          {whatWeDoItems.map(({ key, icon: Icon }) => (
            <li key={key} className="flex items-start gap-3">
              <Icon className="text-primary mt-0.5 h-5 w-5 shrink-0" />
              <span className="text-muted-foreground">
                {t(`whatWeDoItems.${key}`)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Values */}
      <section className="mb-10">
        <h2 className="mb-4 text-xl font-semibold">{t('valuesTitle')}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {values.map(({ key, icon: Icon }) => (
            <div key={key} className="bg-card rounded-lg border p-4 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <Icon className="text-primary h-5 w-5" />
                <h3 className="font-semibold">{t(`values.${key}`)}</h3>
              </div>
              <p className="text-muted-foreground text-sm">
                {t(`values.${key}Desc`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Technology */}
      <section className="mb-10">
        <h2 className="mb-3 text-xl font-semibold">{t('techTitle')}</h2>
        <div className="bg-card flex items-start gap-3 rounded-lg border p-4">
          <Cpu className="text-primary mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t('techText')}
          </p>
        </div>
      </section>
    </div>
  );
}
