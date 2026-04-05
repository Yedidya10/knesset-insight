# 05 — ארכיטקטורה טכנית ותכנון מערכת

## סקירה כללית

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser/PWA)                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Next.js App Router (React 19 + RSC)                     │   │
│  │  ├── Server Components (default)                         │   │
│  │  ├── Client Components (interactive)                     │   │
│  │  ├── next-intl (i18n — he/en/ar/ru)                     │   │
│  │  ├── Tailwind CSS 4 + shadcn/ui                         │   │
│  │  └── serwist (PWA + offline)                            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │ tRPC                              │
├──────────────────────────────┼──────────────────────────────────┤
│                        SERVER (Edge/Node)                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  API Layer                                               │   │
│  │  ├── tRPC Router (type-safe, Zod validation)            │   │
│  │  ├── Auth Middleware (Supabase Auth)                     │   │
│  │  ├── Rate Limiting (Upstash Redis)                      │   │
│  │  └── AI Endpoints (Vercel AI SDK)                       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Data Layer                                              │   │
│  │  ├── Drizzle ORM (PostgreSQL)                           │   │
│  │  ├── Supabase (DB + Auth + Realtime + Storage)          │   │
│  │  ├── Upstash Redis (Cache + Rate Limit + Queue)         │   │
│  │  └── AI Provider abstraction (Gemini / OpenAI)          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Pipeline Layer                                          │   │
│  │  ├── Sync Jobs (9 jobs — members, votes, bills, etc.)   │   │
│  │  ├── Notification Dispatcher                             │   │
│  │  ├── Aggregation Engine (entity stats)                  │   │
│  │  └── Content Moderation Pipeline                         │   │
│  └──────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│                      EXTERNAL SERVICES                           │
│  Knesset OData │ Open Knesset │ Budget API │ Gemini │ Resend    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Stack טכנולוגי מלא

### Core

| שכבה       | טכנולוגיה     | גרסה   | תפקיד                                |
| ---------- | ------------- | ------ | ------------------------------------ |
| Framework  | Next.js       | 16.x   | App Router, SSR, API routes          |
| UI         | React         | 19.x   | Server + Client Components           |
| Language   | TypeScript    | 5.x    | Type safety                          |
| Styling    | Tailwind CSS  | 4.x    | Utility-first CSS                    |
| Components | shadcn/ui     | latest | Accessible component library         |
| Animation  | Framer Motion | latest | Page transitions, micro-interactions |

### Backend

| שכבה       | טכנולוגיה             | תפקיד                          |
| ---------- | --------------------- | ------------------------------ |
| API        | tRPC 11               | End-to-end typesafe RPC        |
| Validation | Zod                   | Runtime schema validation      |
| DB ORM     | Drizzle               | Type-safe SQL queries          |
| Database   | PostgreSQL (Supabase) | Primary data store             |
| Cache      | Upstash Redis         | Caching, rate limiting, queues |
| Auth       | Supabase Auth         | Authentication + RLS           |
| Realtime   | Supabase Realtime     | Live updates, notifications    |
| Storage    | Supabase Storage      | Images, files                  |

### AI

| שכבה         | טכנולוגיה       | תפקיד                      |
| ------------ | --------------- | -------------------------- |
| SDK          | Vercel AI SDK 6 | Unified AI interface       |
| Primary LLM  | Google Gemini   | Chat, analysis, moderation |
| Fallback LLM | OpenAI GPT      | Fallback provider          |
| Embeddings   | Gemini/OpenAI   | Vector search for RAG      |

### Infrastructure

| שכבה       | טכנולוגיה        | תפקיד                       |
| ---------- | ---------------- | --------------------------- |
| Hosting    | Vercel           | Edge deployment, serverless |
| PWA        | serwist          | Service worker, offline     |
| i18n       | next-intl        | 4-language support          |
| Charts     | Recharts         | Data visualization          |
| Email      | Resend/SendGrid  | Transactional emails        |
| Monitoring | Vercel Analytics | Performance, errors         |

---

## מבנה תיקיות (עדכני + מתוכנן)

