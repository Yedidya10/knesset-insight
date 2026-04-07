# Plan: Elections 2026 Page

## TL;DR
Add a dedicated "Elections 2026" dashboard at `/elections/2026` with two implementation phases:
- **Phase 1 (NOW)**: DB schema, seed data for potential parties, dashboard skeleton, poll tracker, timeline
- **Phase 2 (~1.5 months before elections)**: Finalize lists/candidates, coalition simulator, election-day features

After elections conclude, data migrates into the existing `electoralLists` table and the 2026 page redirects to `/elections?knesset=26`.

---

## Phase 1 — Skeleton + Potential Lists

### Step 1: Database Schema (6 new tables)

Add to `src/lib/db/schema.ts`:

1. **`electionCampaigns`** — The election event itself
   - `id`, `knessetNum` (26), `electionDate` (date, nullable until confirmed), `status` enum: `pre_campaign | campaign | election_day | results | completed`, `createdAt`, `updatedAt`

2. **`electionCandidateLists`** — Parties/movements running
   - `id`, `campaignId` FK→electionCampaigns, `name`, `shortName`, `slug` (unique), `ballotLetters` (nullable until Phase 2), `politicalGroupId` FK→politicalGroups (nullable — for new parties), `leaderName`, `leaderMemberId` FK→members (nullable), `status` enum: `potential | confirmed | withdrawn | disqualified`, `color` (hex), `logoUrl`, `platformSummary`, `platformUrl`, `estimatedSeats` (nullable), `politicalPosition` enum: `left | center_left | center | center_right | right | arab | haredi`, `sortOrder`, `createdAt`, `updatedAt`

3. **`electionCandidates`** — People on lists (rich profile for ALL candidates, MKs and non-MKs alike)
   - `id`, `candidateListId` FK→electionCandidateLists, `memberId` FK→members (nullable — linked only if already an MK), `slug` (unique, for URL), `firstName`, `lastName`, `position` (int, nullable until Phase 2), `status` enum: `potential | confirmed | removed`, `isLeader` boolean
   - **Profile fields**: `bio` (text), `imageUrl`, `birthYear` (int, nullable), `residence` (city/area), `profession`, `education`
   - **Civic/public record**: `civicActivity` (text — public/civic roles, NGO work, military service, etc.), `publicStatements` (text — notable positions/quotes), `platformUrl` (personal campaign page)
   - **Integrity fields**: `integrityNotes` (text — known ethical issues, investigations), `financialDisclosure` (text — summary), `conflictsOfInterest` (text)
   - `createdAt`, `updatedAt`
   
   **Design note**: Every candidate (including sitting MKs) gets a full record here. For MKs, `memberId` links to their existing `members` record so the candidate profile page can also pull their Knesset activity (votes, bills). For non-MKs, the profile page shows only the candidate-specific fields (bio, civic activity, integrity, platform).

4. **`electionPolls`** — Poll metadata
   - `id`, `campaignId` FK→electionCampaigns, `pollsterName`, `publishDate` (date), `sampleSize` (nullable), `marginOfError` (nullable), `sourceUrl`, `createdAt`

5. **`electionPollResults`** — Per-list results in each poll
   - `id`, `pollId` FK→electionPolls, `candidateListId` FK→electionCandidateLists, `predictedSeats` (int)

6. **`electionTimelineEvents`** — Key dates and milestones
   - `id`, `campaignId` FK→electionCampaigns, `title`, `description`, `eventDate` (date), `type` enum: `deadline | event | debate | announcement | milestone`, `isCompleted` boolean, `createdAt`

**Migration**: New Drizzle migration file `drizzle/0007_election_campaigns.sql`

### Step 2: Seed Data (`src/pipeline/seed/elections-2026.json`)

Initial seed file with:
- 1 campaign record (knessetNum=26, status='pre_campaign')
- ~12-16 potential candidate lists based on current Israeli political landscape: Likud, Yesh Atid, National Unity, Shas, UTJ, Labor, Democrats (Meretz successor), Israel Beiteinu, Religious Zionism, Otzma Yehudit, Ra'am, Hadash-Ta'al, Balad, plus placeholder slots for new movements
- Each list linked to existing `politicalGroups` where applicable (via slug)
- Key leaders linked to `members` table where they exist as MKs
- Initial timeline events (estimated election date, list submission deadline, etc.)

Seed script: `src/pipeline/seed/seed-elections-2026.ts` — idempotent upsert by slug

### Step 3: tRPC Router (`src/server/routers/elections-2026.ts`)

Procedures:
- `campaign` — Get campaign metadata (status, date, countdown)
- `candidateLists` — All lists with latest poll data, ordered by estimatedSeats
- `candidateListBySlug` — Single list + candidates + poll history
- `candidateBySlug` — Single candidate profile + MK activity data if linked (votes, bills, participation)
- `polls` — All polls with results, ordered by date desc
- `pollTrends` — Aggregated poll data for chart (list→seats over time)
- `timeline` — All timeline events ordered by date

Register in `src/server/routers/index.ts` as `elections2026`

### Step 4: Page Routes

Create under `src/app/[locale]/(public)/elections/2026/`:

