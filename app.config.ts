export const appConfig = {
  // Site URL — used for SEO (sitemap, canonical, Open Graph)
  siteUrl:
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://knesset-insight.vercel.app',

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
    fallbackProvider: (process.env.AI_FALLBACK_PROVIDER ?? 'openai') as
      | 'gemini'
      | 'openai',
    fallbackModel: process.env.AI_FALLBACK_MODEL ?? 'gpt-4o',
    embeddingProvider: (process.env.EMBEDDING_PROVIDER ?? 'gemini') as
      | 'gemini'
      | 'openai',
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
      process.env.KNESSET_WEBSITE_API_URL ??
      'https://knesset.gov.il/WebSiteApi/knessetapi',
    knessetOdataV4:
      process.env.KNESSET_ODATA_V4_URL ??
      'https://knesset.gov.il/OdataV4/ParliamentInfo',
    oknessetData:
      process.env.OKNESSET_DATA_URL ??
      'https://production.oknesset.org/pipelines/data',
    budgetApi: process.env.BUDGET_API_URL ?? 'https://next.obudget.org/api',
    govPartyRegistrar:
      process.env.GOV_PARTY_REGISTRAR_URL ??
      'https://www.gov.il/he/departments/dynamiccollectors/parties-db',
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
      primeMinister: 45, // ראש הממשלה
      alternatePm: 73, // ראש הממשלה החלופי
      actingPm: 51, // מ"מ ראש הממשלה
      deputyPm: [31, 50, 65], // משנה/סגן/סגנית לראש הממשלה
      minister: [39, 57], // שר / שרה
      deputyMinister: [40, 59, 285079], // סגן שר / סגנית שר / סגן שרה
    },
    /**
     * Static coalition faction mapping per knesset + government.
     * The Knesset OData has no dedicated coalition entity — deriving coalition
     * from government positions (KNS_PersonToPosition) is unreliable because
     * emergency government members (e.g. כחול לבן in Gov37) and position
     * reshuffles (e.g. ש"ס positions all ending) produce false data.
     * Values are KNS_Faction FactionIDs (knessetId in our DB).
     * Source: Wikipedia + official Knesset records.
     */
    coalitionFactions: {
      // K25 Gov37: הליכוד, ש"ס, הציונות הדתית, עוצמה יהודית, הימין הממלכתי, יהדות התורה, נעם
      '25-37': [1096, 1095, 1105, 1106, 1108, 1101, 1107],
      // K24 Gov36: ימינה, יש עתיד, כחול לבן, העבודה, ישראל ביתנו, מרצ, תקווה חדשה, רע"ם
      '24-36': [966, 967, 969, 963, 968, 970, 972, 973],
      // K23 Gov35: הליכוד, כחול לבן, העבודה-גשר-מרצ, דרך ארץ, גשר (emergency unity gov)
      '23-35': [942, 946, 949, 954, 957],
      // K23 Gov34: הליכוד, ש"ס, יהדות התורה, ישראל ביתנו, ימינה, כחול לבן
      '23-34': [942, 947, 944, 945, 948, 946],
      // K20 Gov34: הליכוד, כולנו, הבית היהודי, ש"ס, יהדות התורה, ישראל ביתנו
      '20-34': [882, 906, 907, 910, 908, 905],
    } as Record<string, readonly number[]>,
  },

  // Sync schedule (cron expressions, Israel time)
  // These are the source of truth — Trigger.dev tasks read from here.
  sync: {
    coreData: process.env.SYNC_CORE_CRON ?? '0 */6 * * *', // every 6h
    billRelations: process.env.SYNC_BILL_RELATIONS_CRON ?? '0 1 * * *', // daily 1 AM
    politicalData: process.env.SYNC_POLITICAL_CRON ?? '0 3 * * *', // daily 3 AM
    integrity: process.env.SYNC_INTEGRITY_CRON ?? '0 4 * * *', // daily 4 AM
    analysis: process.env.SYNC_ANALYSIS_CRON ?? '0 5 * * *', // daily 5 AM
    timezone: 'Asia/Jerusalem',
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
    integrity: process.env.NEXT_PUBLIC_INTEGRITY_ENABLED !== 'false', // on by default
  },

  // Integrity & Ethics feature
  integrity: {
    ai: {
      provider: 'anthropic' as const,
      model: process.env.INTEGRITY_AI_MODEL ?? 'claude-sonnet-4-20250514',
      maxTokens: Number(process.env.INTEGRITY_AI_MAX_TOKENS ?? 4096),
    },
    /** Cache TTL for integrity data queries (seconds) */
    cacheTtl: Number(process.env.INTEGRITY_CACHE_TTL ?? 3600),
    /** Data sources for integrity pipeline */
    sources: {
      knessetEthicsCommittee:
        process.env.INTEGRITY_KNESSET_ETHICS_URL ??
        'https://knesset.gov.il/Odata/ParliamentInfo.svc/KNS_CmtSessionItem',
      stateComptroller:
        process.env.INTEGRITY_COMPTROLLER_URL ?? 'https://www.mevaker.gov.il',
      lobbyistRegistry:
        process.env.INTEGRITY_LOBBYIST_URL ??
        'https://production.oknesset.org/pipelines/data/lobbyists/list/datapackage.json',
    },
    sync: {
      cron: process.env.INTEGRITY_SYNC_CRON ?? '0 4 * * *',
    },
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

  // Election 2026 campaign
  elections2026: {
    knessetNum: 26,
    /** Estimated election date — update when confirmed */
    estimatedDate: process.env.ELECTION_2026_DATE ?? '2026-10-27',
    /** Total Knesset seats */
    totalSeats: 120,
    /** Minimum seats to pass electoral threshold */
    thresholdPercent: 3.25,
    /** Cron for AI candidate monitoring (daily at 7 AM Israel time) */
    candidateSyncCron: process.env.ELECTION_CANDIDATE_SYNC_CRON ?? '0 7 * * *',
  },

  // Election voter map (historical results by city)
  electionMap: {
    /** Knesset numbers with available city-level results */
    availableKnessets: [20, 21, 22, 23, 24, 25] as readonly number[],
    /** Default knesset to show on page load */
    defaultKnesset: 25,
    /** TopoJSON file path (relative to public/) */
    topoJsonPath: '/geo/israel-municipalities.topojson',
    /** Color scale for turnout choropleth — amber-200 → indigo-700 */
    turnoutColorRange: ['#d1fae5', '#065f46'] as readonly [string, string],
    /** CSV base URL pattern — replace {N} with knesset number */
    csvBaseUrl: 'https://media{N}.bechirot.gov.il/files/expc.csv',
  },

  // Bill Clusters (unified legislation entities)
  billClusters: {
    ai: {
      provider: 'anthropic' as const,
      model: process.env.BILL_CLUSTERS_AI_MODEL ?? 'claude-sonnet-4-20250514',
      maxTokens: Number(process.env.BILL_CLUSTERS_AI_MAX_TOKENS ?? 4096),
      dailyTokenBudget: Number(
        process.env.BILL_CLUSTERS_DAILY_TOKEN_BUDGET ?? 500_000,
      ),
    },
    embedding: {
      similarityThreshold: Number(
        process.env.BILL_CLUSTERS_EMBEDDING_SIM_THRESHOLD ?? 0.5,
      ),
      autoConfirmThreshold: Number(
        process.env.BILL_CLUSTERS_EMBEDDING_AUTO_THRESHOLD ?? 0.85,
      ),
    },
    nameSimilarityThreshold: Number(
      process.env.BILL_CLUSTERS_NAME_SIM_THRESHOLD ?? 0.7,
    ),
    aiConfidenceThreshold: Number(
      process.env.BILL_CLUSTERS_AI_CONFIDENCE_THRESHOLD ?? 0.6,
    ),
    aiBatchSize: Number(process.env.BILL_CLUSTERS_AI_BATCH_SIZE ?? 50),
    maxCandidatesPerCluster: Number(
      process.env.BILL_CLUSTERS_MAX_CANDIDATES ?? 10,
    ),
    priorityKnessets: [25, 24, 23, 22, 21, 20] as readonly number[],
  },

  // Bill AI summaries — generated when no official SummaryLaw exists
  billSummary: {
    ai: {
      provider: 'anthropic' as const,
      model: process.env.BILL_SUMMARY_AI_MODEL ?? 'claude-sonnet-4-20250514',
      maxTokens: Number(process.env.BILL_SUMMARY_AI_MAX_TOKENS ?? 2048),
      dailyTokenBudget: Number(
        process.env.BILL_SUMMARY_DAILY_TOKEN_BUDGET ?? 5_000_000,
      ),
    },
    webSearch: {
      /** Tavily search depth: 'basic' (1 credit) or 'advanced' (2 credits) */
      searchDepth: (process.env.BILL_SUMMARY_SEARCH_DEPTH ?? 'basic') as
        | 'basic'
        | 'advanced',
      /** Max search results to feed as context */
      maxResults: Number(process.env.BILL_SUMMARY_SEARCH_MAX_RESULTS ?? 5),
      /** Domains to prioritize in search */
      includeDomains: [
        'knesset.gov.il',
        'main.knesset.gov.il',
        'ynet.co.il',
        'mako.co.il',
        'kan.org.il',
        'walla.co.il',
        'haaretz.co.il',
        'globes.co.il',
        'calcalist.co.il',
      ],
    },
    /** Only generate summaries for bills in these knessets */
    targetKnessets: [25, 24, 23, 22, 21] as readonly number[],
    /** Batch size for AI summary generation */
    batchSize: Number(process.env.BILL_SUMMARY_BATCH_SIZE ?? 100),
    /** Document reader config for bill PDF/DOC text extraction (all local) */
    documentReader: {
      /** Max pages to read from a bill PDF (local extraction via unpdf) */
      maxPages: Number(process.env.BILL_DOC_MAX_PAGES ?? 30),
      /** Max characters of document text to include in prompt */
      maxDocumentChars: Number(process.env.BILL_DOC_MAX_CHARS ?? 8000),
      /** Document type priority (GroupTypeID, highest first) */
      typePriority: [4, 2, 1, 3, 60, 59, 12, 17] as readonly number[],
    },
  },

  // Bug Report → GitHub Issues
  bugReport: {
    github: {
      owner: process.env.BUG_REPORT_GITHUB_OWNER ?? 'Yedidya10',
      repo: process.env.BUG_REPORT_GITHUB_REPO ?? 'knesset-insight',
    },
    /** Max number of images per report */
    maxImages: Number(process.env.BUG_REPORT_MAX_IMAGES ?? 3),
    /** Max single image size in bytes (2 MB) */
    maxImageSizeBytes: Number(
      process.env.BUG_REPORT_MAX_IMAGE_SIZE ?? 2 * 1024 * 1024,
    ),
    /** Rate limit: max reports per hour per IP */
    rateLimitPerHour: Number(process.env.BUG_REPORT_RATE_LIMIT ?? 5),
  },

  // Policy Stances — TheyVoteForYou-style vote classification
  policyStances: {
    ai: {
      /** Model for vote classification */
      model: process.env.STANCE_AI_MODEL ?? 'claude-sonnet-4-20250514',
      /** Max tokens per classification (multi-stance output) */
      maxTokens: Number(process.env.STANCE_AI_MAX_TOKENS ?? 1500),
    },
    /** Confidence threshold for DIRECT stances — below goes to admin review */
    directReviewThreshold: Number(
      process.env.STANCE_DIRECT_REVIEW_THRESHOLD ?? 0.75,
    ),
    /** Confidence threshold for DERIVED stances — higher bar */
    derivedReviewThreshold: Number(
      process.env.STANCE_DERIVED_REVIEW_THRESHOLD ?? 0.85,
    ),
    /** Max votes per batch (for multi-vote bills) */
    batchSize: Number(process.env.STANCE_BATCH_SIZE ?? 15),
    /** Minimum votes needed to display MK/faction score on a stance */
    minVotesForScore: Number(process.env.STANCE_MIN_VOTES ?? 2),
    incrementalBackfill: {
      /** Embedding similarity threshold for pre-filtering bills */
      similarityThreshold: Number(
        process.env.STANCE_SIMILARITY_THRESHOLD ?? 0.3,
      ),
      /** Max bills to send to Claude per incremental backfill */
      maxBillsPerScan: Number(process.env.STANCE_MAX_BILLS_PER_SCAN ?? 2000),
      /** Model for incremental scan */
      model: process.env.STANCE_INCREMENTAL_MODEL ?? 'claude-sonnet-4-20250514',
    },
  },
} as const;

export type Locale = (typeof appConfig.i18n.locales)[number];

export function isRTL(locale: Locale): boolean {
  return (appConfig.i18n.rtlLocales as readonly string[]).includes(locale);
}
