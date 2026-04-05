# Plan: "בעד ונגד" — Topic-Based Stance Pages

## TL;DR

Add a "נושאים בוערים" (Hot Topics) section as a top-level nav item. Each topic page (e.g., conscription, judicial reform) aggregates related votes and bills into a visual "Pro vs Against" split view with faction breakdowns, MK stance scores, and a legislative timeline. Topics are initially seeded manually (3-5), with AI auto-classification of new votes/bills queued for admin approval in a future dashboard.

---

## Phase 1: Data Model & Seed Infrastructure

### Step 1.1 — New DB tables in `src/lib/db/schema.ts`

**`topics` table:**

- id (serial PK), slug (unique, URL-safe), iconName (text, lucide icon name), imageUrl (text, nullable), sortOrder (integer), isActive (boolean default true), createdAt, updatedAt

**`topicTranslations` table:**

- id (serial PK), topicId (FK → topics), locale (text, one of he/en/ar/ru), name (text), description (text), aiSummary (text, nullable), unique(topicId, locale)

**`topicVotes` junction:**

- id (serial PK), topicId (FK → topics), voteId (FK → votes), relevanceScore (real, 0-1, default 1), isApproved (boolean, default true for seeds, false for AI suggestions), suggestedBy (text: 'seed' | 'ai' | 'admin'), createdAt, unique(topicId, voteId)

**`topicBills` junction:**

- id (serial PK), topicId (FK → topics), billId (FK → bills), relevanceScore (real, 0-1, default 1), isApproved (boolean), suggestedBy (text), createdAt, unique(topicId, billId)

Design note: Using a separate `topicTranslations` table (instead of nameHe/nameEn/... columns) because it cleanly scales when locales are added and matches the project's i18n-first approach. Static i18n keys (`topics.pageTitle`, `topics.for`, `topics.against`, etc.) still go in the message JSON files.

### Step 1.2 — Drizzle relations

Add relations: topics ↔ topicTranslations, topics ↔ topicVotes ↔ votes, topics ↔ topicBills ↔ bills

### Step 1.3 — Migration

Run `pnpm drizzle-kit generate`, then apply with manual ALTER TABLE script per repo convention (drizzle-kit push has a bug).

### Step 1.4 — Seed script (`src/scripts/seed-topics.ts`)

Seed 3-5 flagship topics:

1. **גיוס / Conscription** — votes/bills related to military service, exemptions, equality of burden
2. **רפורמה משפטית / Judicial Reform** — judicial overhaul, reasonableness clause, judicial appointments
3. **התנחלויות / Settlements** — West Bank policy, settlement legalization, sovereignty
4. **יוקר המחייה / Cost of Living** — housing, food prices, economic reforms
5. **חינוך / Education** — education reform, curriculum, teacher salaries

Each seed includes: slug, icon, translations in all 4 locales, and initial vote/bill associations (manually identified vote IDs and bill IDs from the DB).

---

## Phase 2: tRPC API Layer

### Step 2.1 — New router: `src/server/routers/topics.ts`

**`topics.list`** (public):

- Returns all active topics with: translations for requested locale, vote count, bill count, aggregate for/against totals (from approved topicVotes)
- Used by: topics index page

**`topics.bySlug`** (public):

- Input: slug
- Returns: topic + translations + counts

**`topics.factionStances`** (public):

- Input: topicSlug
- Aggregates memberVotes across all approved topicVotes, grouped by faction
- Returns: array of { factionId, factionName, isCoalition, forCount, againstCount, abstainCount, totalVotes, stanceScore }
- stanceScore = (forCount - againstCount) / totalVotes → range -1 (fully against) to +1 (fully for)

**`topics.memberStances`** (public):

- Input: topicSlug, limit (default 20), side ('for' | 'against' | 'all')
- Aggregates per-member votes on topic across all approved topicVotes
- Returns: array of { memberId, firstName, lastName, imageUrl, factionName, isCoalition, forCount, againstCount, abstainCount, stanceScore, participationRate }
- Sorted by abs(stanceScore) desc for strongest stances

**`topics.votes`** (public):

- Input: topicSlug, page, pageSize
- Returns: paginated approved votes for this topic with vote details (title, date, for/against/abstain counts, isAccepted)
- Sorted by voteDate desc

**`topics.bills`** (public):

- Input: topicSlug
- Returns: approved bills for this topic with bill details (name, status, billType, proposedDate, initiators)
- Sorted by proposedDate desc

**`topics.timeline`** (public):

- Input: topicSlug
- Returns: merged chronological list of votes + bills with type discriminator
- Each entry: { type: 'vote' | 'bill', date, title, status/result, id }

### Step 2.2 — Register in `src/server/routers/_app.ts`

---

## Phase 3: UI — Topics Index Page

### Step 3.1 — Route: `src/app/[locale]/(public)/topics/page.tsx`

Server component. Fetches `topics.list` via tRPC.

**Layout:**