```
src/
├── app/
│   ├── globals.css
│   ├── layout.tsx                    # Root layout
│   │
│   ├── [locale]/
│   │   ├── layout.tsx                # Locale layout (RTL/LTR)
│   │   ├── page.tsx                  # Home
│   │   │
│   │   ├── (public)/                 # ← שכבה 1: ציבורי
│   │   │   ├── members/
│   │   │   │   ├── page.tsx          # רשימת חברי כנסת
│   │   │   │   └── [id]/page.tsx     # פרופיל חבר כנסת
│   │   │   ├── votes/
│   │   │   ├── legislation/
│   │   │   ├── factions/
│   │   │   ├── parties/
│   │   │   ├── committees/           # 🚧 להשלים
│   │   │   ├── elections/            # 🚧 להשלים
│   │   │   ├── budget/               # 🚧 להשלים
│   │   │   ├── compare/              # 📋 חדש — השוואות
│   │   │   ├── timeline/             # 📋 חדש — ציר זמן
│   │   │   └── search/               # 📋 חדש — חיפוש גלובלי
│   │   │
│   │   ├── (auth)/                   # ← דפי אימות
│   │   │   ├── login/page.tsx        # 📋 כניסה
│   │   │   ├── register/page.tsx     # 📋 רישום
│   │   │   ├── forgot-password/      # 📋 שחזור סיסמה
│   │   │   └── verify/page.tsx       # 📋 אימות email
│   │   │
│   │   └── (dashboard)/              # ← שכבה 2+3: משתמש רשום
│   │       ├── page.tsx              # 📋 סקירה אישית
│   │       ├── watchlist/            # 📋 מעקבים
│   │       ├── ratings/              # 📋 דירוגים שלי
│   │       ├── notifications/        # 📋 התראות
│   │       ├── ai-chat/              # 📋 צ'אט AI
│   │       └── settings/             # 📋 הגדרות
│   │
│   └── api/
│       ├── trpc/[trpc]/route.ts      # tRPC handler
│       ├── cron/                     # Cron endpoints
│       ├── ai/                       # 📋 AI chat endpoint
│       ├── notifications/            # 📋 Push subscription
│       └── og/                       # 📋 Dynamic OG images
│
├── components/
│   ├── ui/                           # shadcn/ui components
│   ├── layout/                       # Header, Footer, LanguageSwitcher
│   ├── members/                      # MemberCard, MembersFilter
│   ├── votes/                        # VoteDistributionChart, VotesFilter
│   ├── charts/                       # Shared chart components
│   ├── dashboard/                    # 📋 Dashboard components
│   ├── social/                       # 📋 Public ratings, comments
│   └── search/                       # 📋 Global search components
│
├── server/
│   ├── trpc.ts                       # tRPC init
│   ├── context.ts                    # Request context
│   └── routers/
│       ├── _app.ts                   # Root router
│       ├── members.ts
│       ├── votes.ts
│       ├── bills.ts
│       ├── factions.ts
│       ├── political-parties.ts
│       ├── electoral-lists.ts
│       ├── search.ts                 # 📋 Global search
│       ├── watchlist.ts              # 📋 User follows
│       ├── ratings.ts                # 📋 User + public ratings
│       ├── notifications.ts          # 📋 User notifications
│       └── comments.ts              # 📋 Public comments
│
├── lib/
│   ├── ai/provider.ts               # AI abstraction
│   ├── auth/                         # 📋 Supabase auth helpers
│   ├── db/
│   │   ├── schema.ts                 # Drizzle schema (הרחבה)
│   │   ├── index.ts                  # DB connection
│   │   └── redis.ts                  # Redis client
│   ├── knesset/                      # Knesset data clients
│   ├── budget/                       # Budget data
│   ├── notifications/                # 📋 Notification service
│   └── moderation/                   # 📋 Content moderation
│
├── pipeline/
│   ├── schedule.ts
│   ├── jobs/                         # 9 sync jobs (קיימים)
│   │   ├── aggregate-stats.ts        # 📋 Entity stats aggregation
│   │   └── send-digests.ts           # 📋 Weekly email digests
│   └── seed/
│
├── hooks/                            # Client-side React hooks
├── i18n/messages/                    # Translation files
└── types/                            # Global type definitions
```

---

## סכמת בסיס נתונים — מפה מלאה

