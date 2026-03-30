'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
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
    // Remove current locale prefix from path
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
    <select
      value={locale}
      onChange={(e) => switchLocale(e.target.value)}
      className="rounded-md border border-border bg-background px-2 py-1 text-sm"
      aria-label="Language"
    >
      {appConfig.i18n.locales.map((loc) => (
        <option key={loc} value={loc}>
          {localeLabels[loc]}
        </option>
      ))}
    </select>
  );
}
