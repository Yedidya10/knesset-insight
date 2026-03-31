'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { appConfig, type Locale } from '../../../app.config';

const localeLabels: Record<Locale, string> = {
  he: 'עברית',
  en: 'English',
  ar: 'العربية',
  ru: 'Русский',
};

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function switchLocale(newLocale: string) {
    const segments = pathname.split('/').filter(Boolean);
    if (appConfig.i18n.locales.includes(segments[0] as Locale)) {
      segments.shift();
    }
    const newPath =
      newLocale === appConfig.i18n.defaultLocale
        ? `/${segments.join('/')}`
        : `/${newLocale}/${segments.join('/')}`;
    router.push(newPath);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-9 w-9" />}>
        <Globe className="h-4 w-4" />
        <span className="sr-only">Language</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {appConfig.i18n.locales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => switchLocale(loc)}
            className={loc === locale ? 'bg-accent font-medium' : ''}
          >
            {localeLabels[loc]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
