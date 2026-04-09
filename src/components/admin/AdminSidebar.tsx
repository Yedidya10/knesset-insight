'use client';

import { useTranslations } from 'next-intl';
import {
  LayoutDashboard,
  Brain,
  Database,
  Activity,
  Shield,
  LogOut,
} from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

const navItems = [
  { key: 'overview', href: '/admin', icon: LayoutDashboard },
  { key: 'aiReview', href: '/admin/ai-review', icon: Brain },
  { key: 'integrity', href: '/admin/integrity', icon: Shield },
  { key: 'syncStatus', href: '/admin/sync', icon: Database },
  { key: 'activityLog', href: '/admin/activity', icon: Activity },
] as const;

export default function AdminSidebar() {
  const t = useTranslations('admin.nav');
  const pathname = usePathname();

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    window.location.href = '/';
  };

  return (
    <aside className="flex w-64 flex-col border-e bg-muted/30">
      <div className="border-b p-4">
        <h2 className="text-lg font-semibold">{t('title')}</h2>
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map(({ key, href, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/admin' && pathname.startsWith(href));
          return (
            <Link
              key={key}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {t(key)}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-2">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {t('logout')}
        </button>
      </div>
    </aside>
  );
}
