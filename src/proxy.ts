import createMiddleware from 'next-intl/middleware';
import { appConfig } from '../app.config';

export const proxy = createMiddleware({
  locales: appConfig.i18n.locales,
  defaultLocale: appConfig.i18n.defaultLocale,
  localePrefix: 'as-needed',
});

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
