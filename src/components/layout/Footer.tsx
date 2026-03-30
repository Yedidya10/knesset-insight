import { useTranslations } from 'next-intl';

export default function Footer() {
  const t = useTranslations('footer');
  const tCommon = useTranslations('common');

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-6 sm:flex-row sm:justify-between">
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} {tCommon('appName')}
        </p>

        <nav className="flex gap-4 text-sm text-muted-foreground">
          <span>{t('about')}</span>
          <span>{t('openSource')}</span>
          <span>{t('dataSources')}</span>
          <span>{t('privacy')}</span>
        </nav>
      </div>
    </footer>
  );
}
