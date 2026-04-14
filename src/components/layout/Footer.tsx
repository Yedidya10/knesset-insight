import { useTranslations } from 'next-intl';
import { Landmark } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Link } from '@/i18n/navigation';

export default function Footer() {
  const t = useTranslations('footer');
  const tCommon = useTranslations('common');

  const links = [
    { href: '/about' as const, label: t('about') },
    { href: '/open-source' as const, label: t('openSource') },
    { href: '/data-sources' as const, label: t('dataSources') },
    { href: '/privacy' as const, label: t('privacy') },
    { href: '/terms' as const, label: t('terms') },
  ];

  return (
    <footer className="gradient-border-top bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-lg">
              <Landmark className="text-primary h-4 w-4" />
            </div>
            <span className="font-bold">{tCommon('appName')}</span>
          </div>

          <nav className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="hover:text-foreground transition-colors"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <Separator className="my-6 opacity-30" />

        <p className="text-muted-foreground/60 text-center text-xs">
          © {new Date().getFullYear()} {tCommon('appName')}
        </p>
      </div>
    </footer>
  );
}