- Page title "נושאים בוערים" with flame icon
- Subtitle explaining the concept
- Grid of TopicCards (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`) with StaggeredGrid animation

### Step 3.2 — Component: `src/components/topics/TopicCard.tsx`

Client component (for animations).

**Card design:**

- Large icon at top (from lucide-react, mapped by iconName)
- Topic name (bold, large)
- Short description (2 lines, truncated)
- **Mini stance gauge**: horizontal bar split green/red proportionally to aggregate for/against
- Stats row: "{N} הצבעות · {M} הצעות חוק"
- Link to `/topics/{slug}`
- Hover: subtle scale + shadow elevation

### Step 3.3 — Component: `src/components/topics/StanceGauge.tsx`

Reusable visual component (Client component for animation).

**Design:**

- Horizontal bar (full width, rounded)
- Left side green (בעד), right side red (נגד)
- Animated fill on scroll-into-view
- Center marker showing the balance point
- Optional: percentage labels on each side
- Different sizes: 'sm' (for cards), 'md' (for sections), 'lg' (for hero)

---

## Phase 4: UI — Topic Detail Page (the "בעד ונגד" view)

### Step 4.1 — Route: `src/app/[locale]/(public)/topics/[slug]/page.tsx`

Server component. Parallel fetches: bySlug, factionStances, memberStances (top for + top against), timeline, votes (first page).

### Step 4.2 — Hero Section

- Topic icon + name (h1) + description
- Large StanceGauge ('lg' size) showing overall for/against balance
- Animated CountUp numbers on each side: "{X} בעד" vs "{Y} נגד"
- Subtle background gradient: green ← → red (very light, thematic)

### Step 4.3 — Component: `src/components/topics/FactionStanceSection.tsx`

**"מפת הסיעות" (Faction Map)**

**Layout**: Two-column split — Coalition (left/start) vs Opposition (right/end)

Each faction rendered as a `FactionStanceBar`:

- Faction name + seat count badge
- Horizontal stacked bar (green for / red against / yellow abstain)
- Percentage label
- Sorted by stanceScore (most pro at top of "for" side)
- Click → faction detail page

Use the existing `VoteDistributionChart` pattern (Recharts) as visual reference, but implement as a custom CSS component for more control and lighter weight.

### Step 4.4 — Component: `src/components/topics/MemberStanceSection.tsx`

**"חברי כנסת בולטים" (Notable MKs)**

**Layout**: Visual split — "בעד" column (green header) | "נגד" column (red header)

Each side shows top 10 MKs (sorted by stance strength):

- `MemberStanceCard`: Avatar + Name + Faction tag + Stance score badge (e.g., "87% בעד")
- Mini participation indicator
- Click → member profile page
- "הצג עוד" (Show more) button → expands to full list

Use existing `MemberCard` pattern as reference but adapted with stance-specific styling.

### Step 4.5 — Component: `src/components/topics/LegislativeTimeline.tsx`

**"מסלול חקיקה" (Legislative Track)**

Vertical timeline (RTL-aware, line on `end` side for RTL, `start` for LTR):

- Each node: colored dot + date + title + status badge
- **Bill nodes**: Gavel icon, status badges (בועדה, קריאה ראשונה, קריאה שנייה/שלישית, אושר, נדחה)
- **Vote nodes**: Ballot icon, result badge (אושר/נדחה), mini for/against bar
- Nodes connected by a vertical line
- Most recent at top
- Collapsible: show latest 10, "הצג הכל" to expand

Special handling for partial progress: bills that only reached committee or early readings get a distinctive "in progress" or "stalled" visual indicator (amber dot, dashed connector).

### Step 4.6 — Component: `src/components/topics/KeyVotesSection.tsx`

**"הצבעות מרכזיות" (Key Votes)**

List of related votes (paginated, 10 per page):

- Reuse existing vote card pattern from the votes page
- Each: title, date, result badge, mini vote bar
- Sorted by relevanceScore desc, then date desc
- Link to vote detail page

---

## Phase 5: Navigation & i18n

### Step 5.1 — Add nav link

In `src/components/layout/Header.tsx`, add "נושאים" link between "הצבעות" (votes) and "חקיקה" (legislation) in the nav items array.

### Step 5.2 — Add homepage quick link

In `src/app/[locale]/page.tsx`, add a TopicCard-style quick link or a featured topics preview section.

### Step 5.3 — i18n messages (all 4 locales)

Add keys to `he.json`, `en.json`, `ar.json`, `ru.json`:

**`nav.topics`**: "נושאים" / "Topics" / "مواضيع" / "Темы"

**`topics.*`** namespace:

- pageTitle, pageSubtitle
- for, against, abstain, neutral
- stanceScore, participationRate
- factionMap, notableMKs, legislativeTrack, keyVotes
- showMore, showAll, relatedVotes, relatedBills
- stanceLabels: stronglyFor, leaningFor, neutral, leaningAgainst, stronglyAgainst
- billStatus labels: inCommittee, firstReading, secondReading, thirdReading, passed, rejected, stalled
- noTopics, noVotes, noBills

---

## Phase 6: Future — AI Classification & Admin Dashboard (OUT OF SCOPE for initial implementation)

**Noted for future:**

- Pipeline job `sync-topic-suggestions.ts`: After each vote/bill sync, use Gemini to classify new items → insert into topicVotes/topicBills with isApproved=false, suggestedBy='ai'
- Admin dashboard page at `/(dashboard)/topics/`: List pending suggestions, approve/reject, create new topics
- This is Phase 2 of the feature; initial launch uses only seeded data

---

## Relevant Files

### Modify:

- `src/lib/db/schema.ts` — add topics, topicTranslations, topicVotes, topicBills tables + relations
- `src/server/routers/_app.ts` — register topics router
- `src/components/layout/Header.tsx` — add "נושאים" nav link
- `src/app/[locale]/page.tsx` — add topics quick link / featured section
- `src/i18n/messages/he.json` — add `nav.topics` + `topics.*` namespace
- `src/i18n/messages/en.json` — same
- `src/i18n/messages/ar.json` — same
- `src/i18n/messages/ru.json` — same

### Create:

- `src/server/routers/topics.ts` — tRPC router with list/bySlug/factionStances/memberStances/votes/bills/timeline
- `src/app/[locale]/(public)/topics/page.tsx` — topics index page
- `src/app/[locale]/(public)/topics/[slug]/page.tsx` — topic detail page
- `src/components/topics/TopicCard.tsx` — card for index grid
- `src/components/topics/StanceGauge.tsx` — visual for/against balance bar
- `src/components/topics/FactionStanceSection.tsx` — faction breakdown with bars
- `src/components/topics/FactionStanceBar.tsx` — individual faction stance bar
- `src/components/topics/MemberStanceSection.tsx` — notable MKs split view
- `src/components/topics/MemberStanceCard.tsx` — individual MK stance card
- `src/components/topics/LegislativeTimeline.tsx` — vertical timeline of bills + votes
- `src/components/topics/KeyVotesSection.tsx` — paginated key votes list
- `src/components/topics/TopicHero.tsx` — hero section for detail page
- `src/scripts/seed-topics.ts` — seed 3-5 initial topics with vote/bill associations
- `drizzle/0002_topics.sql` — generated migration

### Reference (don't modify):

- `src/components/members/MemberCard.tsx` — pattern for MemberStanceCard
- `src/components/charts/VoteDistributionChart.tsx` — pattern for stance visualizations
- `src/app/[locale]/(public)/votes/[id]/page.tsx` — pattern for faction breakdown queries
- `src/app/[locale]/(public)/votes/page.tsx` — pattern for vote card UI
- `src/components/ui/progress.tsx` — base for StanceGauge
- `src/components/ui/animated-section.tsx` — scroll animation wrapper
- `src/components/ui/staggered-grid.tsx` — grid animation wrapper
- `src/components/ui/count-up.tsx` — animated numbers

---

## Verification

1. **Type check**: `pnpm tsc --noEmit` passes cleanly after all changes
2. **Migration**: Drizzle migration generates and applies correctly; new tables visible in DB
3. **Seed**: Running `npx tsx src/scripts/seed-topics.ts` creates topics with translations and vote/bill associations
4. **tRPC**: Each endpoint returns expected data — test via `/api/trpc/topics.list`, `topics.bySlug`, `topics.factionStances`, etc.
5. **Index page**: `/he/topics` renders topic cards with stance gauges, click navigates to detail
6. **Detail page**: `/he/topics/conscription` renders hero + faction map + MK stances + timeline + key votes
7. **RTL/LTR**: Page renders correctly in Hebrew (RTL) and English (LTR) — logical properties used throughout
8. **i18n**: All text displayed via `t()` function, no hardcoded strings; all 4 locale files have complete keys
9. **Navigation**: "נושאים" appears in header nav and mobile menu between votes and legislation
10. **Responsive**: Layout works on mobile (single column), tablet (2 cols), desktop (full layout) — test at 375px, 768px, 1280px
11. **Accessibility**: All interactive elements have ARIA labels, color is not the only stance indicator (text labels accompany colors)

---

## Decisions

- **topicTranslations table** (not columns) — scales better with locales, cleaner queries with locale filter
- **isApproved + suggestedBy on junctions** — seeds are pre-approved; future AI suggestions default to unapproved, ready for admin dashboard
- **stanceScore = (for - against) / total** — range [-1, +1], intuitive and sortable
- **Seed data**: Vote/bill IDs will be identified manually from the DB during seed script creation
- **Admin dashboard**: explicitly OUT OF SCOPE for this phase (seeded data only)
- **No AI summaries on topics yet** — will be added when admin dashboard is built
- **CSS-based stance bars** (not Recharts) — lighter, more customizable for the split-view layout

## Further Considerations

1. **Vote weighting**: Should "main votes" (קריאה שנייה/שלישית) weigh more than committee votes or reservations in the stance score? Recommendation: Yes, add a `weight` column to `topicVotes` (default 1.0, main votes get 2.0). But this can be added later without schema changes by using the existing `relevanceScore` field.
2. **Historical vs current**: Should stance scores include only current Knesset members or all historical votes? Recommendation: Default to current Knesset with a toggle to show historical data.
3. **Abstain handling**: Should abstentions count toward or against the stance score? Recommendation: Exclude from score calculation (only for/against), but show abstain count separately for transparency.
