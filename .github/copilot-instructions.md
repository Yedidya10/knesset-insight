# Knesset Insight — Copilot Instructions

## Project Overview

Knesset Insight is a civic-tech platform for Israeli parliamentary data.
See `PLAN.md` for the full architecture and feature spec.

## Core Principles

1. **All user-facing text must be translated** — never hardcode Hebrew/English strings. Use `next-intl` `t()` function. Every string must exist in all 4 locale files: `he.json`, `en.json`, `ar.json`, `ru.json`.
2. **RTL/LTR is automatic** — Hebrew and Arabic are RTL, English and Russian are LTR. Use logical CSS properties (`start`/`end` instead of `left`/`right`). The `dir` attribute is set per-locale in the root layout.
3. **AI provider is abstracted** — never import `openai` or `@google/generative-ai` directly. Use `@/lib/ai/provider` which reads from `appConfig.ai.provider`.
4. **All magic numbers go through config** — rate limits, daily chat limits, cron schedules, API URLs — all defined in `app.config.ts` and backed by env vars.
5. **AI Chat is for registered users only** — any AI chat endpoint must verify authentication. Anonymous users see a prompt to sign up.
6. **PWA compliance** — pages should work offline where possible. Use service worker caching strategies. All icons/manifest are in `public/`.

## Tech Stack

- **Framework**: Next.js 15 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **Database**: Supabase (PostgreSQL) + Drizzle ORM
- **Cache**: Upstash Redis
- **AI**: Gemini (default) via Vercel AI SDK, OpenAI as fallback
- **i18n**: next-intl (he, en, ar, ru)
- **API**: tRPC (type-safe)
- **PWA**: serwist (next-pwa successor)

## File Conventions

- Components: PascalCase (`MemberCard.tsx`)
- Utilities/libs: camelCase (`odata-client.ts`)
- i18n keys: dot-separated namespaces (`members.profile.title`)
- Route groups: `(public)`, `(auth)`, `(dashboard)`

## When Writing Components

- Use Server Components by default, Client Components only when needed
- Use `useTranslations()` from `next-intl` for any displayed text
- Support dark mode via Tailwind `dark:` prefix
- Ensure WCAG 2.1 AA accessibility
- **When adding or changing content in a page/component, always update its corresponding `loading.tsx` skeleton** to match the new structure. The skeleton must reflect the real layout so users see a coherent loading state.
- **No duplicate UI elements** — never render the same visual component (e.g. a stage pipeline / stepper) twice on a page in different sections. If a component needs both display and interaction (e.g. stage stepper + vote drill-down), use a single interactive component that serves both purposes. Related data (e.g. votes) should be listed separately without duplicating the parent navigation.

## When Writing API Endpoints

- Validate inputs with Zod
- Use `appConfig` for any configurable values
- AI endpoints: always check `auth` + enforce `dailyChatLimit` via Redis counter
- Rate limit via Upstash Redis

## When Working with Data

- All DB access through Drizzle ORM — never raw SQL in application code
- Use tRPC routers for client-facing data
- Cache heavy queries in Redis with configurable TTL

## When Writing Scripts (`src/scripts/`)

- **Environment variables live in `.env.local`** (not `.env`). Load them with `import { config } from 'dotenv'; config({ path: '.env.local' });` at the very top.
- **All app imports (`../lib/db`, `../lib/db/schema`, etc.) must be dynamic** (`await import(...)`) inside an `async function main()`. Static `import` is hoisted before `dotenv` runs, so the DB module will see `undefined` for `DATABASE_URL`.
- Follow the pattern used in `src/scripts/sync.ts`: dotenv config at top, then dynamic imports inside `main()`.

## Workflow

- **After completing a fix or feature, always create a commit** with a clear conventional-commit message (`feat:`, `fix:`, `style:`, `refactor:`, `chore:`, `i18n:`, `docs:`). Group related changes into a single commit; unrelated changes go into separate commits.