**4a. Dashboard page** (`page.tsx` + `loading.tsx`)
- Election countdown component (days/hours to election date)
- "Latest poll" summary — horizontal bar chart of seat projections
- Grid of CandidateListCards showing: name, leader, status badge, estimated seats, color stripe, political position tag
- Mini timeline showing next 3 upcoming events
- Links to sub-pages (polls, timeline, full party list)

**4b. Parties page** (`parties/page.tsx` + `loading.tsx`)
- Full list of candidate lists, filterable by status (potential/confirmed/all) and political position
- Each card links to `parties/[slug]`

**4c. Party detail page** (`parties/[slug]/page.tsx` + `loading.tsx`)
- Party header (name, logo, color, leader, status)
- Platform summary
- Candidate list (each links to candidate profile page)
- Poll history chart (this party's seats over time)
- Link to parent politicalGroup page if exists

**4d. Candidate profile page** (`parties/[slug]/candidates/[candidateSlug]/page.tsx` + `loading.tsx`)
- Profile header: photo, name, position in list, party badge with color
- **For MKs** (`memberId` linked): pull Knesset activity from `members` — vote summary, bill count, participation rate, committee roles, link to full member page
- **For all candidates**: bio, profession, education, residence, birth year
- Civic activity section: NGO work, public roles, military service
- Integrity section: notes, financial disclosure, conflicts of interest
- Public statements / notable positions
- Platform link (external)
- Reuses existing components where possible: `MemberAvatar`, `IntegritySummary` patterns

**4e. Polls page** (`polls/page.tsx` + `loading.tsx`)
- Line chart (recharts): X=date, Y=seats, one line per party
- Table of all polls: date, pollster, results per party
- Source links

**4f. Timeline page** (`timeline/page.tsx` + `loading.tsx`)
- Vertical timeline UI (styled similar to existing PoliticalTimeline)
- Color-coded by event type
- Completed events styled differently

### Step 5: Components (`src/components/elections/`)

- `ElectionCountdown.tsx` — Client component with countdown timer (useEffect interval)
- `CandidateListCard.tsx` — Card for party in grid view
- `PollTrendChart.tsx` — Recharts LineChart for poll trends
- `SeatProjectionBar.tsx` — Horizontal stacked bar showing 120 seats distribution
- `ElectionTimeline.tsx` — Vertical timeline component
- `ElectionStatusBadge.tsx` — Status badge (potential/confirmed/withdrawn)
- `CandidateCard.tsx` — Individual candidate in a list (links to profile page)
- `CandidateProfile.tsx` — Full candidate profile layout (adapts for MK vs non-MK)
- `CandidateMkActivity.tsx` — MK-specific section: vote summary, bills, participation (fetches from members data)
- `CandidateCivicRecord.tsx` — Civic activity, public statements, integrity notes

### Step 6: i18n (`src/i18n/messages/{he,en,ar,ru}.json`)

Add `elections2026` namespace with keys for:
- Page titles, descriptions
- Status labels (potential, confirmed, withdrawn, disqualified)
- Political positions (left, center, right, etc.)
- Poll-related labels
- Timeline event types
- Countdown labels (days, hours, minutes)
- CTA text, empty states

### Step 7: Navigation Integration

Update existing elections page (`src/app/[locale]/(public)/elections/page.tsx`):
- Add a prominent banner/card at top linking to `/elections/2026` ("בחירות 2026 — עקבו אחרי המירוץ")
- Visually distinct from the historical knesset tabs

### Step 8: Existing Elections Page Link-Back

On `/elections/2026` dashboard, add breadcrumb: Elections > 2026

---

## Phase 2 — Final Lists & Election Day (~1.5 months before elections)

### Step 9: Finalize Candidate Lists
- Update all `electionCandidateLists` statuses to confirmed/withdrawn
- Add official `ballotLetters` 
- Finalize candidate `position` (list order) in `electionCandidates`
- Update seed file to reflect final state

### Step 10: Coalition Simulator Page (`simulator/page.tsx`)
- Client component with interactive party selection
- Users drag/toggle parties into coalition block
- Running total of seats (target: 61+)
- Color-coded hemicycle/arc visualization of coalition vs opposition
- Uses data from latest polls for default seat numbers

### Step 11: Election Day Features
- Real-time results integration (when available from votes.bechirot.gov.il)
- Update campaign status to `election_day` → `results` → `completed`
- Comparison view: poll predictions vs actual results

### Step 12: Post-Election Migration
- Migrate confirmed data into `electoralLists` table (K26 records)
- Update `factions` table with resulting K26 factions
- Set `/elections/2026` to redirect to `/elections?knesset=26`
- Campaign status → `completed`

---

## Relevant Files

### Existing (to modify)
- `src/lib/db/schema.ts` — Add 6 new tables + relations + enums
- `src/server/routers/index.ts` — Register new elections2026 router
- `src/app/[locale]/(public)/elections/page.tsx` — Add banner linking to 2026
- `src/i18n/messages/he.json` — Add elections2026 namespace
- `src/i18n/messages/en.json` — Add elections2026 namespace
- `src/i18n/messages/ar.json` — Add elections2026 namespace
- `src/i18n/messages/ru.json` — Add elections2026 namespace
- `app.config.ts` — Add election 2026 config (estimated date, campaign status toggle)

### New (to create)
- `drizzle/0007_election_campaigns.sql` — Migration
- `src/pipeline/seed/elections-2026.json` — Seed data
- `src/pipeline/seed/seed-elections-2026.ts` — Seed script
- `src/server/routers/elections-2026.ts` — tRPC router
- `src/app/[locale]/(public)/elections/2026/page.tsx` — Dashboard
- `src/app/[locale]/(public)/elections/2026/loading.tsx`
- `src/app/[locale]/(public)/elections/2026/parties/page.tsx`
- `src/app/[locale]/(public)/elections/2026/parties/loading.tsx`
- `src/app/[locale]/(public)/elections/2026/parties/[slug]/page.tsx`
- `src/app/[locale]/(public)/elections/2026/parties/[slug]/loading.tsx`
- `src/app/[locale]/(public)/elections/2026/parties/[slug]/candidates/[candidateSlug]/page.tsx`
- `src/app/[locale]/(public)/elections/2026/parties/[slug]/candidates/[candidateSlug]/loading.tsx`
- `src/app/[locale]/(public)/elections/2026/polls/page.tsx`
- `src/app/[locale]/(public)/elections/2026/polls/loading.tsx`
- `src/app/[locale]/(public)/elections/2026/timeline/page.tsx`
- `src/app/[locale]/(public)/elections/2026/timeline/loading.tsx`
- `src/app/[locale]/(public)/elections/2026/simulator/page.tsx` — Phase 2
- `src/app/[locale]/(public)/elections/2026/simulator/loading.tsx` — Phase 2
- `src/components/elections/ElectionCountdown.tsx`
- `src/components/elections/CandidateListCard.tsx`
- `src/components/elections/PollTrendChart.tsx`
- `src/components/elections/SeatProjectionBar.tsx`
- `src/components/elections/ElectionTimeline.tsx`
- `src/components/elections/ElectionStatusBadge.tsx`
- `src/components/elections/CandidateCard.tsx`
- `src/components/elections/CandidateProfile.tsx`
- `src/components/elections/CandidateMkActivity.tsx`
- `src/components/elections/CandidateCivicRecord.tsx`
- `src/components/elections/CoalitionSimulator.tsx` — Phase 2

### Reference (patterns to follow)
- `src/app/[locale]/(public)/elections/page.tsx` — Existing elections page pattern (knesset tabs, cards, badges)
- `src/components/charts/VoteDistributionChart.tsx` — Recharts usage pattern
- `src/components/political-groups/PoliticalTimeline.tsx` — SVG timeline pattern
- `src/server/routers/political-groups.ts` — tRPC router pattern (list, bySlug)
- `src/pipeline/seed/political-groups.json` — Seed data structure pattern

---

## Verification

### Phase 1
1. Run `pnpm drizzle-kit generate` — migration file created without errors
2. Run seed script — all 2026 data inserted, linked correctly to existing politicalGroups/members
3. Run `pnpm tsc --noEmit` — no type errors
4. Navigate to `/elections` — banner to 2026 visible
5. Navigate to `/elections/2026` — dashboard renders with countdown, party cards, mini timeline
6. Navigate to `/elections/2026/parties` — all candidate lists visible with correct status badges
7. Navigate to `/elections/2026/parties/[slug]` — party detail with candidates rendered
8. Navigate to `/elections/2026/polls` — chart renders (even with few data points)
9. Navigate to `/elections/2026/timeline` — events displayed chronologically
10. Switch locale to en/ar/ru — all text translated, RTL/LTR correct
11. All loading.tsx skeletons match their page layouts
12. Mobile responsive check on all pages

### Phase 2
1. Coalition simulator correctly sums seats
2. 61+ coalition threshold highlighted
3. Post-election migration produces valid electoralLists records

---

## Decisions
- **Route**: `/elections/2026` as sub-route of existing elections — no nav changes needed, banner on elections page provides entry point
- **Data source**: Seed JSON + manual DB updates (no scraping/admin UI in Phase 1)
- **Candidate model**: ALL candidates live in `electionCandidates` table (not in `members`). MK candidates have `memberId` FK for cross-referencing Knesset activity. Non-MK candidates have rich profile fields (bio, civic activity, integrity notes) directly in the table. Every candidate gets their own profile page.
- **Post-election**: Data migrates to `electoralLists` table, 2026 page redirects to history
- **Charts**: recharts (already in project)
- **Political groups**: New parties get new `politicalGroups` records (isActive=true); these can be updated/renamed as the political landscape evolves

## Further Considerations
1. **Admin UI for updates**: Phase 1 uses seed/manual SQL. Consider adding a simple admin dashboard in a future iteration for easier party/poll updates by non-developers.
2. **Notification/subscription**: Users might want to subscribe to election updates — out of scope for now but worth considering for Phase 2.
3. **AI election analysis**: The AI chat could provide election analysis — out of scope but aligns with existing AI chat infrastructure.
