# 🏛️ Knesset Insight — כנסת אינסייט

> פלטפורמה להנגשת המידע הפרלמנטרי של כנסת ישראל

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)

## מה זה?

**Knesset Insight** הוא פרויקט קוד פתוח שמטרתו להנגיש את המידע מאתר הכנסת והגופים הקשורים בצורה אינטואיטיבית וידידותית למשתמש — כדי שאזרחים יוכלו לקבל החלטות מושכלות.

הפלטפורמה מכסה נתונים מהכנסות ה-20 עד ה-25, כולל חברי כנסת, הצבעות, הצעות חוק, ועדות, סיעות, מפלגות, ממשלות, תקציב, ונתוני בחירות.

### תכונות עיקריות

- 📊 **הצבעות וניתוח** — צפייה בהצבעות מליאה, פילוח לפי סיעה, תרשימי התפלגות
- 📜 **מעקב חקיקה** — מעקב אחר הצעות חוק בכל שלבי החקיקה, קישור בין הצעות דומות (Bill Clusters), סיכומי AI
- 👥 **חברי כנסת** — פרופיל מפורט לכל ח"כ: הצבעות, יוזמות חקיקה, עמדות מדיניות, יושרה
- 🏛️ **סיעות וקואליציה** — מבנה הקואליציה, הרכב ממשלות, שינויי סיעות לאורך הזמן
- ⚖️ **יושרה ואתיקה** — מעקב אחרי תלונות אתיקה, קשרי לוביסטים, ניגודי עניינים
- 🗳️ **בחירות 2026** — רשימות מועמדים, סקרים, תחזיות מושבים, מפת הצבעה עירונית
- 🏢 **ועדות** — הרכב ועדות, ישיבות, חברות
- 💰 **תקציב המדינה** — נתוני תקציב מ-Open Budget
- 🌐 **רב-לשוני** — עברית, אנגלית, ערבית, רוסית (עם תמיכת RTL אוטומטית)
- 📱 **PWA** — ניתן להתקנה כאפליקציה, תומך offline

---

## מקורות נתונים