### טבלאות קיימות

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────┐
│    members       │────→│  member_votes     │←────│    votes     │
│                  │     │                   │     │              │
│ id (PK)          │     │ member_id (FK)    │     │ id (PK)      │
│ name             │     │ vote_id (FK)      │     │ title        │
│ faction_id (FK)  │────→│ result            │     │ date         │
│ email            │     └──────────────────┘     │ for/against  │
│ is_current       │                               │ controversy  │
│ image_url        │     ┌──────────────────┐     └──────────────┘
│ ...              │────→│ bill_initiators   │←────┐
└─────────────────┘     │                   │     │
        │               │ member_id (FK)    │     │
        │               │ bill_id (FK)      │  ┌──┴──────────┐
        ▼               └──────────────────┘  │   bills      │
┌─────────────────┐                           │              │
│   factions       │                           │ id (PK)      │
│                  │                           │ title        │
│ id (PK)          │                           │ status       │
│ name             │                           │ summary      │
│ knesset_num      │                           └──────────────┘
└─────────────────┘
        │
        ▼
┌──────────────────┐    ┌──────────────────┐
│ party_faction_   │    │   committees     │
│ links            │    │                  │
│                  │    │ id (PK)          │
│ party_id (FK)    │    │ name             │
│ faction_id (FK)  │    │ type             │
└──────────────────┘    └──────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │ committee_       │
                        │ sessions         │
                        │                  │
                        │ committee_id(FK) │
                        │ date             │
                        │ topics           │
                        └──────────────────┘
```

### טבלאות חדשות (שכבה 2+3)

```
┌─────────────────┐
│    profiles      │ ← Supabase auth.users extension
│                  │
│ id (PK = auth)   │──────────────┬──────────────┐
│ display_name     │              │              │
│ locale           │              │              │
│ public_profile   │              │              │
└─────────────────┘              │              │
        │                        │              │
        ▼                        ▼              ▼
┌──────────────┐    ┌──────────────┐   ┌──────────────┐
│ user_follows  │    │ user_ratings  │   │ notifications │
│              │    │              │   │              │
│ user_id (FK) │    │ user_id (FK) │   │ user_id (FK) │
│ entity_type  │    │ member_id    │   │ type         │
│ entity_id    │    │ overall ⭐   │   │ title        │
└──────────────┘    │ reliability  │   │ read         │
                    │ is_public    │   └──────────────┘
                    └──────────────┘
                           │
                           ▼
                    ┌──────────────┐   ┌──────────────┐
                    │ entity_stats  │   │ public_      │
                    │ (aggregated)  │   │ comments     │
                    │              │   │              │
                    │ entity_type  │   │ user_id (FK) │
                    │ followers    │   │ entity_type  │
                    │ avg_rating   │   │ content      │
                    │ interest     │   │ status       │
                    └──────────────┘   │ upvotes      │
                                       └──────────────┘
```

---

## אסטרטגיות Caching

### Redis Cache Layers

```typescript
const cacheConfig = {
  // שכבה 1: נתונים ציבוריים — TTL ארוך
  publicData: {
    membersList: { ttl: '6h', key: 'members:list:{page}:{filters}' },
    memberDetail: { ttl: '6h', key: 'member:{id}' },
    votesList: { ttl: '6h', key: 'votes:list:{page}:{filters}' },
    voteDetail: { ttl: '6h', key: 'vote:{id}' },
    billsList: { ttl: '6h', key: 'bills:list:{page}:{filters}' },
    searchResults: { ttl: '1h', key: 'search:{hash}' },
    stats: { ttl: '1h', key: 'stats:home' },
  },

  // שכבה 2: נתונים אישיים — TTL קצר
  userData: {
    watchlist: { ttl: '5m', key: 'user:{id}:watchlist' },
    notifications: { ttl: '1m', key: 'user:{id}:notifications:unread' },
    ratings: { ttl: '10m', key: 'user:{id}:ratings' },
  },

  // שכבה 3: נתונים מצרפיים — TTL בינוני
  aggregated: {
    entityStats: { ttl: '15m', key: 'entity:{type}:{id}:stats' },
    leaderboard: { ttl: '15m', key: 'leaderboard:{sortBy}' },
    publicRatings: { ttl: '15m', key: 'ratings:public:{memberId}' },
  },
};
```

### Cache Invalidation Strategy

```
Sync Job מסתיים
    │
    ├── Invalidate specific keys (member:{id})
    ├── Invalidate list keys (members:list:*)
    └── Trigger aggregation job (entity_stats)

