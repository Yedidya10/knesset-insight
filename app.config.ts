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
    knessetWebsiteApi:
      process.env.KNESSET_WEBSITE_API_URL ?? 'https://knesset.gov.il/WebSiteApi/knessetapi',
    knessetOdataV4:
      process.env.KNESSET_ODATA_V4_URL ?? 'https://knesset.gov.il/OdataV4/ParliamentInfo',
    oknessetData:
      process.env.OKNESSET_DATA_URL ?? 'https://production.oknesset.org/pipelines/data',
    budgetApi: process.env.BUDGET_API_URL ?? 'https://next.obudget.org/api',
    govPartyRegistrar:
      process.env.GOV_PARTY_REGISTRAR_URL ?? 'https://www.gov.il/he/departments/dynamiccollectors/parties-db',
    electionResults:
      process.env.ELECTION_RESULTS_URL ?? 'https://votes{N}.bechirot.gov.il',
  },

  // Knesset data scope
  knesset: {
    /** Knesset numbers to sync (newest first) */
    syncKnessets: [25, 24, 23, 22, 21, 20] as readonly number[],
    /** Knessets where only the Knesset WebSiteApi has data (no OData / no CSV) */
    websiteApiOnlyKnessets: [25] as readonly number[],
    /** OData PositionID for "Member of Knesset" */
    mkPositionId: 54,
    /** Government-related position IDs from KNS_Position */
    govPositionIds: {
      primeMinister: 45,       // ראש הממשלה
      alternatePm: 73,         // ראש הממשלה החלופי
      actingPm: 51,            // מ"מ ראש הממשלה
      deputyPm: [31, 50, 65], // משנה/סגן/סגנית לראש הממשלה
      minister: [39, 57],      // שר / שרה
      deputyMinister: [40, 59, 285079], // סגן שר / סגנית שר / סגן שרה
    },
  },

  // Sync schedule (cron expressions)
  sync: {
    odata: process.env.SYNC_ODATA_CRON ?? '0 */6 * * *',
    oknesset: process.env.SYNC_OKNESSET_CRON ?? '0 3 * * *',
    budget: process.env.SYNC_BUDGET_CRON ?? '0 2 * * 5',
  },

  // Google Translate
  translate: {
    apiKey: process.env.GOOGLE_TRANSLATE_API_KEY ?? '',
    apiUrl: 'https://translation.googleapis.com/language/translate/v2',
    sourceLocale: 'he' as const,
    /** Max characters per single translation request */
    maxChars: Number(process.env.TRANSLATE_MAX_CHARS ?? 5000),
  },

  // Feature flags
  features: {
    pwa: process.env.NEXT_PUBLIC_PWA_ENABLED === 'true',
    aiChat: true, // always on for registered users
  },

  // Image settings
  images: {
    /** Thumbnail width for member portraits (px) */
    thumbWidth: 300,
    /** Quality for next/image optimization (1-100) */
    quality: 80,
    sources: {
      oknesset: {
        attribution: 'כנסת פתוחה — הסדנא לידע ציבורי',
      },
      wikidata: {
        attribution: 'Wikimedia Commons (CC BY-SA 4.0)',
      },
      knessetOfficial: {
        attribution: 'אתר הכנסת הרשמי',
      },
    },
  },
} as const;

export type Locale = (typeof appConfig.i18n.locales)[number];

export function isRTL(locale: Locale): boolean {
  return (appConfig.i18n.rtlLocales as readonly string[]).includes(locale);
}