| מקור                 | סוג                                       | קישור                                                                   |
| -------------------- | ----------------------------------------- | ----------------------------------------------------------------------- |
| ממשקי OData של הכנסת | הצעות חוק, הצבעות, חברי כנסת, ועדות       | [knesset.gov.il/Odata](https://knesset.gov.il/Odata/ParliamentInfo.svc) |
| Knesset WebSiteApi   | נתונים מאתר הכנסת                         | `https://knesset.gov.il/WebSiteApi/`                                    |
| כנסת פתוחה (hasadna) | נתונים מעובדים — חברי כנסת, ועדות, הצבעות | [oknesset.org](https://oknesset.org/)                                   |
| מפתח התקציב          | תקציב המדינה והוצאות                      | [next.obudget.org](https://next.obudget.org/)                           |
| רשם המפלגות          | רישום מפלגות                              | `https://registrar.gov.il/`                                             |
| ועדת הבחירות         | תוצאות בחירות עירוניות                    | `https://votes25.bechirot.gov.il/`                                      |

---

## טכנולוגיות

| שכבה                | טכנולוגיות                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Framework**       | Next.js 16, React 19, TypeScript 5                                                                                  |
| **Styling**         | Tailwind CSS 4, shadcn/ui, Framer Motion                                                                            |
| **API**             | tRPC (type-safe end-to-end)                                                                                         |
| **Database**        | Supabase (PostgreSQL + Auth + pgvector), Drizzle ORM                                                                |
| **Cache**           | Upstash Redis (cache + rate limiting)                                                                               |
| **AI**              | Vercel AI SDK, Google Gemini 2.5 Flash (default), OpenAI GPT-4o (fallback), Anthropic Claude (clustering/integrity) |
| **Search**          | pgvector embeddings (text-embedding-004)                                                                            |
| **Background Jobs** | Trigger.dev (cron scheduling, orchestration)                                                                        |
| **i18n**            | next-intl (he, en, ar, ru)                                                                                          |
| **PWA**             | Serwist (service worker, offline)                                                                                   |
| **Maps**            | react-simple-maps + TopoJSON                                                                                        |
| **Charts**          | Recharts, D3                                                                                                        |
| **Infra**           | Vercel, GitHub Actions                                                                                              |

---

## מבנה הפרויקט

```
src/
├── app/[locale]/              # Next.js App Router — דפים לפי locale
│   ├── (public)/              # דפים ציבוריים
│   │   ├── members/           # חברי כנסת + [id]
│   │   ├── votes/             # הצבעות + [id]
│   │   ├── legislation/       # חקיקה + [id] + /laws
│   │   ├── factions/          # סיעות + [id]
│   │   ├── committees/        # ועדות + [id]
│   │   ├── elections/         # בחירות + /2026 + /map + [id]
│   │   ├── governments/       # ממשלות + [id]
│   │   ├── political-groups/  # קבוצות פוליטיות + [slug]
│   │   ├── policies/          # עמדות מדיניות + [stanceId]
│   │   ├── politics/          # ציר פוליטי (tabs)
│   │   ├── budget/            # תקציב
│   │   ├── parties/           # מפלגות רשומות
│   │   └── about/, data-sources/, open-source/, privacy/, terms/
│   └── (dashboard)/           # אזור מנהל (admin)
│       └── admin/             # sync, clusters, integrity, ai-review, activity
├── components/                # קומפוננטות React
│   ├── ui/                    # shadcn/ui (30+ components)
│   ├── elections/             # בחירות + מפת הצבעה
│   ├── legislation/           # חקיקה, stages, clusters
│   ├── members/               # כרטיסי ח"כ, פילטרים
│   ├── integrity/             # יושרה ואתיקה
│   ├── governments/           # קואליציה וממשלות
│   ├── political-groups/      # זרימות פוליטיות
│   ├── policies/              # עמדות מדיניות
│   ├── politics/              # ניווט פוליטי (tabs)
│   ├── charts/                # ויזואליזציות
│   ├── votes/                 # הצבעות
│   ├── admin/                 # עריכה inline, ניהול
│   ├── layout/                # Header, Footer, Theme, i18n
│   └── shared/                # רכיבים משותפים
├── server/                    # tRPC backend
│   └── routers/               # 14 routers: members, votes, bills, factions,
│                              #   elections-2026, election-map, governments,
│                              #   political-groups, political-parties,
│                              #   integrity, policies, bill-clusters,
│                              #   electoral-lists, admin
├── lib/                       # ספריות משותפות
│   ├── ai/                    # Provider abstraction, embeddings, summaries
│   ├── db/                    # Drizzle schema, connection, Redis
│   ├── knesset/               # OData client, API client, transforms
│   ├── auth/                  # Supabase auth helpers
│   └── committees/            # Committee scope utilities
├── pipeline/                  # Data sync (31 jobs)
│   ├── jobs/                  # sync-members, sync-votes, sync-bills,
│   │                          #   sync-committees, compute-bill-clusters,
│   │                          #   generate-bill-summaries, classify-vote-stances...
│   └── seed/                  # Seed data (elections, political groups)
├── trigger/                   # Trigger.dev orchestration (6 jobs)
│   └── sync-core-data, sync-political-data, sync-integrity,
│       sync-bill-relations, analysis-pipeline, run-sync-job
└── i18n/                      # 4 locales: he, en, ar, ru
    └── messages/              # Translation JSON files
```

---

## התחלה מהירה

```bash
# Clone
git clone https://github.com/Yedidya10/knesset-insight.git
cd knesset-insight

# Install
pnpm install

# Setup env
cp .env.example .env.local
# Fill in: DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY,
#          GOOGLE_GENERATIVE_AI_API_KEY, UPSTASH_REDIS_REST_URL,
#          UPSTASH_REDIS_REST_TOKEN, TRIGGER_SECRET_KEY

# DB migrations
pnpm db:push

# Dev
pnpm dev
```

---

## Pipeline — סנכרון נתונים

המערכת מבצעת סנכרון אוטומטי מ-6 מקורות נתונים:

| קבוצה          | תדירות     | תוכן                                       |
| -------------- | ---------- | ------------------------------------------ |
| Core           | כל 6 שעות  | חברי כנסת, הצבעות, הצעות חוק, ועדות        |
| Bill Relations | יומי 01:00 | קשרי הצעות חוק, clusters                   |
| Political      | יומי 03:00 | מפלגות, קואליציה, ממשלות                   |
| Integrity      | יומי 04:00 | אתיקה, לוביסטים                            |
| Analysis       | יומי 05:00 | סיכומי AI, embeddings, vote classification |

כל job תומך ב-incremental sync, retry עם exponential backoff, ו-structured logging.

---

## Admin Dashboard

ממשק ניהול (דורש הרשאת admin) כולל:

- **Sync Status** — מצב סנכרון חי, הפעלה ידנית
- **Bill Clusters** — ניהול קיבוצי הצעות חוק, אישור/דחיית AI
- **Integrity** — עריכת נתוני יושרה
- **AI Review** — בקרת איכות סיכומים ו-clusters
- **Activity Log** — יומן פעולות מנהל

---

## תרומה

תרומות מתקבלות בברכה! פתחו Issue או Pull Request.

## רישיון

[GNU AGPLv3](LICENSE)

הרישיון חל על קוד המקור בלבד. תמונות מוויקיפדיה כפופות לרישיונות שלהן (בדרך כלל CC BY-SA), ותכנים מאתר הכנסת ומכנסת פתוחה כפופים לתנאי השימוש שלהם.
