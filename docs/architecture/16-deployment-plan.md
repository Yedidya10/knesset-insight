# Deployment Plan: Merge to Main & Vercel Production

## TL;DR

יצירת ענף `main` מתוך `dev`, הקמת פרויקט Vercel עם GitHub integration (`main` = production, `dev` = preview), הגדרת שירותים חיצוניים, הוספת GitHub Actions CI, ופריסה ראשונה ל-`knesset-insight.vercel.app`.

---

## Architecture Overview

```
                    ┌─────────────────────────────────────┐
                    │           GitHub Repository          │
                    │       Yedidya10/knesset-insight      │
                    ├──────────────┬──────────────────────┤
                    │  main branch │    dev branch         │
                    │  (production)│    (development)      │
                    └──────┬───────┴──────────┬───────────┘
                           │                  │
                    ┌──────▼───────┐   ┌──────▼───────────┐
                    │  Vercel Prod │   │  Vercel Preview   │
                    │  knesset-    │   │  Auto-generated   │
                    │  insight.    │   │  preview URLs     │
                    │  vercel.app  │   │                   │
                    └──────┬───────┘   └──────────────────┘
                           │
              ┌────────────┼────────────────┐
              │            │                │
       ┌──────▼──────┐ ┌──▼────────┐ ┌─────▼──────┐
       │  Supabase   │ │  Upstash  │ │ Trigger.dev│
       │  PostgreSQL │ │  Redis    │ │  Cron Jobs │
       └─────────────┘ └───────────┘ └────────────┘
```

---

## Phase 1: Pre-Merge Preparation

### Step 1: Verify Build & Type-Check Locally

```bash
pnpm type-check    # tsc --noEmit — must pass with zero errors
pnpm build         # next build — full production build
```

> **Blocking**: Must pass before any other step. The pre-push hook enforces this, but verify manually first.

### Step 2: Audit Uncommitted Changes

```bash
git status
git log --oneline -10
```

- Commit all pending work with conventional commit messages (`feat:`, `fix:`, `style:`, etc.)
- Ensure `dev` is clean and pushed to remote:

```bash
git push origin dev
```

---

## Phase 2: Branching Strategy

### Step 3: Create `main` Branch

```bash
git checkout dev
git pull origin dev
git checkout -b main
git push -u origin main
```

> **Important**: Do NOT change GitHub default branch. Keep `dev` as default for day-to-day development.

### Step 4: Configure Branch Protection Rules

Navigate to **GitHub → Settings → Branches → Add rule**.

#### `main` Branch Rules:

| Rule                                | Setting                       |
| ----------------------------------- | ----------------------------- |
| Require pull request before merging | ✅ Yes                        |
| Required approvals                  | 1                             |
| Require status checks to pass       | ✅ Yes                        |
| Required checks                     | `lint`, `type-check`, `build` |
| Require branches to be up-to-date   | ✅ Yes                        |
| Allow force pushes                  | ❌ No                         |
| Allow deletions                     | ❌ No                         |

#### `dev` Branch Rules:

| Rule                          | Setting                       |
| ----------------------------- | ----------------------------- |
| Require status checks to pass | ✅ Yes                        |
| Required checks               | `lint`, `type-check`, `build` |
| Allow direct pushes           | ✅ Yes                        |

---

## Phase 3: External Services

### Step 5: Provision Upstash Redis ⚠️ NEEDS SETUP