User Action (follow/rate/comment)
    │
    ├── Write-through to DB
    ├── Invalidate user cache (user:{id}:*)
    └── Queue aggregation update (debounced)
```

---

## Rate Limiting

```typescript
// מוגדר ב-app.config.ts
const rateLimits = {
  anonymous: { requests: 60, window: '1m' }, // קריאה בלבד
  authenticated: { requests: 200, window: '1m' }, // כל הפעולות
  ai: { daily: 20 }, // AI chat
  ratings: { requests: 10, window: '1m' }, // דירוגים
  comments: { requests: 5, window: '1m' }, // תגובות
  follows: { requests: 20, window: '1m' }, // מעקבים
};
```

---

## אבטחה

### אימות (Authentication)

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Browser    │────→│  Supabase    │────→│  PostgreSQL  │
│              │     │  Auth        │     │  (RLS)       │
│  JWT Token   │←────│  Session     │     │  Policies    │
└─────────────┘     └──────────────┘     └──────────────┘
```

### הרשאות (Authorization)

| Route Pattern    | Auth                       | Role      |
| ---------------- | -------------------------- | --------- |
| `(public)/**`    | ❌                         | כולם      |
| `(auth)/**`      | ❌ (redirect if logged in) | כולם      |
| `(dashboard)/**` | ✅                         | user      |
| `api/ai/**`      | ✅                         | user      |
| `api/cron/**`    | 🔑 API key                 | system    |
| Moderation       | ✅                         | moderator |
| Admin            | ✅                         | admin     |

### Row Level Security

```sql
-- Supabase RLS Policies

-- Public data: read-only for everyone
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON members FOR SELECT USING (true);

-- User data: only own records
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_follows" ON user_follows
  FOR ALL USING (auth.uid() = user_id);

-- Public ratings: read all public, write own
ALTER TABLE user_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_public_ratings" ON user_ratings
  FOR SELECT USING (is_public = true OR auth.uid() = user_id);
CREATE POLICY "write_own_ratings" ON user_ratings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

---

## Monitoring & Observability

### מדדים לניטור

| מדד                 | כלי                | Alert          |
| ------------------- | ------------------ | -------------- |
| Response time (p95) | Vercel Analytics   | > 2s           |
| Error rate          | Vercel Logs        | > 1%           |
| Cache hit ratio     | Redis metrics      | < 80%          |
| Sync job failures   | sync_log טבלה      | כל כישלון      |
| DB connection pool  | Supabase dashboard | > 80% utilized |
| Rate limit hits     | Redis counters     | spike          |

### Structured Logging

```typescript
// כל sync job מדווח ל-sync_log
interface SyncLogEntry {
  entity: string;
  status: 'success' | 'error';
  recordsProcessed: number;
  duration: number;
  error?: string;
  timestamp: Date;
}
```

---

## Deployment Pipeline

```
Feature Branch → PR → Review → Merge to dev
                                    │
                         ┌──────────┴──────────┐
                         ▼                      ▼
                   Preview Deploy          Tests (CI)
                   (Vercel)               ├── Type check
                                          ├── Lint
                                          ├── Unit tests
                                          └── E2E tests
                                               │
                                               ▼
                                          Merge to main
                                               │
                                               ▼
                                        Production Deploy
                                           (Vercel)
                                               │
                                               ▼
                                        DB Migrations
                                        (drizzle-kit push)
```

---

## Scalability Considerations

### שלב 1: 0–10K משתמשים (נוכחי)

- Vercel Hobby/Pro
- Supabase Free/Pro
- Upstash Free
- מספיק לכל השכבות

### שלב 2: 10K–100K משתמשים

- Supabase Pro + connection pooling
- Redis Premium (dedicated)
- CDN caching for API responses
- Background jobs → Trigger.dev / Inngest

### שלב 3: 100K+ משתמשים

- Database read replicas
- Edge caching (Vercel Cache Headers)
- Queue system for notifications (BullMQ / Upstash QStash)
- Consider splitting to microservices:
  - Notification service
  - Aggregation service
  - AI service
