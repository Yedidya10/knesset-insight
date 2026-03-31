import { useTranslations } from 'next-intl';
import { Landmark } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export default function Footer() {
  const t = useTranslations('footer');
  const tCommon = useTranslations('common');

  return (
    <footer className="border-t border-border/60 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-primary" />
            <span className="font-bold">{tCommon('appName')}</span>
          </div>

          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span className="cursor-pointer transition-colors hover:text-foreground">{t('about')}</span>
            <span className="cursor-pointer transition-colors hover:text-foreground">{t('openSource')}</span>
            <span className="cursor-pointer transition-colors hover:text-foreground">{t('dataSources')}</span>
            <span className="cursor-pointer transition-colors hover:text-foreground">{t('privacy')}</span>
          </nav>
        </div>

        <Separator className="my-6 opacity-50" />

        <p className="text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} {tCommon('appName')}
        </p>
      </div>
    </footer>
  );
}