1. Go to [console.upstash.com](https://console.upstash.com)
2. Create a new Redis database
3. **Region**: EU West (closest to Israel)
4. **Eviction**: Enabled
5. Copy credentials:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

**Used for**: Rate limiting (anonymous: 60 req/min, authenticated: 200 req/min) + query caching with configurable TTL.

### Step 6: Verify Existing Services

| Service     | Status | Credentials to Verify                                                                                    |
| ----------- | ------ | -------------------------------------------------------------------------------------------------------- |
| Supabase    | ✅     | `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Trigger.dev | ✅     | `TRIGGER_SECRET_KEY`, `TRIGGER_PROJECT_ID`                                                               |
| Gemini AI   | ✅     | `GEMINI_API_KEY` — verify sufficient quota for production                                                |

---

## Phase 4: Vercel Project Setup

### Step 7: Create Vercel Project

1. Go to [vercel.com/new](https://vercel.com/new)
2. **Import** → Select `Yedidya10/knesset-insight`
3. Configure:

| Setting          | Value                                       |
| ---------------- | ------------------------------------------- |
| Framework        | Next.js (auto-detected)                     |
| Root directory   | `.`                                         |
| Build command    | `pnpm build`                                |
| Output directory | `.next`                                     |
| Install command  | `pnpm install` (auto from `pnpm-lock.yaml`) |
| Node.js version  | **20.x**                                    |

### Step 8: Configure Production Branch

In **Vercel Dashboard → Settings → Git**:

| Setting           | Value                                |
| ----------------- | ------------------------------------ |
| Production branch | `main`                               |
| Preview branches  | All other branches (including `dev`) |

### Step 9: Set Environment Variables

Navigate to **Vercel Dashboard → Settings → Environment Variables**.

Set these for **Production + Preview** environments:

#### App

```
NEXT_PUBLIC_APP_URL=https://knesset-insight.vercel.app
NEXT_PUBLIC_APP_NAME=כנסת אינסייט
NEXT_PUBLIC_SITE_URL=https://knesset-insight.vercel.app
```

#### Database (Supabase)

```
DATABASE_URL=postgresql://...
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

#### Cache (Upstash Redis)

```
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxx...
```

#### AI (Gemini)

```
GEMINI_API_KEY=...
AI_PROVIDER=gemini
AI_DAILY_CHAT_LIMIT=20
EMBEDDING_PROVIDER=gemini
EMBEDDING_MODEL=text-embedding-004
EMBEDDING_DIMENSIONS=768
```

#### Internationalization

```
NEXT_PUBLIC_SUPPORTED_LOCALES=he,en,ar,ru
NEXT_PUBLIC_DEFAULT_LOCALE=he
```

#### Rate Limiting

```
RATE_LIMIT_ANON=60
RATE_LIMIT_AUTH=200
```

#### Knesset Data Sources

```
KNESSET_ODATA_BASE_URL=https://knesset.gov.il/Odata
KNESSET_ODATA_V4_BASE_URL=https://knesset.gov.il/OdataV4/ParliamentInfo
OKNESSET_DATA_URL=https://production.oknesset.org/pipelines/data
BUDGET_API_URL=https://next.obudget.org/api
```

#### Background Jobs (Trigger.dev)

```
TRIGGER_SECRET_KEY=...
TRIGGER_PROJECT_ID=knesset-insight
```

#### PWA & Features

```
NEXT_PUBLIC_PWA_ENABLED=true
NEXT_PUBLIC_INTEGRITY_ENABLED=true
```

#### Admin

```
ADMIN_SECRET=<generate-with: openssl rand -base64 32>
```

#### Preview-Only Overrides

For the `dev` / preview environment only:

```
NEXT_PUBLIC_APP_URL=https://knesset-insight-git-dev-yedidya10.vercel.app
```

### Step 10: Vercel Build Settings

- Framework: Next.js (auto-detected)
- Serwist service worker compiles automatically via `next.config.ts` (`src/sw.ts` → `public/sw.js`)
- Ignored build step: Leave default (Vercel auto-detects changes)

---

## Phase 5: GitHub Actions CI

### Step 11: Create CI Workflow

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main, dev]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10.30.3
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint

  type-check:
    name: Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10.30.3
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm type-check

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: [lint, type-check]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10.30.3
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
    env:
      DATABASE_URL: postgresql://dummy:dummy@localhost:5432/dummy
      NEXT_PUBLIC_SUPABASE_URL: https://dummy.supabase.co
      NEXT_PUBLIC_SUPABASE_ANON_KEY: dummy
      UPSTASH_REDIS_REST_URL: https://dummy.upstash.io
      UPSTASH_REDIS_REST_TOKEN: dummy
      GEMINI_API_KEY: dummy
      TRIGGER_SECRET_KEY: dummy
      ADMIN_SECRET: dummy
