import type { Metadata } from 'next';
import { Rubik, Noto_Sans_Arabic, JetBrains_Mono } from 'next/font/google';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { appConfig } from '../../../app.config';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import { ThemeProvider } from '../../components/layout/ThemeProvider';
import { AdminEditProvider } from '../../components/admin/AdminEditProvider';

const rubik = Rubik({
  variable: '--font-rubik',
  subsets: ['latin', 'hebrew', 'cyrillic'],
});

const notoArabic = Noto_Sans_Arabic({
  variable: '--font-noto-arabic',
  subsets: ['arabic'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jbmono',
  subsets: ['latin', 'cyrillic'],
});

export const metadata: Metadata = {
  title: 'Knesset Insight',
  description: 'Israeli parliamentary data platform',
  manifest: '/manifest.json',
};

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const isRTL = (appConfig.i18n.rtlLocales as readonly string[]).includes(locale);

  const messages = await getMessages();

  return (
    <html lang={locale} dir={isRTL ? 'rtl' : 'ltr'} className={`${rubik.variable} ${jetbrainsMono.variable} ${locale === 'ar' ? notoArabic.variable : ''}`} suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <AdminEditProvider>
              <div className="flex min-h-screen flex-col">
                <Header />
                <main className="flex-1">{children}</main>
                <Footer />
              </div>
            </AdminEditProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
