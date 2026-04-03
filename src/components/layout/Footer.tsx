import { useTranslations } from 'next-intl';
import { Landmark } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export default function Footer() {
  const t = useTranslations('footer');
  const tCommon = useTranslations('common');

  return (
    <footer className="gradient-border-top bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Landmark className="h-4 w-4 text-primary" />
            </div>
            <span className="font-bold">{tCommon('appName')}</span>
          </div>

          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span className="cursor-pointer transition-colors hover:text-foreground">
              {t('about')}
            </span>
            <span className="cursor-pointer transition-colors hover:text-foreground">
              {t('openSource')}
            </span>
            <span className="cursor-pointer transition-colors hover:text-foreground">
              {t('dataSources')}
            </span>
            <span className="cursor-pointer transition-colors hover:text-foreground">
              {t('privacy')}
            </span>
          </nav>
        </div>

        <Separator className="my-6 opacity-30" />

        <p className="text-center text-xs text-muted-foreground/60">
          © {new Date().getFullYear()} {tCommon('appName')}
        </p>
      </div>
    </footer>
  );
}