```

> **Note**: Build job uses dummy env vars — just enough for `next build` to compile without runtime errors. Actual deployment is handled by Vercel.

---

## Phase 6: Database Migration

### Step 12: Run Drizzle Migrations

Ensure the Supabase production database has all 17 migrations applied (`drizzle/0000` through `drizzle/0016`):

```bash
# Set production DATABASE_URL
export DATABASE_URL="postgresql://..."

# Push schema to production
pnpm drizzle-kit push
```

**Tables to verify**:
members, bills, votes, factions, committees, knesset_terms, elections, governments, bill_stages, bill_clusters, bill_documents, bill_ai_topics, bill_history_initiators, integrity tables, election_city_results, committee_members, committee_sessions, policy_stances, sync_checkpoints.

### Step 13: Seed Initial Data

After deployment, trigger the initial data sync via Trigger.dev in this order:

```
1. sync-core-data        → Members, factions, committees, bills, votes
2. sync-political-data   → Coalition periods, political groups, governments
3. sync-bill-relations   → Bill stages, clusters, document links
4. sync-integrity        → Ethics/integrity data
5. analysis-pipeline     → AI embeddings, topic analysis
```

---

## Phase 7: First Deployment & Verification

### Step 14: Deploy

The first production deployment triggers automatically when `main` is pushed and Vercel is connected. Monitor at **Vercel Dashboard → Deployments**.

### Step 15: Post-Deployment Checklist

| #   | Check            | URL / Action                             | Expected                           |
| --- | ---------------- | ---------------------------------------- | ---------------------------------- |
| 1   | Health check     | `https://knesset-insight.vercel.app`     | Page loads, no errors              |
| 2   | Hebrew (RTL)     | `/he`                                    | RTL layout, Hebrew text            |
| 3   | English (LTR)    | `/en`                                    | LTR layout, English text           |
| 4   | Arabic (RTL)     | `/ar`                                    | RTL layout, Arabic text            |
| 5   | Russian (LTR)    | `/ru`                                    | LTR layout, Russian text           |
| 6   | tRPC API         | DevTools → Network → filter `trpc`       | Successful responses with data     |
| 7   | PWA              | DevTools → Application → Manifest & SW   | Manifest loads, SW registered      |
| 8   | Dark mode        | Toggle system/manual dark mode           | All components render correctly    |
| 9   | Sitemap          | `/sitemap.xml`                           | Valid XML with all routes          |
| 10  | Robots.txt       | `/robots.txt`                            | Correct allow/disallow rules       |
| 11  | Images           | Member pages with photos                 | Photos load from wikimedia/knesset |
| 12  | Rate limiting    | Rapid requests → check Upstash dashboard | Requests counted, limits enforced  |
| 13  | Trigger.dev jobs | Trigger.dev dashboard                    | Jobs scheduled, first run succeeds |

### Step 16: Performance Audit

- Run **Lighthouse** on production URL → Target score **> 90**
- Enable **Vercel Web Analytics** (free on Hobby plan)
- Verify service worker caching works for offline-capable pages

---

## Phase 8: Ongoing Workflow

### Day-to-Day Development

```
dev branch ──push──▶ Vercel Preview + CI ──verify──▶ PR to main ──merge──▶ Vercel Production
```

1. Develop on `dev` (or feature branches)
2. Push → Vercel deploys preview + CI runs (lint, type-check, build)
3. When ready for production → Create PR from `dev` → `main`
4. CI must pass + code review required
5. Merge → Vercel auto-deploys to production

### Trigger.dev Deployment

After Vercel is set up, deploy Trigger.dev separately:

```bash
npx trigger.dev@latest deploy
```

