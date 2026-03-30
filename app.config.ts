export const appConfig = {
  // Supported locales — RTL detected automatically
  i18n: {
    locales: ['he', 'en', 'ar', 'ru'] as const,
    defaultLocale: 'he' as const,
    rtlLocales: ['he', 'ar'] as const,
  },

  // AI configuration
  ai: {
    provider: (process.env.AI_PROVIDER ?? 'gemini') as 'gemini' | 'openai',
    defaultModel: process.env.AI_DEFAULT_MODEL ?? 'gemini-2.5-flash',
    fallbackProvider: (process.env.AI_FALLBACK_PROVIDER ?? 'openai') as 'gemini' | 'openai',
    fallbackModel: process.env.AI_FALLBACK_MODEL ?? 'gpt-4o',
    embeddingProvider: (process.env.EMBEDDING_PROVIDER ?? 'gemini') as 'gemini' | 'openai',
    embeddingModel: process.env.EMBEDDING_MODEL ?? 'text-embedding-004',
    embeddingDimensions: Number(process.env.EMBEDDING_DIMENSIONS ?? 768),
    dailyChatLimit: Number(process.env.AI_DAILY_CHAT_LIMIT ?? 20),
  },

  // Rate limiting
  rateLimit: {
    anon: Number(process.env.RATE_LIMIT_ANON ?? 60),
    auth: Number(process.env.RATE_LIMIT_AUTH ?? 200),
  },

  // Data sources
  dataSources: {
    knessetOdata:
      process.env.KNESSET_ODATA_BASE_URL ?? 'https://knesset.gov.il/Odata',
    oknessetData:
      process.env.OKNESSET_DATA_URL ?? 'https://production.oknesset.org/pipelines/data',
    budgetApi: process.env.BUDGET_API_URL ?? 'https://next.obudget.org/api',
  },

  // Sync schedule (cron expressions)
  sync: {
    odata: process.env.SYNC_ODATA_CRON ?? '0 */6 * * *',
    oknesset: process.env.SYNC_OKNESSET_CRON ?? '0 3 * * *',
    budget: process.env.SYNC_BUDGET_CRON ?? '0 2 * * 5',
  },

  // Feature flags
  features: {
    pwa: process.env.NEXT_PUBLIC_PWA_ENABLED === 'true',
    aiChat: true, // always on for registered users
  },
} as const;

export type Locale = (typeof appConfig.i18n.locales)[number];

export function isRTL(locale: Locale): boolean {
  return (appConfig.i18n.rtlLocales as readonly string[]).includes(locale);
}
