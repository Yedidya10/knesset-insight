# Knesset Insight — Copilot Instructions

## Project Overview

Knesset Insight is a civic-tech platform for Israeli parliamentary data.
See `PLAN.md` for the full architecture and feature spec.

## Detailed Instruction Files

This file provides the global rules loaded in **every** conversation.
For domain-specific rules, see the files in `.github/instructions/` — each is loaded automatically when you work on matching files (based on its `applyTo` frontmatter):

| File                                      | Applies to                                           | Summary                                                         |
| ----------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------- |
| `ai-provider.instructions.md`             | `src/lib/ai/**`                                      | AI abstraction layer, Vercel AI SDK, Gemini/OpenAI config       |
| `api.instructions.md`                     | `src/server/**`, `src/app/api/**`                    | Zod validation, rate limiting, auth, Drizzle, caching           |
| `components.instructions.md`              | `src/components/**`                                  | Server vs Client components, `t()`, RTL, a11y, dark mode        |
| `config.instructions.md`                  | `app.config.ts`, `src/lib/config.ts`, `.env*`        | Central config pattern, env vars, feature flags                 |
| `i18n.instructions.md`                    | `src/i18n/**`                                        | 4 locales (he/en/ar/ru), key naming, pluralization (ICU)        |
| `pages.instructions.md`                   | `src/app/**`                                         | Route groups, metadata, layouts, PWA caching                    |
| `pipeline.instructions.md`                | `src/pipeline/**`                                    | Cron from config, incremental sync, retry, cache invalidation   |
| `pwa.instructions.md`                     | `public/**`, `next.config.ts`, `src/app/manifest.ts` | Serwist setup, service worker, offline, install prompt          |
| `styling-rtl.instructions.md`             | `**/*.css`, `**/*.tsx`, `src/components/**`          | Logical properties (`ms-`/`me-`/`start`/`end`), dark mode       |
| `ui-consistency.instructions.md`          | `src/components/**`, `src/app/**`                    | shadcn/ui only, filter pattern, card/header/no-results patterns |
| `aikido_rules.instructions.md`            | `**`                                                 | Security scanning with Aikido MCP                               |
| `trigger-basic.instructions.md`           | `**/trigger/**/*.ts`                                 | Trigger.dev task structure, schemaTask, retry config            |
| `trigger-advanced-tasks.instructions.md`  | `**/trigger/**/*.ts`                                 | Tags, batch triggering, debouncing, concurrency, queues         |
| `trigger-config.instructions.md`          | `**/trigger.config.ts`                               | trigger.config.ts setup, build extensions (Prisma, FFmpeg, etc) |
| `trigger-scheduled-tasks.instructions.md` | `**/trigger/**/*.ts`                                 | Scheduled tasks (cron), timezone handling, SDK management       |

> **When multiple domains overlap** (e.g. creating a new page with filters), all matching instruction files are loaded together. This file provides the baseline; the detailed files provide the specifics.

## Core Principles

1. **All user-facing text must be translated** — never hardcode Hebrew/English strings. Use `next-intl` `t()` function. Every string must exist in all 4 locale files: `he.json`, `en.json`, `ar.json`, `ru.json`. _(Details: `i18n.instructions.md`)_
2. **RTL/LTR is automatic** — Hebrew and Arabic are RTL, English and Russian are LTR. Use logical CSS properties (`start`/`end` instead of `left`/`right`). The `dir` attribute is set per-locale in the root layout. _(Details: `styling-rtl.instructions.md`)_
3. **AI provider is abstracted** — never import `openai` or `@google/generative-ai` directly. Use `@/lib/ai/provider` which reads from `appConfig.ai.provider`. _(Details: `ai-provider.instructions.md`)_
4. **All magic numbers go through config** — rate limits, daily chat limits, cron schedules, API URLs — all defined in `app.config.ts` and backed by env vars. _(Details: `config.instructions.md`)_
5. **AI Chat is for registered users only** — any AI chat endpoint must verify authentication. Anonymous users see a prompt to sign up.
6. **PWA compliance** — pages should work offline where possible. Use service worker caching strategies. All icons/manifest are in `public/`. _(Details: `pwa.instructions.md`)_
7. **UI consistency** — always use shadcn/ui components (`<Button>`, `<Input>`, `<Select>`) instead of raw HTML elements. Follow established card, header, filter, and no-results patterns. _(Details: `ui-consistency.instructions.md`)_

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

> Full rules: `components.instructions.md` + `ui-consistency.instructions.md` + `styling-rtl.instructions.md`

- Use Server Components by default, Client Components only when needed
- Use `useTranslations()` from `next-intl` for any displayed text
- Support dark mode via Tailwind `dark:` prefix
- Ensure WCAG 2.1 AA accessibility
- **When adding or changing content in a page/component, always update its corresponding `loading.tsx` skeleton** to match the new structure. The skeleton must reflect the real layout so users see a coherent loading state.
- **No duplicate UI elements** — never render the same visual component (e.g. a stage pipeline / stepper) twice on a page in different sections. If a component needs both display and interaction (e.g. stage stepper + vote drill-down), use a single interactive component that serves both purposes. Related data (e.g. votes) should be listed separately without duplicating the parent navigation.
- **Mobile-first responsive** — all layouts must work from 320px. Use `min-w-0` on text flex children, `shrink-0` on fixed elements, `truncate`/`line-clamp-N` on dynamic text, `overflow-x-auto` on tables and horizontal steppers. See `ui-consistency.instructions.md` for the full checklist.

## When Writing API Endpoints

> Full rules: `api.instructions.md`

- Validate inputs with Zod
- Use `appConfig` for any configurable values
- AI endpoints: always check `auth` + enforce `dailyChatLimit` via Redis counter
- Rate limit via Upstash Redis

## When Working with Data

- All DB access through Drizzle ORM — never raw SQL in application code
- Use tRPC routers for client-facing data
- Cache heavy queries in Redis with configurable TTL

## When Working with the Pipeline

> Full rules: `pipeline.instructions.md`

- Cron schedules and data source URLs from `appConfig` — never hardcode
- Always incremental sync using `lastSyncTimestamp`
- Retry 3× with exponential backoff; structured logging on failure
- After sync: invalidate Redis cache + regenerate AI embeddings

## When Writing Scripts (`src/scripts/`)

- **Environment variables live in `.env.local`** (not `.env`). Load them with `import { config } from 'dotenv'; config({ path: '.env.local' });` at the very top.
- **All app imports (`../lib/db`, `../lib/db/schema`, etc.) must be dynamic** (`await import(...)`) inside an `async function main()`. Static `import` is hoisted before `dotenv` runs, so the DB module will see `undefined` for `DATABASE_URL`.
- Follow the pattern used in `src/scripts/sync.ts`: dotenv config at top, then dynamic imports inside `main()`.

## Workflow

- **After completing a fix or feature, always create a commit** with a clear conventional-commit message (`feat:`, `fix:`, `style:`, `refactor:`, `chore:`, `i18n:`, `docs:`). Group related changes into a single commit; unrelated changes go into separate commits.
- **Every commit must pass TypeScript type-checking** — the pre-commit hook runs `pnpm type-check` (`tsc --noEmit`). Fix all type errors before committing.
