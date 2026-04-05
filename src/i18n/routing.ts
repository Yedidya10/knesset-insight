import { defineRouting } from 'next-intl/routing';
import { appConfig } from '../../app.config';

export const routing = defineRouting({
  locales: appConfig.i18n.locales,
  defaultLocale: appConfig.i18n.defaultLocale,
  localePrefix: 'always',
});
