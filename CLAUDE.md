# Knesset Insight — Claude Code Instructions

## Project Overview

Knesset Insight is a civic-tech platform for Israeli parliamentary data.
See `PLAN.md` for the full architecture and feature spec.

## Domain-Specific Instruction Files

**IMPORTANT**: Before working on any file, check if it matches a pattern below. If it does, **read the corresponding instruction file first** using `cat .github/instructions/<filename>`.

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

When multiple domains overlap (e.g. creating a new page with filters), read ALL matching instruction files.

## Core Principles

1. **All user-facing text must be translated** — never hardcode Hebrew/English strings. Use `next-intl` `t()` function. Every string must exist in all 4 locale files: `he.json`, `en.json`, `ar.json`, `ru.json`.
2. **RTL/LTR is automatic** — Hebrew and Arabic are RTL, English and Russian are LTR. Use logical CSS properties (`start`/`end` instead of `left`/`right`). The `dir` attribute is set per-locale in the root layout.
3. **AI provider is abstracted** — never import `openai` or `@google/generative-ai` directly. Use `@/lib/ai/provider` which reads from `appConfig.ai.provider`.
4. **All magic numbers go through config** — rate limits, daily chat limits, cron schedules, API URLs — all defined in `app.config.ts` and backed by env vars.
5. **AI Chat is for registered users only** — any AI chat endpoint must verify authentication. Anonymous users see a prompt to sign up.
6. **PWA compliance** — pages should work offline where possible. Use service worker caching strategies. All icons/manifest are in `public/`.
7. **UI consistency** — always use shadcn/ui components (`<Button>`, `<Input>`, `<Select>`) instead of raw HTML elements. Follow established card, header, filter, and no-results patterns.

## Tech Stack

- **Framework**: Next.js 15 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **Database**: Supabase (PostgreSQL) + Drizzle ORM
- **Cache**: Upstash Redis
- **AI**: Gemini (default) via Vercel AI SDK, OpenAI as fallback
- **i18n**: next-intl (he, en, ar, ru)
- **API**: tRPC (type-safe)
- **PWA**: serwist (next-pwa successor)
- **Background Jobs**: Trigger.dev v4

## File Conventions

- Components: PascalCase (`MemberCard.tsx`)
- Utilities/libs: camelCase (`odata-client.ts`)
- i18n keys: dot-separated namespaces (`members.profile.title`)
- Route groups: `(public)`, `(auth)`, `(dashboard)`

## When Writing Components

Read: `components.instructions.md` + `ui-consistency.instructions.md` + `styling-rtl.instructions.md`

- Use Server Components by default, Client Components only when needed
- Use `useTranslations()` from `next-intl` for any displayed text
- Support dark mode via Tailwind `dark:` prefix
- Ensure WCAG 2.1 AA accessibility
- **When adding or changing content in a page/component, always update its corresponding `loading.tsx` skeleton** to match the new structure
- **No duplicate UI elements** — never render the same visual component twice on a page in different sections
- **Mobile-first responsive** — all layouts must work from 320px. Use `min-w-0` on text flex children, `shrink-0` on fixed elements, `truncate`/`line-clamp-N` on dynamic text, `overflow-x-auto` on tables and horizontal steppers

## When Writing API Endpoints

Read: `api.instructions.md`

- Validate inputs with Zod
- Use `appConfig` for any configurable values
- AI endpoints: always check `auth` + enforce `dailyChatLimit` via Redis counter
- Rate limit via Upstash Redis

## When Working with Data

- All DB access through Drizzle ORM — never raw SQL in application code
- Use tRPC routers for client-facing data
- Cache heavy queries in Redis with configurable TTL

## When Working with the Pipeline

Read: `pipeline.instructions.md`

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
- **Every commit must pass TypeScript type-checking** — run `pnpm type-check` (`tsc --noEmit`). Fix all type errors before committing.
- **Branch**: `dev` (working branch). Commit style: conventional commits (commitlint enforced).
- **Drizzle migrations**: If schema changed, run `pnpm drizzle-kit generate` then apply manually. Note: `pnpm drizzle-kit push` has a bug (TypeError on checkValue.replace), use manual ALTER TABLE scripts instead.

## Key Domain Knowledge

### Knesset Vote ID Systems (Critical)

- **PersonID** = `members.knessetId` — the official Knesset person identifier
- **vip_id** (legacy) = zero-padded string "000XXXXXX" in OData v3 `vote_rslts_kmmbr_shadow`
- **v4 MkId** = `KNS_PlenumVoteResult.MkId` — the K25+ vote ID, differs from legacy vip_id for ~10 members
- **members.vipId** stores the v4 MkId (authoritative for K25+)
- **members.legacyVipId** stores legacy vip_id when it differs from v4 MkId (needed for K1-K24 vote matching)
- **Name-based matching is unreliable** — at least two "ישראל כץ" and two "אלי כהן" exist in the vote API

### Sync Checkpoint System

- `syncLog.last_checkpoint` stores JSON checkpoint data per entity
- Each sync job receives `prevCheckpoint` and can return `{ count, checkpoint }` from `runSyncJob`
- Checkpoint tracks `lastItemTimestamp` (max item date) + `lastItemId` (max item ID) for reliable incremental sync
- Jobs use checkpoint's `lastItemTimestamp` over wall-clock `lastSyncAt` for incremental queries

### Political Groups Architecture

- 3 tables: `political_groups`, `political_group_lineage`, `faction_composition_history`
- `factions.political_group_id` FK links factions to canonical cross-term groups
- Seed: `src/pipeline/seed/political-groups.json` (46 groups, 279 faction links, 12 lineage entries)
- tRPC router: `src/server/routers/political-groups.ts` (list, bySlug, graph, timeline)
- Pages: `/political-groups`, `/political-groups/[slug]`, `/political-groups/timeline`, `/political-groups/graph`

## Memory Bridge

Claude Code cannot access GitHub Copilot's `/memories/repo/` directory. The domain knowledge above is a snapshot of that data. For the latest project knowledge, also check:

- `docs/` — architecture decisions, feature specs, data source documentation
- `.github/instructions/` — domain-specific coding rules (always read before editing matching files)
- `app.config.ts` — all configurable values, feature flags, API URLs
