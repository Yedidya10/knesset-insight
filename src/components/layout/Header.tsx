'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { useState, useEffect, Suspense } from 'react';
import {
  Menu,
  Landmark,
  Users,
  Gavel,
  Building2,
  Home,
  LayoutList,
  BookOpen,
  Crown,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { appConfig } from '../../../app.config';
import LanguageSwitcher from './LanguageSwitcher';
import ThemeToggle from './ThemeToggle';

const navLinks = [
  { key: 'home', href: '/', icon: Home },
  { key: 'members', href: '/members', icon: Users },
  { key: 'legislation', href: '/legislation', icon: Gavel },
  { key: 'politics', href: '/politics', icon: Building2 },
  { key: 'elections', href: '/elections', icon: BookOpen },
  { key: 'committees', href: '/committees', icon: LayoutList },
  { key: 'governments', href: '/governments', icon: Crown },
  { key: 'budget', href: '/budget', icon: Wallet },
] as const;

export default function Header() {
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const isRTL = (appConfig.i18n.rtlLocales as readonly string[]).includes(
    locale,
  );
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  return (
    <header
      className={cn(
        'bg-background/80 gradient-border sticky top-0 z-50 backdrop-blur-xl transition-[box-shadow,border-color] duration-300',
        scrolled ? 'shadow-sm' : 'shadow-none',
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <div className="bg-primary text-primary-foreground flex h-9 w-9 items-center justify-center rounded-xl shadow-sm transition-transform duration-200 group-hover:scale-105">
            <Landmark className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold tracking-tight">
            {tCommon('appName')}
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {navLinks.map(({ key, href }) => {
            const active = isActive(href);
            return (
              <Link
                key={key}
                href={href}
                className={cn(
                  'relative rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t(key)}
                {active && (
                  <span className="bg-primary absolute inset-x-2 -bottom-3.25 h-0.5 rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Suspense>
            <LanguageSwitcher />
          </Suspense>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon" className="lg:hidden" />
              }
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Menu</span>
            </SheetTrigger>
            <SheetContent side={isRTL ? 'right' : 'left'} className="w-72">
              <SheetTitle className="flex items-center gap-2 px-2 pb-6">
                <div className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-lg">
                  <Landmark className="h-4 w-4" />
                </div>
                <span className="font-bold">{tCommon('appName')}</span>
              </SheetTitle>
              <nav className="flex flex-col gap-0.5">
                {navLinks.map(({ key, href, icon: Icon }) => (
                  <Link
                    key={key}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive(href)
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {t(key)}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
