'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { useState, useEffect } from 'react';
import {
  Menu,
  Landmark,
  Users,
  Vote,
  Gavel,
  Building2,
  Home,
  LayoutList,
  BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import LanguageSwitcher from './LanguageSwitcher';

const navLinks = [
  { key: 'home', href: '/', icon: Home },
  { key: 'members', href: '/members', icon: Users },
  { key: 'votes', href: '/votes', icon: Vote },
  { key: 'legislation', href: '/legislation', icon: Gavel },
  { key: 'factions', href: '/factions', icon: Building2 },
  { key: 'parties', href: '/parties', icon: Landmark },
  { key: 'elections', href: '/elections', icon: BookOpen },
  { key: 'committees', href: '/committees', icon: LayoutList },
] as const;

export default function Header() {
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
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
        'sticky top-0 z-50 bg-background/80 backdrop-blur-xl transition-[box-shadow,border-color] duration-300 gradient-border',
        scrolled
          ? 'shadow-sm'
          : 'shadow-none',
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="group flex items-center gap-2.5"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-transform duration-200 group-hover:scale-105">
            <Landmark className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold tracking-tight">
            {tCommon('appName')}
          </span>
        </Link>

        <nav className="hidden items-center gap-0.5 lg:flex">
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
                  <span className="absolute inset-x-2 -bottom-[13px] h-0.5 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                />
              }
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Menu</span>
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
              <SheetTitle className="flex items-center gap-2 px-2 pb-6">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
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
