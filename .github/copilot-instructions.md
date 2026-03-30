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

## When Writing API Endpoints

- Validate inputs with Zod
- Use `appConfig` for any configurable values
- AI endpoints: always check `auth` + enforce `dailyChatLimit` via Redis counter
- Rate limit via Upstash Redis

## When Working with Data

- All DB access through Drizzle ORM — never raw SQL in application code
- Use tRPC routers for client-facing data
- Cache heavy queries in Redis with configurable TTL
