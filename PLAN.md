# כנסת אינסייט (Knesset Insight) — תוכנית מקיפה

## חזון

פלטפורמה להנגשת המידע הפרלמנטרי של כנסת ישראל בצורה אינטואיטיבית וידידותית למשתמש,
שמאפשרת לאזרחים לקבל החלטות מושכלות — החל מהבנת דפוסי הצבעה של נבחרי ציבור,
דרך ניתוח חלוקת תקציבים ועד מעקב אחרי חקיקה בזמן אמת.

---

## תוכן עניינים

1. [מקורות נתונים](#1-מקורות-נתונים)
2. [ארכיטקטורת המערכת](#2-ארכיטקטורת-המערכת)
3. [טכנולוגיות וכלים](#3-טכנולוגיות-וכלים)
4. [מבנה הפרויקט](#4-מבנה-הפרויקט)
5. [חילוץ נתונים ועדכון שוטף (Data Pipeline)](#5-חילוץ-נתונים-ועדכון-שוטף-data-pipeline)
6. [מודל נתונים (Database Schema)](#6-מודל-נתונים-database-schema)
7. [פיצ'רים למשתמש אנונימי (Public)](#7-פיצרים-למשתמש-אנונימי-public)
8. [פיצ'רים למשתמש רשום (Authenticated)](#8-פיצרים-למשתמש-רשום-authenticated)
9. [שילוב AI](#9-שילוב-ai)
10. [עיצוב UI/UX](#10-עיצוב-uiux)
11. [אבטחה וביצועים](#11-אבטחה-וביצועים)
12. [תשתית ו-DevOps](#12-תשתית-ו-devops)
13. [בדיקות](#13-בדיקות)
14. [שלבי פיתוח (Roadmap)](#14-שלבי-פיתוח-roadmap)
15. [הרחבות עתידיות](#15-הרחבות-עתידיות)

---

## 1. מקורות נתונים

### 1.1 ממשקי OData הרשמיים של הכנסת

הכנסת חושפת מספר שירותי OData שמספקים נתונים מובנים:

| שירות | כתובת | תוכן |
|--------|--------|-------|
| **ParliamentInfo** | `https://knesset.gov.il/Odata/ParliamentInfo.svc` | הצעות חוק (`KNS_Bill`), יוזמי חקיקה (`KNS_BillInitiator`), שמות הצעות חוק, סדר יום, ועוד |
| **Votes** | `https://knesset.gov.il/Odata/Votes.svc` | תוצאות הצבעות (`View_vote_rslts_hdr_Approved`), הצבעות לפי חבר כנסת (`vote_rslts_kmmbr_shadow`), סוגי תוצאות |
| **MMM** | `https://knesset.gov.il/Odata/MMM.svc` | מסמכי מחקר, קטגוריות, מילות מפתח |

> **הערה**: ממשקי OData תומכים ב-`$filter`, `$top`, `$skip`, `$orderby`, `$select` — ניתן לבצע שאילתות מסוננות ועימוד ישירות.

### 1.2 כנסת פתוחה (Open Knesset / hasadna)

פרויקט הסדנא לידע ציבורי מספק נתונים מעובדים ומועשרים:

| מקור | כתובת | תוכן |
|------|--------|-------|
| **קבצי CSV** | `https://production.oknesset.org/pipelines/data/` | bills, committees, knesset, laws, lobbyists, members, people, plenum, votes |
| **Redash** | `https://redash.hasadna.org.il/` | גישת SQL למסד הנתונים (data source: `next-oknesset`) |
| **GitHub** | `https://github.com/hasadna/knesset-data-pipelines` | קוד הסריקה והעיבוד |

#### טבלאות מרכזיות זמינות:

- **חברי כנסת**: `members/kns_person`, `members/mk_individual`, `members/kns_persontoposition`, `members/presence`
- **הצבעות**: `votes/view_vote_rslts_hdr_approved`, `votes/vote_rslts_kmmbr_shadow`
- **חוקים**: `laws/kns_israel_law`, `laws/kns_israel_law_name`, `laws/kns_israel_law_classification`
- **הצעות חוק**: `bills/kns_bill`, `bills/kns_billinitiator`
- **ועדות**: `committees/kns_committee`, `committees/kns_committeesession`, `committees/kns_cmtsessionitem`
- **מליאה**: `plenum/kns_plenumsession`, `plenum/kns_plmsessionitem`
- **לוביסטים**: `lobbyists/v_lobbyist`, `lobbyists/v_lobbyist_clients`
- **אנשים**: `people/committee-meeting-attendees`, `people/committee-meeting-speaker-stats`

### 1.3 מפתח התקציב (Open Budget)

| מקור | כתובת | תוכן |
|------|--------|-------|
| **אתר** | `https://next.obudget.org/` | תקציב המדינה, הוצאות ממשלה, מכרזים, העברות תקציביות |
| **API** | `https://next.obudget.org/api/` | חיפוש וגישה לנתוני תקציב |
| **GitHub** | `https://github.com/OpenBudget/BudgetKey` | קוד המקור |

### 1.4 מקורות נוספים

- **אתר הכנסת הראשי**: `https://main.knesset.gov.il` — פרסומים, חדשות, מידע על ישיבות
- **פרוטוקולים**: פרוטוקולי ועדות ומליאה (טקסט מלא, חלוקה לדוברים)
- **ספר החוקים**: חוקי מדינת ישראל

---

## 2. ארכיטקטורת המערכת

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Next.js App)                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │  דשבורד  │ │ חברי כנסת│ │  הצבעות  │ │  חקיקה   │ │  תקציב   │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────────────────────────┐│
│  │  חיפוש   │ │ AI Chat  │ │           פרופיל משתמש                ││
│  └──────────┘ └──────────┘ └──────────────────────────────────────┘│
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                   ┌───────────▼───────────┐
                   │    API Layer (tRPC)    │
                   │    Next.js Route       │
                   │    Handlers            │
                   └───────────┬───────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                     │
┌─────────▼─────────┐ ┌───────▼──────┐ ┌────────────▼────────────┐
│   PostgreSQL (DB)  │ │  Redis Cache │ │   AI Services           │
│   via Supabase     │ │              │ │   ┌──────────────────┐  │
│                    │ │              │ │   │  OpenAI / Gemini  │  │
│  • חברי כנסת      │ │  • API cache │ │   │  RAG Pipeline     │  │
│  • הצבעות         │ │  • Sessions  │ │   │  Vector Search    │  │
│  • חוקים          │ │  • Rate limit│ │   └──────────────────┘  │
│  • תקציב          │ │              │ │                          │
│  • משתמשים        │ │              │ │                          │
└───────────────────┘ └──────────────┘ └──────────────────────────┘
          ▲
          │
┌─────────┴──────────────────────────────────────┐
│          Data Pipeline (Scheduled Jobs)          │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ OData    │ │ OKnesset │ │ Budget Scraper   │ │
│  │ Fetcher  │ │ Sync     │ │                  │ │
│  └──────────┘ └──────────┘ └──────────────────┘ │
└──────────────────────────────────────────────────┘
```

---

## 3. טכנולוגיות וכלים

### 3.1 Frontend

| טכנולוגיה | שימוש | הסבר |
|-----------|-------|------|
| **Next.js 15 (App Router)** | מסגרת עבודה | SSR/SSG, API routes, middleware, ISR |
| **React 19** | ספריית UI | Server Components, Suspense, streaming |
| **TypeScript** | שפה | Type safety מלא |
| **Tailwind CSS 4** | עיצוב | Utility-first, RTL support מובנה |
| **shadcn/ui** | קומפוננטות | Accessible, customizable components |
| **Recharts / Nivo** | ויזואליזציה | גרפים ותרשימים אינטראקטיביים |
| **TanStack Table** | טבלאות | Sorting, filtering, pagination |
| **Framer Motion** | אנימציות | Smooth transitions |
| **next-intl** | i18n | תמיכה בעברית, אנגלית, ערבית ורוסית עם RTL אוטומטי |
| **next-pwa (serwist)** | PWA | Service Worker, offline support, התקנה כאפליקציה |

### 3.2 Backend

| טכנולוגיה | שימוש | הסבר |
|-----------|-------|------|
| **Next.js API Routes / Route Handlers** | API | Serverless API endpoints |
| **tRPC** | Type-safe API | End-to-end typesafety בין client ל-server |
| **Supabase** | מסד נתונים + Auth | PostgreSQL, Row Level Security, Auth, Realtime |
| **Drizzle ORM** | ORM | Type-safe queries, migrations, schema management |
| **Redis (Upstash)** | Cache + Rate limiting | Serverless Redis |
| **Zod** | Validation | Schema validation for API inputs |

### 3.3 Data Pipeline

| טכנולוגיה | שימוש | הסבר |
|-----------|-------|------|
| **Trigger.dev** | Scheduled Jobs | Serverless background jobs, cron scheduling |
| **node-fetch / ofetch** | HTTP client | קריאות ל-OData APIs ו-CSV downloads |
| **fast-xml-parser** | XML parsing | פירוק תשובות OData (XML/Atom format) |
| **csv-parse** | CSV parsing | עיבוד קבצי CSV מ-Open Knesset |
| **Cheerio** | Web scraping | חילוץ מידע מדפי HTML של הכנסת (במידת הצורך) |

### 3.4 AI & Search

| טכנולוגיה | שימוש | הסבר |
|-----------|-------|------|
| **Google Gemini API (gemini-2.5-flash)** | LLM ברירת מחדל | סיכום, ניתוח, שאלות ותשובות — ניתן להחלפה דרך `AI_PROVIDER` env var |
| **OpenAI API (GPT-4o)** | LLM חלופי | Fallback / אפשרות החלפה דרך config |
| **Vercel AI SDK** | AI integration | Streaming, tool calling, structured output — abstraction layer מעל providers שונים |
| **Supabase pgvector** | Vector DB | שמירת embeddings לחיפוש סמנטי |
| **Google Embeddings / OpenAI Embeddings** | Embeddings | המרת טקסט לווקטורים — provider נבחר דרך `EMBEDDING_PROVIDER` env var |

### 3.5 תשתית

| טכנולוגיה | שימוש | הסבר |
|-----------|-------|------|
| **Vercel** | Hosting + CDN | Deployment, Edge Functions, ISR |
| **Supabase (hosted)** | Database hosting | PostgreSQL, Auth, Storage |
| **Upstash** | Redis hosting | Serverless Redis |
| **GitHub Actions** | CI/CD | Automated testing, deployment |

---

## 4. מבנה הפרויקט

```
knesset-insight/
├── .github/
│   └── workflows/
│       ├── ci.yml              # Lint, Type Check, Test
│       └── deploy.yml          # Vercel deployment
├── public/
│   ├── og-image.png
│   ├── favicon.ico
│   ├── icons/                  # PWA icons (192x192, 512x512, maskable)
│   └── sw.js                   # Service Worker (generated by serwist)
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (public)/           # דפים ציבוריים (אנונימי)
│   │   │   ├── page.tsx                  # דף הבית / דשבורד
│   │   │   ├── members/
│   │   │   │   ├── page.tsx              # רשימת חברי כנסת
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx          # פרופיל חבר כנסת
│   │   │   ├── votes/
│   │   │   │   ├── page.tsx              # הצבעות אחרונות
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx          # פרטי הצבעה
│   │   │   ├── legislation/
│   │   │   │   ├── page.tsx              # חקיקה - הצעות חוק
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx          # פרטי הצעת חוק
│   │   │   ├── parties/
│   │   │   │   ├── page.tsx              # סיעות
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx          # פרופיל סיעה
│   │   │   ├── budget/
│   │   │   │   ├── page.tsx              # סקירת תקציב
│   │   │   │   └── [category]/
│   │   │   │       └── page.tsx          # תקציב לפי קטגוריה
│   │   │   ├── committees/
│   │   │   │   ├── page.tsx              # ועדות
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx          # פרטי ועדה
│   │   │   ├── compare/
│   │   │   │   └── page.tsx              # השוואת חברי כנסת / סיעות
│   │   │   └── search/
│   │   │       └── page.tsx              # חיפוש כללי
│   │   ├── (auth)/             # דפי אימות
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   └── callback/route.ts
│   │   ├── (dashboard)/        # דפי משתמש רשום
│   │   │   ├── dashboard/page.tsx        # דשבורד אישי
│   │   │   ├── watchlist/page.tsx        # רשימת מעקב
│   │   │   ├── alerts/page.tsx           # התראות
│   │   │   └── settings/page.tsx         # הגדרות
│   │   ├── api/
│   │   │   ├── trpc/[trpc]/route.ts      # tRPC handler
│   │   │   ├── ai/chat/route.ts          # AI Chat endpoint
│   │   │   └── cron/
│   │   │       └── sync/route.ts         # Cron trigger endpoint
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── charts/             # תרשימים וויזואליזציות
│   │   │   ├── VoteDistributionChart.tsx
│   │   │   ├── BudgetTreemap.tsx
│   │   │   ├── MemberVoteHeatmap.tsx
│   │   │   ├── PartyAlignmentChart.tsx
│   │   │   ├── LegislationTimeline.tsx
│   │   │   └── AttendanceChart.tsx
│   │   ├── members/            # קומפוננטות חברי כנסת
│   │   │   ├── MemberCard.tsx
│   │   │   ├── MemberProfile.tsx
│   │   │   ├── MemberVoteHistory.tsx
│   │   │   └── MemberCompare.tsx
│   │   ├── votes/              # קומפוננטות הצבעות
│   │   │   ├── VoteCard.tsx
│   │   │   ├── VoteDetail.tsx
│   │   │   └── VoteBreakdown.tsx
│   │   ├── legislation/        # קומפוננטות חקיקה
│   │   │   ├── BillCard.tsx
│   │   │   ├── BillTimeline.tsx
│   │   │   └── BillDetail.tsx
│   │   ├── budget/             # קומפוננטות תקציב
│   │   │   ├── BudgetOverview.tsx
│   │   │   ├── BudgetComparison.tsx
│   │   │   └── SpendingBreakdown.tsx
│   │   ├── ai/                 # קומפוננטות AI
│   │   │   ├── AiChatPanel.tsx
│   │   │   ├── AiSummary.tsx
│   │   │   └── AiInsightCard.tsx
│   │   ├── search/
│   │   │   ├── SearchBar.tsx
│   │   │   └── SearchResults.tsx
│   │   └── layout/
│   │       ├── Header.tsx
│   │       ├── Sidebar.tsx
│   │       ├── Footer.tsx
│   │       └── MobileNav.tsx
│   ├── server/
│   │   ├── routers/            # tRPC routers
│   │   │   ├── _app.ts
│   │   │   ├── members.ts
│   │   │   ├── votes.ts
│   │   │   ├── bills.ts
│   │   │   ├── parties.ts
│   │   │   ├── budget.ts
│   │   │   ├── committees.ts
│   │   │   ├── search.ts
│   │   │   ├── ai.ts
│   │   │   └── user.ts
│   │   ├── trpc.ts             # tRPC initialization
│   │   └── context.ts          # tRPC context
│   ├── lib/
│   │   ├── db/
│   │   │   ├── schema.ts       # Drizzle schema
│   │   │   ├── migrations/     # DB migrations
│   │   │   └── index.ts        # DB client
│   │   ├── knesset/
│   │   │   ├── odata-client.ts     # OData API client
│   │   │   ├── oknesset-client.ts  # Open Knesset data client
│   │   │   ├── types.ts            # Knesset data types
│   │   │   └── transforms.ts       # Data transformations
│   │   ├── budget/
│   │   │   ├── budget-client.ts    # Budget API client
│   │   │   └── types.ts
│   │   ├── ai/
│   │   │   ├── provider.ts          # AI provider abstraction (Gemini/OpenAI)
│   │   │   ├── chat.ts              # AI chat logic
│   │   │   ├── embeddings.ts        # Embedding generation
│   │   │   ├── rag.ts               # RAG pipeline
│   │   │   └── prompts.ts           # System prompts
│   │   ├── auth/
│   │   │   └── index.ts            # Supabase auth helpers
│   │   ├── cache.ts                # Redis cache helpers
│   │   ├── config.ts               # Reads app.config.ts + env vars
│   │   └── utils.ts                # Utility functions
│   ├── pipeline/               # Data sync pipeline
│   │   ├── jobs/
│   │   │   ├── sync-members.ts
│   │   │   ├── sync-votes.ts
│   │   │   ├── sync-bills.ts
│   │   │   ├── sync-committees.ts
│   │   │   ├── sync-budget.ts
│   │   │   └── generate-embeddings.ts
│   │   ├── schedule.ts         # Cron schedule definitions
│   │   └── utils.ts            # Pipeline utilities
│   ├── hooks/                  # React hooks
│   │   ├── useSearch.ts
│   │   ├── useMember.ts
│   │   └── useAiChat.ts
│   ├── i18n/
│   │   ├── he.json             # Hebrew translations
│   │   ├── en.json             # English translations
│   │   ├── ar.json             # Arabic translations
│   │   └── ru.json             # Russian translations
│   └── types/                  # Shared TypeScript types
│       ├── member.ts
│       ├── vote.ts
│       ├── bill.ts
│       ├── budget.ts
│       └── user.ts
├── supabase/
│   ├── migrations/             # SQL migrations
│   └── seed.sql                # Seed data
├── drizzle/
│   └── drizzle.config.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .env.example
├── .eslintrc.json
├── .gitignore
├── next.config.ts
├── package.json
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig.json
├── app.config.ts               # קונפיגורציה מרכזית (limits, features, locales)
├── manifest.json               # PWA Web App Manifest
├── PLAN.md                     # (הקובץ הזה)
└── README.md
```

---

## 5. חילוץ נתונים ועדכון שוטף (Data Pipeline)

### 5.1 אסטרטגיית סנכרון

שלושה מקורות נתונים עיקריים, כל אחד עם אסטרטגיה שונה:

#### א. OData APIs של הכנסת (נתונים חיים)

```
תדירות: כל 6 שעות
שיטה: Incremental sync לפי שדות תאריך עדכון
```

**תהליך:**
1. שמירת `lastSyncTimestamp` לכל entity
2. שליחת בקשת OData עם `$filter=LastUpdatedDate gt datetime'...'`
3. עדכון/הוספת רשומות ב-DB
4. עדכון `lastSyncTimestamp`

**Entities לסנכרון:**
- `KNS_Bill` + `KNS_BillInitiator` + `KNS_BillName` — הצעות חוק
- `vote_rslts_kmmbr_shadow` + `View_vote_rslts_hdr_Approved` — הצבעות
- `KNS_Agenda` — סדר יום

**דוגמת שאילתה:**
```
GET https://knesset.gov.il/Odata/ParliamentInfo.svc/KNS_Bill
    ?$filter=LastUpdatedDate gt datetime'2026-03-29T00:00:00'
    &$orderby=LastUpdatedDate desc
    &$top=100
    &$skip=0
```

#### ב. Open Knesset CSV (נתונים מעובדים)

```
תדירות: יומי (03:00 בלילה)
שיטה: Compare hash → full/incremental download
```

**תהליך:**
1. בדיקת `ETag` / `Last-Modified` header כנגד ערך שמור
2. אם השתנה — הורדת CSV, parsing, upsert למסד הנתונים
3. עדכון hash שמור

**קבצים לסנכרון:**
- `members/mk_individual` — פרופילי חברי כנסת
- `votes/view_vote_rslts_hdr_approved` — সুতোצאות הצבעות
- `votes/vote_rslts_kmmbr_shadow` — הצבעות פרטניות
- `committees/kns_committeesession` — ישיבות ועדות
- `members/presence` — נוכחות

#### ג. מפתח התקציב (נתוני תקציב)

```
תדירות: שבועי (יום שישי 02:00)
שיטה: API calls עם cache invalidation
```

### 5.2 ארכיטקטורת Pipeline

```typescript
// pipeline/jobs/sync-votes.ts — דוגמה מפושטת
import { schedules } from "@trigger.dev/sdk/v3";

export const syncVotes = schedules.task({
  id: "sync-votes",
  cron: "0 */6 * * *", // כל 6 שעות
  run: async () => {
    const lastSync = await getLastSyncTime("votes");

    // 1. Fetch from OData
    const newVotes = await fetchODataVotes(lastSync);

    // 2. Transform to internal schema
    const transformed = newVotes.map(transformVote);

    // 3. Upsert to database
    await db.insert(votes).values(transformed).onConflictDoUpdate(/* ... */);

    // 4. Invalidate cache
    await redis.del("votes:latest", "votes:stats");

    // 5. Generate embeddings for new items
    await generateEmbeddings(transformed);

    // 6. Update sync timestamp
    await setLastSyncTime("votes", new Date());
  },
});
```

### 5.3 טיפול בשגיאות ומוניטורינג

- **Retry Policy**: 3 ניסיונות עם exponential backoff
- **Dead Letter Queue**: שגיאות שחוזרות נשמרות לטיפול ידני
- **Health Check endpoint**: `/api/cron/health` — מחזיר סטטוס עדכניות הנתונים
- **Alerting**: שליחת notification (email/Slack) אם סנכרון נכשל 3 פעמים ברצף
- **Logging**: structured logging עם מזהה ייחודי לכל sync run

---

## 6. מודל נתונים (Database Schema)

### 6.1 טבלאות ליבה

```sql
-- חברי כנסת
CREATE TABLE members (
    id              SERIAL PRIMARY KEY,
    knesset_id      INTEGER UNIQUE NOT NULL, -- מזהה מהכנסת
    first_name      TEXT NOT NULL,
    last_name       TEXT NOT NULL,
    party_id        INTEGER REFERENCES parties(id),
    is_current      BOOLEAN DEFAULT false,
    gender          TEXT,
    birth_date      DATE,
    image_url       TEXT,
    email           TEXT,
    phone           TEXT,
    start_date      DATE,
    end_date        DATE,
    knesset_num     INTEGER,
    is_coalition    BOOLEAN,
    metadata        JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- סיעות
CREATE TABLE parties (
    id              SERIAL PRIMARY KEY,
    knesset_id      INTEGER UNIQUE NOT NULL,
    name            TEXT NOT NULL,
    knesset_num     INTEGER,
    is_coalition    BOOLEAN DEFAULT false,
    seats           INTEGER,
    color           TEXT, -- צבע לתצוגה
    logo_url        TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- הצבעות (כותרות)
CREATE TABLE votes (
    id              SERIAL PRIMARY KEY,
    knesset_id      INTEGER UNIQUE NOT NULL,
    title           TEXT NOT NULL,
    vote_date       TIMESTAMPTZ NOT NULL,
    vote_type       TEXT,
    knesset_num     INTEGER,
    session_id      INTEGER,
    bill_id         INTEGER REFERENCES bills(id),
    for_count       INTEGER DEFAULT 0,
    against_count   INTEGER DEFAULT 0,
    abstain_count   INTEGER DEFAULT 0,
    is_accepted     BOOLEAN,
    summary         TEXT, -- סיכום AI
    metadata        JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- הצבעות פרטניות
CREATE TABLE member_votes (
    id              SERIAL PRIMARY KEY,
    vote_id         INTEGER REFERENCES votes(id) NOT NULL,
    member_id       INTEGER REFERENCES members(id) NOT NULL,
    vote_value      TEXT NOT NULL, -- 'for', 'against', 'abstain', 'absent'
    UNIQUE(vote_id, member_id)
);

-- הצעות חוק
CREATE TABLE bills (
    id              SERIAL PRIMARY KEY,
    knesset_id      INTEGER UNIQUE NOT NULL,
    name            TEXT NOT NULL,
    summary         TEXT,
    status          TEXT,
    bill_type       TEXT,
    knesset_num     INTEGER,
    proposed_date   DATE,
    last_update     TIMESTAMPTZ,
    category        TEXT,
    full_text_url   TEXT,
    ai_summary      TEXT, -- סיכום AI
    metadata        JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- יוזמי הצעות חוק
CREATE TABLE bill_initiators (
    id              SERIAL PRIMARY KEY,
    bill_id         INTEGER REFERENCES bills(id) NOT NULL,
    member_id       INTEGER REFERENCES members(id) NOT NULL,
    is_primary      BOOLEAN DEFAULT false,
    UNIQUE(bill_id, member_id)
);

-- ועדות
CREATE TABLE committees (
    id              SERIAL PRIMARY KEY,
    knesset_id      INTEGER UNIQUE NOT NULL,
    name            TEXT NOT NULL,
    committee_type  TEXT,
    knesset_num     INTEGER,
    is_active       BOOLEAN DEFAULT true,
    chairman_id     INTEGER REFERENCES members(id),
    metadata        JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ישיבות ועדה
CREATE TABLE committee_sessions (
    id              SERIAL PRIMARY KEY,
    knesset_id      INTEGER UNIQUE NOT NULL,
    committee_id    INTEGER REFERENCES committees(id) NOT NULL,
    session_date    TIMESTAMPTZ,
    title           TEXT,
    protocol_url    TEXT,
    topics          TEXT[],
    ai_summary      TEXT,
    metadata        JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- תקציב
CREATE TABLE budget_items (
    id              SERIAL PRIMARY KEY,
    budget_code     TEXT NOT NULL,
    year            INTEGER NOT NULL,
    title           TEXT NOT NULL,
    amount_allocated BIGINT, -- בש"ח
    amount_used      BIGINT,
    parent_code     TEXT,
    depth           INTEGER,
    ministry        TEXT,
    metadata        JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(budget_code, year)
);
```

### 6.2 טבלאות משתמשים

```sql
-- משתמשים (Supabase Auth מנהל את הטבלה הראשית)
CREATE TABLE user_profiles (
    id              UUID PRIMARY KEY REFERENCES auth.users(id),
    display_name    TEXT,
    avatar_url      TEXT,
    preferred_lang  TEXT DEFAULT 'he',
    notification_email BOOLEAN DEFAULT true,
    notification_push  BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- מעקב אחרי חברי כנסת
CREATE TABLE user_watched_members (
    id              SERIAL PRIMARY KEY,
    user_id         UUID REFERENCES user_profiles(id) NOT NULL,
    member_id       INTEGER REFERENCES members(id) NOT NULL,
    notify_votes    BOOLEAN DEFAULT true,
    notify_bills    BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, member_id)
);

-- מעקב אחרי נושאים
CREATE TABLE user_watched_topics (
    id              SERIAL PRIMARY KEY,
    user_id         UUID REFERENCES user_profiles(id) NOT NULL,
    topic           TEXT NOT NULL,
    keywords        TEXT[],
    notify          BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- מעקב אחרי הצעות חוק
CREATE TABLE user_watched_bills (
    id              SERIAL PRIMARY KEY,
    user_id         UUID REFERENCES user_profiles(id) NOT NULL,
    bill_id         INTEGER REFERENCES bills(id) NOT NULL,
    notify          BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, bill_id)
);

-- התראות
CREATE TABLE notifications (
    id              SERIAL PRIMARY KEY,
    user_id         UUID REFERENCES user_profiles(id) NOT NULL,
    type            TEXT NOT NULL, -- 'vote', 'bill_update', 'committee', 'custom'
    title           TEXT NOT NULL,
    body            TEXT,
    link            TEXT,
    is_read         BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- היסטוריית חיפושים (אופציונלי)
CREATE TABLE user_search_history (
    id              SERIAL PRIMARY KEY,
    user_id         UUID REFERENCES user_profiles(id) NOT NULL,
    query           TEXT NOT NULL,
    results_count   INTEGER,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 6.3 טבלאות AI / Vector Search

```sql
-- Embeddings לחיפוש סמנטי
CREATE TABLE document_embeddings (
    id              SERIAL PRIMARY KEY,
    source_type     TEXT NOT NULL, -- 'bill', 'vote', 'protocol', 'law'
    source_id       INTEGER NOT NULL,
    chunk_index     INTEGER DEFAULT 0,
    content         TEXT NOT NULL,
    embedding       vector(768),  -- Gemini text-embedding-004 (768d) — dimension configurable via EMBEDDING_DIMENSIONS
    metadata        JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- אינדקס לחיפוש וקטורי (IVFFlat או HNSW)
CREATE INDEX ON document_embeddings
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
```

### 6.4 Row Level Security (RLS)

```sql
-- Public data: כולם יכולים לקרוא
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_public_read" ON members FOR SELECT USING (true);

-- User data: רק המשתמש עצמו
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_data" ON user_profiles
    FOR ALL USING (auth.uid() = id);

ALTER TABLE user_watched_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "watched_own" ON user_watched_members
    FOR ALL USING (auth.uid() = user_id);

-- וכולי לכל טבלאות ה-user_*
```

---

## 7. פיצ'רים למשתמש אנונימי (Public)

כל המידע הפרלמנטרי הבסיסי נגיש **בלי הרשמה**:

### 7.1 דשבורד ראשי

- **סטטיסטיקות מהירות**: מספר הצבעות השבוע, הצעות חוק חדשות, ישיבות ועדות
- **הצבעה אחרונה בולטת**: כרטיס עם תוצאות ופיצול לפי סיעות
- **חקיקה בתהליך**: הצעות חוק בשלבים מתקדמים
- **תובנות AI**: "היום בכנסת" — סיכום יומי אוטומטי

### 7.2 חברי כנסת

- **רשימה מלאה**: סינון לפי סיעה, קואליציה/אופוזיציה, ועדות
- **פרופיל חבר כנסת**:
  - מידע אישי ותמונה
  - סיעה נוכחית והיסטוריית סיעות
  - **דפוס הצבעה** — גרף חום (heatmap) של כל ההצבעות
  - **הצעות חוק שיזם** — רשימה עם סטטוס
  - **נוכחות** — אחוז נוכחות במליאה ובועדות
  - **תפקידים** — ועדות, שרים, וכו'
  - **ציון התאמה לקואליציה** — אחוז הצבעות בהתאם לקו הקואליציה
  - **נושאים מרכזיים** — Word cloud מחילוץ AI מהצעות חוק ודיבורים

### 7.3 הצבעות

- **רשימת הצבעות**: סינון לפי תאריך, נושא, תוצאה
- **פרטי הצבעה**:
  - תוצאה: בעד/נגד/נמנעים עם מספרים
  - **פיצול לפי סיעות** — bar chart צבעוני
  - **רשימת מצביעים** — עם קישור לפרופיל
  - **הסבר AI** — "מה המשמעות של ההצבעה הזו?"
  - **הקשר** — קישור להצעת חוק הרלוונטית

### 7.4 חקיקה

- **הצעות חוק פעילות**: סינון לפי שלב, נושא, יוזם
- **Timeline חקיקה** — ציר זמן ויזואלי של שלבי הצעת חוק
- **פרטי הצעת חוק**:
  - שם, תקציר (AI), סטטוס נוכחי
  - יוזמים (חברי כנסת)
  - הצבעות קשורות
  - דיונים בועדות
  - **סיכום AI** — "מה ההצעה הזו אומרת בשפה פשוטה?"

### 7.5 סיעות ומפלגות

- **רשימת סיעות**: קואליציה vs אופוזיציה
- **פרופיל סיעה**:
  - חברי כנסת
  - **ציון משמעת סיעתית** — אחוז הצבעות "עם השורה"
  - **נושאים מרכזיים** — באילו תחומי חקיקה הסיעה פעילה
  - **השוואה בין סיעות** — גרף רדאר

### 7.6 תקציב

- **TreeMap אינטראקטיבי** — חלוקת תקציב לפי משרדים
- **השוואה שנתית** — כמה הוקצה לכל תחום לאורך שנים
- **Drill-down** — מתקציב כללי עד לסעיף ספציפי
- **הוצאות בפועל vs תקציב מאושר**

### 7.7 ועדות

- **רשימת ועדות**: עם כמות ישיבות ונושאים אחרונים
- **ועדה ספציפית**:
  - חברים
  - ישיבות אחרונות עם סיכום AI
  - נושאים שנדונו

### 7.8 השוואות

- **השוואת חברי כנסת** — בחירת 2-4 ח"כים והשוואת:
  - דפוסי הצבעה
  - תחומי פעילות
  - נוכחות
  - הצעות חוק
- **השוואת סיעות** — אותו דבר ברמת סיעה

### 7.9 חיפוש

- **חיפוש טקסט חופשי** — חיפוש בהצעות חוק, הצבעות, פרוטוקולים
- **חיפוש סמנטי** — "חוקים שעוסקים בדיור" (באמצעות vector search)
- **Auto-complete** — הצעות תוך כדי הקלדה
- **פילטרים** — סוג (חוק/הצבעה/פרוטוקול), תאריך, סיעה

### 7.10 AI Chat

> **AI Chat זמין למשתמשים רשומים בלבד.**
> משתמש אנונימי יראה הנעה להרשמה כדי לגשת לצ'אט AI.
> ראה סעיף 8.4 לפירוט.

---

## 8. פיצ'רים למשתמש רשום (Authenticated)

הפיצ'רים הציבוריים **פלוס** התוספות הבאות:

### 8.1 דשבורד אישי

- **Feed מותאם אישית** — הצבעות וחקיקה של חברי כנסת במעקב
- **סיכום שבועי** — "מה עשו הח"כים שאתה עוקב אחריהם השבוע?"
- **התראות**: badge עם מספר התראות חדשות

### 8.2 מעקב (Watchlist)

- **מעקב אחרי חברי כנסת** — קבלת עדכון כשח"כ מצביע או מציע חוק
- **מעקב אחרי הצעות חוק** — עדכון כשהצעה מתקדמת בשלבים
- **מעקב אחרי נושאים** — הגדרת מילות מפתח ("חינוך", "ביטחון")
- **מעקב אחרי ועדות** — עדכון על ישיבות חדשות

### 8.3 התראות

- **In-app notifications** — בתוך האתר
- **Email digest** — סיכום יומי/שבועי (configurable)
- **Push notifications** — דרך Web Push API (אופציונלי)
- **סוגי התראות**:
  - "חבר כנסת X הצביע נגד חוק Y"
  - "הצעת חוק Z עברה לשלב הבא"
  - "ישיבת ועדה חדשה בנושא שמעניין אותך"
  - "סיכום שבועי מוכן"

### 8.4 AI Chat (למשתמשים רשומים בלבד)

- **מגבלת שיחות יומית** — מוגדרת דרך `AI_DAILY_CHAT_LIMIT` env var (ברירת מחדל: 20 שיחות ליום)
- **שאלות ותשובות** — "איך הצביע חבר כנסת X על חוק Y?"
- **היסטוריית שיחות** — אפשר לחזור לשאלות קודמות
- **שאילתות מורכבות** — "השווה את דפוסי ההצבעה של ח"כ A ו-ח"כ B בנושאי סביבה"
- **ייצוא** — אפשר לייצא תשובות AI כ-PDF
- **לינקים למקורות** — כל תשובה מלווה בקישורים למידע המקורי
- **Rate limiting** — נאכף ב-Redis (Upstash) עם מונה יומי per-user

### 8.5 הגדרות אישיות

- **שפה** — עברית / אנגלית / ערבית / רוסית
- **תדירות התראות**
- **נושאים מועדפים** — מתאימים את ה-feed
- **מצב כהה/בהיר**

### 8.6 שמירה וייצוא

- **שמירת הצבעות/חוקים מועדפים** — Bookmarks
- **ייצוא נתונים** — CSV/PDF של תוצאות חיפוש
- **שיתוף** — קישורים ייחודיים להשוואות ותובנות

---

## 9. שילוב AI

### 9.1 ארכיטקטורת AI

```
                    שאלת משתמש
                         │
                    ┌────▼────┐
                    │  Router  │ ← מזהה כוונת שאלה
                    └────┬────┘
                         │
            ┌────────────┼────────────┐
            │            │            │
      ┌─────▼─────┐ ┌───▼────┐ ┌────▼─────┐
      │  Direct DB │ │  RAG   │ │ Summary  │
      │  Query     │ │ Search │ │ Generate │
      └─────┬─────┘ └───┬────┘ └────┬─────┘
            │            │            │
            └────────────┼────────────┘
                         │
                  ┌──────▼──────┐
                  │   LLM Call  │ ← Gemini (default) / GPT-4o (fallback)
                  │   + Context │
                  └──────┬──────┘
                         │
                   ┌─────▼─────┐
                   │  Response  │ ← עם מקורות
                   └───────────┘
```

### 9.2 RAG Pipeline (Retrieval-Augmented Generation)

**שלב 1: Indexing (בזמן Data Sync)**
```typescript
// כל פעם שנתון חדש מתווסף, יוצרים embedding
async function indexDocument(type: string, id: number, text: string) {
  // 1. Split to chunks (max 500 tokens)
  const chunks = splitToChunks(text, 500);

  // 2. Generate embeddings
  const embeddings = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: chunks.map(c => c.text),
  });

  // 3. Store in pgvector
  for (let i = 0; i < chunks.length; i++) {
    await db.insert(documentEmbeddings).values({
      sourceType: type,
      sourceId: id,
      chunkIndex: i,
      content: chunks[i].text,
      embedding: embeddings.data[i].embedding,
      metadata: { title: chunks[i].title },
    });
  }
}
```

**שלב 2: Retrieval (בזמן שאילתה)**
```typescript
async function retrieveContext(query: string, limit = 5) {
  const queryEmbedding = await generateEmbedding(query);

  // Vector similarity search
  const results = await db.execute(sql`
    SELECT content, source_type, source_id, metadata,
           1 - (embedding <=> ${queryEmbedding}::vector) as similarity
    FROM document_embeddings
    WHERE 1 - (embedding <=> ${queryEmbedding}::vector) > 0.7
    ORDER BY similarity DESC
    LIMIT ${limit}
  `);

  return results;
}
```

**שלב 3: Generation**
```typescript
import { getAIClient } from '@/lib/ai/provider';

// Provider נבחר אוטומטית לפי AI_PROVIDER env var (default: 'gemini')
const ai = getAIClient();

const response = await ai.chat.completions.create({
  model: AI_CONFIG.defaultModel, // gemini-2.5-flash / gpt-4o — configurable
  messages: [
    { role: "system", content: KNESSET_SYSTEM_PROMPT },
    { role: "user", content: buildPromptWithContext(query, retrievedDocs) },
  ],
  stream: true,
});
```

### 9.3 שימושי AI ספציפיים

| פיצ'ר | תיאור | מודל |
|-------|--------|------|
| **סיכום הצעת חוק** | תרגום שפה משפטית לשפה פשוטה | Gemini (configurable) |
| **סיכום ישיבת ועדה** | סיכום פרוטוקול ארוך ל-5 נקודות | Gemini (configurable) |
| **"מה המשמעות?"** | הסבר על השפעת הצבעה/חוק | Gemini (configurable) |
| **חיפוש סמנטי** | "חוקים בנושא דיור" | Embeddings + pgvector |
| **השוואה אוטומטית** | "מה ההבדלים בין ח"כ A ל-ח"כ B?" | Gemini + DB queries |
| **"היום בכנסת"** | סיכום יומי אוטומטי | Gemini (configurable) |
| **Chat** | שאלות חופשיות על פעילות הכנסת (רשומים בלבד) | Gemini + RAG |

### 9.4 System Prompt (בסיס)

```
אתה עוזר מומחה בנושאי הכנסת ומידע פרלמנטרי ישראלי.

כללים:
1. ענה רק על בסיס המידע שסופק — אל תמציא עובדות
2. אם אתה לא בטוח, אמור "אני לא בטוח לגבי..."
3. תמיד ציין מקורות — קישור להצבעה/חוק/פרוטוקול רלוונטי
4. ענה בהתאם לשפה של השאלה אלא אם התבקשת אחרת
5. השתמש בשפה פשוטה ונגישה — לא שפה משפטית
6. היה ניטרלי פוליטית — הצג עובדות, לא דעות
```

---

## 10. עיצוב UI/UX

### 10.1 עקרונות עיצוב

- **RTL-first** — כל העיצוב מתחיל מימין לשמאל (עברית וערבית RTL, אנגלית ורוסית LTR)
- **Multi-lingual** — כל טקסט UI מוגדר ב-4 שפות (he/en/ar/ru) דרך קבצי i18n
- **Mobile-first** — עיצוב רספונסיבי שמתחיל ממובייל
- **PWA-ready** — ניתן להתקנה כאפליקציה, תמיכה ב-offline mode בסיסי
- **Accessible** — WCAG 2.1 AA compliance
- **Data-dense** — הצגת הרבה מידע בלי עומס ויזואלי
- **Color-coded** — צבעים עקביים: קואליציה/אופוזיציה, בעד/נגד

### 10.2 פלטת צבעים

```
Primary:      #1E3A5F (כחול כהה — כנסת)
Secondary:    #4A90D9 (כחול בהיר)
Coalition:    #2E7D32 (ירוק)
Opposition:   #C62828 (אדום)
Vote For:     #388E3C (ירוק)
Vote Against: #D32F2F (אדום)
Vote Abstain: #FFA000 (כתום)
Neutral:      #757575 (אפור)
Background:   #FAFAFA (בהיר) / #121212 (כהה)
```

### 10.3 ויזואליזציות מרכזיות

1. **Heatmap הצבעות** — ציר X = הצבעות, ציר Y = חברי כנסת, צבע = בעד/נגד
2. **TreeMap תקציב** — ריבועים בגודל יחסי לסכום
3. **Bar Chart סיעתי** — פיצול הצבעה לפי סיעות
4. **Timeline חקיקה** — שלבי הצעת חוק על ציר זמן
5. **Radar Chart השוואה** — השוואת ח"כים/סיעות על מספר מדדים
6. **Sankey Diagram** — זרימת תקציב ממשרד לתחום
7. **Network Graph** — קשרי חקיקה בין חברי כנסת (מי חותם עם מי)

### 10.4 דפים מרכזיים — Wireframe תיאורי

#### דף הבית
```
┌─────────────────────────────────────────────┐
│  🏛️ כנסת אינסייט        [חיפוש]  [התחברות]  │
├─────────────────────────────────────────────┤
│  📊 היום בכנסת (סיכום AI)                    │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│  │ XX הצבעות│ │ XX חוקים │ │ XX ועדות│        │
│  └─────────┘ └─────────┘ └─────────┘        │
├─────────────────────────────────────────────┤
│  📋 הצבעה אחרונה בולטת                       │
│  ┌───────────────────────────────────────┐  │
│  │ שם ההצבעה          ✅ אושר / ❌ נדחה │  │
│  │ [===== בעד 61 ===|=== נגד 47 ===]    │  │
│  │ פיצול: קואליציה ████  אופוזיציה ████│  │
│  └───────────────────────────────────────┘  │
├─────────────────────────────────────────────┤
│  📜 חקיקה בתהליך                             │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐               │
│  │חוק1│ │חוק2│ │חוק3│ │חוק4│               │
│  └────┘ └────┘ └────┘ └────┘               │
├─────────────────────────────────────────────┤
│  💰 תקציב — מבט מהיר                        │
│  ┌───────────────────────────────────────┐  │
│  │         [TreeMap תקציב]               │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

---

## 11. אבטחה וביצועים

### 11.1 אבטחה

- **Authentication**: Supabase Auth (Email + Google/GitHub OAuth)
- **Authorization**: Row Level Security (RLS) ב-Supabase
- **API Protection**: Rate limiting באמצעות Upstash Redis (ערכים מוגדרים ב-env vars)
  - אנונימי: `RATE_LIMIT_ANON` requests/minute (ברירת מחדל: 60)
  - רשום: `RATE_LIMIT_AUTH` requests/minute (ברירת מחדל: 200)
  - AI Chat: רשומים בלבד — `AI_DAILY_CHAT_LIMIT` שיחות/יום (ברירת מחדל: 20)
- **Input Validation**: Zod schemas בכל endpoint
- **CSRF Protection**: Next.js built-in
- **Content Security Policy**: headers מוגדרים ב-`next.config.ts`
- **SQL Injection**: Drizzle ORM parameterized queries
- **XSS**: React auto-escaping + DOMPurify לתוכן דינאמי

### 11.2 ביצועים

- **ISR (Incremental Static Regeneration)**: דפי חברי כנסת, סיעות — revalidate כל שעה
- **Server Components**: רוב הדפים הם RSC — מינימום JS ללקוח
- **Edge Caching**: Vercel CDN עם cache headers מתאימים
- **Redis Caching**: תוצאות שאילתות כבדות (סטטיסטיקות, אגרגציות)
- **Database Indexes**: על כל שדה שמשמש לסינון ומיון
- **Image Optimization**: Next.js Image component עם CDN
- **Bundle Analysis**: בדיקה שלא נכנסים packages מיותרים
- **Prefetching**: Next.js Link prefetch לניווט מהיר

### 11.3 מדדי ביצוע (Target)

| מדד | יעד |
|-----|------|
| LCP (Largest Contentful Paint) | < 2.5s |
| FID (First Input Delay) | < 100ms |
| CLS (Cumulative Layout Shift) | < 0.1 |
| TTFB (Time to First Byte) | < 600ms |
| Lighthouse Score | > 90 |

---

## 12. תשתית ו-DevOps

### 12.1 סביבות

| סביבה | Branch | URL | שימוש |
|--------|--------|-----|-------|
| **Development** | `dev` | `localhost:3000` | פיתוח מקומי |
| **Staging** | `staging` | `staging.knesset-insight.co.il` | QA ובדיקות |
| **Production** | `main` | `knesset-insight.co.il` | Production |

### 12.2 CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  check:
    - lint (ESLint)
    - type-check (tsc --noEmit)
    - unit tests (Vitest)
    - build (next build)

  deploy-staging:
    needs: check
    if: github.ref == 'refs/heads/staging'
    - Vercel preview deployment

  deploy-production:
    needs: check
    if: github.ref == 'refs/heads/main'
    - Vercel production deployment
    - Run E2E tests (Playwright)
    - Notify on failure
```

### 12.3 Environment Variables

```env
# .env.example

# ================= App =================
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_APP_NAME=כנסת אינסייט

# ================= Supabase =================
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# ================= Database =================
DATABASE_URL=

# ================= Redis =================
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# ================= AI =================
# Provider: 'gemini' (default) | 'openai'
AI_PROVIDER=gemini
AI_DEFAULT_MODEL=gemini-2.5-flash
AI_FALLBACK_PROVIDER=openai
AI_FALLBACK_MODEL=gpt-4o

# Gemini
GEMINI_API_KEY=

# OpenAI (fallback / optional)
OPENAI_API_KEY=

# Embeddings: 'gemini' | 'openai'
EMBEDDING_PROVIDER=gemini
EMBEDDING_MODEL=text-embedding-004
EMBEDDING_DIMENSIONS=768

# AI Rate Limits
AI_DAILY_CHAT_LIMIT=20

# ================= i18n =================
# Supported locales (comma-separated)
NEXT_PUBLIC_SUPPORTED_LOCALES=he,en,ar,ru
NEXT_PUBLIC_DEFAULT_LOCALE=he

# ================= Rate Limiting =================
RATE_LIMIT_ANON=60
RATE_LIMIT_AUTH=200

# ================= Knesset Data Sources =================
KNESSET_ODATA_BASE_URL=https://knesset.gov.il/Odata
OKNESSET_DATA_URL=https://production.oknesset.org/pipelines/data
BUDGET_API_URL=https://next.obudget.org/api

# ================= Sync Schedule (cron expressions) =================
SYNC_ODATA_CRON=0 */6 * * *
SYNC_OKNESSET_CRON=0 3 * * *
SYNC_BUDGET_CRON=0 2 * * 5

# ================= Trigger.dev =================
TRIGGER_SECRET_KEY=

# ================= PWA =================
NEXT_PUBLIC_PWA_ENABLED=true
```

### 12.4 קונפיגורציה מרכזית (app.config.ts)

כל ערך שעלול להשתנות בעתיד מוגדר במקום אחד — `app.config.ts`:

```typescript
// app.config.ts
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
    fallbackProvider: process.env.AI_FALLBACK_PROVIDER ?? 'openai',
    fallbackModel: process.env.AI_FALLBACK_MODEL ?? 'gpt-4o',
    embeddingProvider: process.env.EMBEDDING_PROVIDER ?? 'gemini',
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
    knessetOdata: process.env.KNESSET_ODATA_BASE_URL ?? 'https://knesset.gov.il/Odata',
    oknessetData: process.env.OKNESSET_DATA_URL ?? 'https://production.oknesset.org/pipelines/data',
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
```

> **עקרון**: כל ערך שנקרא מ-env var מקבל ברירת מחדל סבירה. הקוד אף פעם לא סומך על "magic numbers" — הכול עובר דרך `appConfig`.

---

## 13. בדיקות

### 13.1 אסטרטגיית בדיקות

| סוג | כלי | כיסוי |
|-----|------|-------|
| **Unit Tests** | Vitest | פונקציות עיבוד נתונים, transformations, utils |
| **Component Tests** | Vitest + Testing Library | React components בבידוד |
| **Integration Tests** | Vitest | API routes, tRPC procedures, DB queries |
| **E2E Tests** | Playwright | תרחישי משתמש מקצה לקצה |
| **Visual Tests** | Playwright screenshots | רגרסיה ויזואלית |

### 13.2 כיסוי מינימלי

- **Pipeline** (data sync): > 90% — קריטי לאיכות הנתונים
- **API Layer**: > 80%
- **Components**: > 70%
- **E2E**: 20+ תרחישי שימוש עיקריים

---

## 14. שלבי פיתוח (Roadmap)

### שלב 1 — Foundation (שבועות 1-3)

- [ ] אתחול פרויקט Next.js + TypeScript + Tailwind
- [ ] הגדרת PWA: manifest.json, Service Worker (serwist), אייקונים
- [ ] הגדרת i18n עם next-intl — 4 שפות (he/en/ar/ru) + RTL אוטומטי
- [ ] הגדרת `app.config.ts` — קונפיגורציה מרכזית (limits, features, locales, AI provider)
- [ ] הקמת Supabase project (DB + Auth)
- [ ] הגדרת Drizzle ORM + schema + migrations
- [ ] בניית Data Pipeline בסיסי:
  - [ ] OData client לכנסת
  - [ ] Sync חברי כנסת + סיעות
  - [ ] Sync הצבעות בסיסיות
- [ ] דפים בסיסיים: Layout, Header, Footer (כולל Language Switcher)
- [ ] דף חברי כנסת — רשימה בסיסית

### שלב 2 — Core Features (שבועות 4-7)

- [ ] פרופיל חבר כנסת מלא
- [ ] דף הצבעות + פרטי הצבעה
- [ ] ויזואליזציות ראשונות (Bar Chart, פיצול סיעתי)
- [ ] חיפוש טקסט בסיסי
- [ ] Sync הצעות חוק + ועדות
- [ ] דפי חקיקה + Timeline
- [ ] דף סיעות
- [ ] Mobile responsive

### שלב 3 — Authentication & User Features (שבועות 8-10)

- [ ] Supabase Auth (Email + OAuth)
- [ ] User profiles
- [ ] מנגנון מעקב (Watchlist)
- [ ] התראות In-app
- [ ] דשבורד אישי
- [ ] Email notifications (Resend)

### שלב 4 — AI Integration (שבועות 11-13)

- [ ] AI Provider abstraction layer (Gemini default, OpenAI fallback)
- [ ] RAG Pipeline: embeddings (Gemini text-embedding-004) + pgvector
- [ ] AI Chat component (למשתמשים רשומים בלבד)
- [ ] Rate limiting AI: מונה יומי per-user ב-Redis
- [ ] סיכומים אוטומטיים (הצעות חוק, ועדות)
- [ ] חיפוש סמנטי
- [ ] "היום בכנסת" — סיכום יומי

### שלב 5 — Budget & Advanced Analytics (שבועות 14-16)

- [ ] אינטגרציה עם מפתח התקציב
- [ ] TreeMap תקציב
- [ ] השוואות מתקדמות (ח"כים/סיעות)
- [ ] ניתוח משמעת סיעתית
- [ ] גרף רשת קשרי חקיקה
- [ ] ייצוא נתונים (CSV/PDF)

### שלב 6 — Polish & Launch (שבועות 17-19)

- [ ] בדיקת תרגומים — 4 שפות: he, en, ar, ru
- [ ] Performance optimization
- [ ] PWA audit: Lighthouse PWA score, offline functionality
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] SEO optimization (כולל hreflang ל-4 שפות)
- [ ] E2E tests מלאים
- [ ] Documentation
- [ ] Beta launch

---

## 15. הרחבות עתידיות

- **Push Notifications**: Web Push API לעדכונים בזמן אמת (PWA כבר תומך)
- **Civic Engagement Score**: ציון מעורבות אזרחית למשתמשים
- **Social Sharing**: שיתוף השוואות ותובנות ברשתות חברתיות
- **API ציבורי**: חשיפת API לצד שלישי
- **Widget Embed**: אפשרות להטמיע ויזואליזציות באתרים אחרים
- **Native Mobile App**: React Native (PWA כבר זמין מההתחלה)
- **Podcast Summaries**: סיכום אודיו יומי (TTS)
- **Election Dashboard**: לוח מחוונים מיוחד לתקופת בחירות
- **Historical Analysis**: ניתוח מגמות לאורך כנסות שונות
- **Comparator Tool**: השוואת הבטחות בחירות מול פעולות בפועל
- **Public Opinion Integration**: שילוב סקרי דעת קהל
- **Telegram/WhatsApp Bot**: קבלת עדכונים דרך messaging
- **שפות נוספות**: תשתית i18n מוכנה להרחבה לשפות נוספות
- **AI Providers נוספים**: Anthropic Claude, Mistral — תשתית ה-abstraction layer מוכנה
