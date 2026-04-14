import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import {
  Code2,
  Scale,
  ExternalLink,
  GitFork,
  GitBranch,
  FileCode,
  GitPullRequest,
} from 'lucide-react';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('seo.openSource');
  return {
    title: t('title'),
    description: t('description'),
    openGraph: { title: t('title'), description: t('description') },
  };
}

export default async function OpenSourcePage() {
  const t = await getTranslations('openSourcePage');

  const contributeSteps = [
    { key: 'fork' as const, icon: GitFork },
    { key: 'branch' as const, icon: GitBranch },
    { key: 'code' as const, icon: FileCode },
    { key: 'pr' as const, icon: GitPullRequest },
  ];

  const stackKeys = [
    'framework',
    'language',
    'styling',
    'database',
    'cache',
    'ai',
    'i18n',
    'api',
    'pwa',
  ] as const;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
          <Code2 className="text-primary h-5 w-5" />
        </div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
      </div>

      <p className="text-muted-foreground mb-8 leading-relaxed">{t('intro')}</p>

      {/* License */}
      <section className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <Scale className="text-primary h-5 w-5" />
          <h2 className="text-xl font-semibold">{t('licenseTitle')}</h2>
        </div>
        <p className="text-muted-foreground">{t('licenseText')}</p>
      </section>

      {/* Repository */}
      <section className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <ExternalLink className="text-primary h-5 w-5" />
          <h2 className="text-xl font-semibold">{t('repoTitle')}</h2>
        </div>
        <p className="text-muted-foreground mb-3">{t('repoText')}</p>
        <a
          href="https://github.com/Yedidya10/knesset-insight"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-card hover:bg-accent inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
          {t('repoLink')}
        </a>
      </section>

      {/* How to Contribute */}
      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold">{t('contributeTitle')}</h2>
        <ol className="space-y-3">
          {contributeSteps.map(({ key, icon: Icon }, i) => (
            <li key={key} className="flex items-start gap-3">
              <span className="bg-primary/10 text-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                {i + 1}
              </span>
              <div className="flex items-center gap-2 pt-0.5">
                <Icon className="text-muted-foreground h-4 w-4" />
                <span className="text-muted-foreground">
                  {t(`contributeSteps.${key}`)}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Tech Stack */}
      <section>
        <h2 className="mb-4 text-xl font-semibold">{t('stackTitle')}</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {stackKeys.map((key) => (
            <div
              key={key}
              className="bg-card flex items-center gap-2 rounded-lg border p-3 text-sm"
            >
              <Code2 className="text-primary h-4 w-4 shrink-0" />
              <span className="text-muted-foreground">{t(`stack.${key}`)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
