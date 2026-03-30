import { getRequestConfig } from 'next-intl/server';
import { appConfig, type Locale } from '../../app.config';

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = ((await requestLocale) ?? appConfig.i18n.defaultLocale) as Locale;

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