- `trigger.config.ts` uses `syncVercelEnvVars()` to keep env vars in sync
- Cron schedules defined in `app.config.ts`:

| Job                 | Schedule      | Description                    |
| ------------------- | ------------- | ------------------------------ |
| sync-core-data      | `0 */6 * * *` | Every 6 hours                  |
| sync-bill-relations | `0 1 * * *`   | Daily at 1:00 AM (Israel time) |
| sync-political-data | `0 3 * * *`   | Daily at 3:00 AM               |
| sync-integrity      | `0 4 * * *`   | Daily at 4:00 AM               |
| analysis-pipeline   | `0 5 * * *`   | Daily at 5:00 AM               |

---

## Key Decisions

| Decision            | Choice                           | Rationale                                         |
| ------------------- | -------------------------------- | ------------------------------------------------- |
| Default branch      | Stays `dev`                      | Active development branch, `main` is for releases |
| Custom domain       | None (use `vercel.app`)          | Not needed at this stage                          |
| Staging environment | `dev` preview serves as staging  | Simplicity — single team/developer                |
| Database isolation  | Single Supabase DB (shared)      | Public data project, no destructive risk          |
| CI/CD split         | GitHub Actions = CI, Vercel = CD | Best of both — code quality + zero-config deploy  |

---

## Relevant Project Files

| File                    | Role                                                   |
| ----------------------- | ------------------------------------------------------ |
| `next.config.ts`        | Serwist plugin, i18n plugin, image remote patterns     |
| `app.config.ts`         | All configurable values (AI, rate limits, sync, flags) |
| `drizzle.config.ts`     | DB connection for migrations                           |
| `src/lib/db/index.ts`   | PostgreSQL client (`prepare: false` for Supabase)      |
| `src/lib/cache.ts`      | Upstash Redis client                                   |
| `src/lib/auth/admin.ts` | Cookie-based admin auth (`ADMIN_SECRET`)               |
| `src/proxy.ts`          | next-intl middleware (locale routing)                  |
| `src/sw.ts`             | Serwist service worker source                          |
| `src/app/robots.ts`     | Robots.txt generation                                  |
| `src/app/sitemap.ts`    | Dynamic sitemap generation                             |
| `trigger.config.ts`     | Trigger.dev config with `syncVercelEnvVars()`          |
| `package.json`          | Scripts, lint-staged, pnpm version                     |
| `.husky/`               | Git hooks (pre-commit, pre-push, commit-msg)           |

---

## Files to Create

| File                       | Purpose                                       |
| -------------------------- | --------------------------------------------- |
| `.github/workflows/ci.yml` | GitHub Actions CI (lint + type-check + build) |

---

## Final Verification Checklist

- [ ] `pnpm type-check` passes locally on `dev`
- [ ] `pnpm build` succeeds locally on `dev`
- [ ] `main` branch exists on GitHub remote
- [ ] Vercel project connected and first build succeeds
- [ ] All env vars set in Vercel (Production + Preview)
- [ ] Upstash Redis provisioned and connected
- [ ] `knesset-insight.vercel.app` loads with all 4 locales
- [ ] tRPC API returns data
- [ ] Redis rate limiting works
- [ ] Trigger.dev jobs execute on schedule
- [ ] GitHub Actions CI passes on push
- [ ] Branch protection rules active on `main`
- [ ] Lighthouse score > 90

---

## Future Considerations

1. **Separate preview DB** — If destructive migrations become a concern, create a second Supabase project for `dev` preview deploys.
2. **Vercel Speed Insights** — Enable post-deployment (free on Hobby plan) for performance monitoring.
3. **Error monitoring (Sentry)** — Add as a follow-up for production error visibility.
4. **Custom domain** — When ready, add via Vercel Dashboard → Settings → Domains.
5. **Rate limit tuning** — Monitor Upstash dashboard and adjust `RATE_LIMIT_ANON` / `RATE_LIMIT_AUTH` based on real traffic.
