import { useTranslations } from 'next-intl';
import Link from 'next/link';
import LanguageSwitcher from './LanguageSwitcher';

const navLinks = [
  { key: 'home', href: '/' },
  { key: 'members', href: '/members' },
  { key: 'votes', href: '/votes' },
  { key: 'legislation', href: '/legislation' },
  { key: 'parties', href: '/parties' },
  { key: 'budget', href: '/budget' },
  { key: 'committees', href: '/committees' },
] as const;

export default function Header() {
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-bold">
          {tCommon('appName')}
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map(({ key, href }) => (
            <Link
              key={key}
              href={href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {t(key)}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
