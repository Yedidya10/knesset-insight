# 13 — Bill Intelligence Pipeline (חילוץ תובנות + סיווג עמדות מדיניות)

> End-to-end pipeline from **bill documents** → **AI summaries** →
> **per-vote policy stance classification** → **MK position profiles**.
> Combines official Knesset documents, web search, and AI analysis
> to produce both human-readable summaries and structured stance data
> for tracking how each MK votes on policy issues.

## Problem

Two separate but connected problems:

### Problem A: Poor Bill Summaries

The current pipeline uses **Tavily web search → Claude Sonnet** to generate
bill summaries. This works well for prominent bills that have media coverage,
but:

1. Many bills get **0 Tavily results** (especially technical/niche ones)
2. Web search only finds **news commentary**, not the **actual bill text**
3. "דברי הסבר" (explanatory notes) embedded in the bill PDFs contain the
   most authoritative description of what a bill does — but we don't read them
4. Tags remain too generic when the AI only has a bill name and a news snippet

### Problem B: No Directional Vote Analysis

Bills and their votes don't tell you **what direction** an MK's vote
represents. Simple domain counting is meaningless:

| Bill                                      | Vote "FOR" means...                          |
| ----------------------------------------- | -------------------------------------------- |
| הפחתת רוב דיירים מ-66% ל-51% לפינוי-בינוי | Making it **easier** to demolish and rebuild |
| חובת אישור 80% מדיירים להריסה             | Making it **harder** to demolish and rebuild |

Both bills are "housing" — but counting FOR votes per domain tells you nothing.
We need to know **which direction** each vote pushes.

Furthermore, complex bills (חוקי הסדרים / תקציב) have **multiple votes on
different sections** — an MK may vote FOR energy reform but AGAINST food price
deregulation in the same bill. The **bill** is one unit, but each **vote** is
a distinct policy statement.

## Solution: Multi-Source Context Building

Enrich the AI prompt with **actual bill documents** from `KNS_DocumentBill`
before generating summaries. The priority order:

```
1. Official bill text PDF/DOC (דברי הסבר + נוסח)  ← new
2. Background materials (חומר רקע)                 ← new
3. Research center docs (מסמך מרכז מחקר)           ← new
4. Tavily web search                               ← existing
5. Bill metadata (name, type, status, date)         ← existing
```

## Data Source: `KNS_DocumentBill` (OData)

Each bill can have multiple associated documents on `fs.knesset.gov.il`.

### Document Types by Priority

| Priority     | GroupTypeID | Description                           | Format | Content Value                            |
| ------------ | ----------- | ------------------------------------- | ------ | ---------------------------------------- |
| **1**        | 4           | הצעת חוק לקריאה השנייה והשלישית       | PDF    | Final bill text, highest value           |
| **2**        | 2           | הצעת חוק לקריאה הראשונה               | PDF    | Bill text after first reading            |
| **3**        | 1           | הצעת חוק לדיון מוקדם                  | DOC    | Initial proposal with דברי הסבר          |
| **4**        | 3           | הצעת חוק לקריאה ראשונה - נוסח מתוקן   | DOCX   | Corrected text                           |
| **5**        | 60          | הצ"ח לקריאה ב'+ג' - נוסח לדיון בוועדה | PDF    | Committee discussion version             |
| **6**        | 59          | חומר רקע                              | PDF    | Background material (econ plan chapters) |
| **7**        | 12          | מסמך מרכז מחקר ומידע                  | PDF    | Research center analysis                 |
| **8**        | 17          | החלטת ממשלה                           | PDF    | Government decision                      |
| Nice-to-have | 5,7,50      | לוח תיקונים                           | PDF    | Amendment tables                         |
| Nice-to-have | 8           | חוק - נוסח לא רשמי                    | DOC    | Unofficial law text                      |
| Nice-to-have | 9           | חוק - פרסום ברשומות                   | PDF    | Published in Reshumot                    |

### File Server URL Pattern

```
https://fs.knesset.gov.il/{knessetNum}/law/{knessetNum}_{prefix}_{docId}.{ext}
```

Example: `https://fs.knesset.gov.il/25/law/25_ls2_12079291.pdf`

Note: Backslashes in OData responses (`\25\law\...`) must be normalized to
forward slashes for HTTP access.

## Stage Versioning (תקצירים לפי שלב חקיקה)

### Problem

Bills progress through legislative stages over time. A bill may first appear
at "preliminary discussion" (דיון מוקדם), later reach "first reading", and
eventually pass at "2nd+3rd reading". Each stage has its own document and
context. Two scenarios exist:

1. **Backfill** — historical bills already have all their documents. We process
   the highest-priority document and generate a single summary.
2. **Real-time (cron)** — ongoing bills get new documents as they progress.
   When a bill moves from first reading to third reading, we must **update**
   with the new document but **preserve** the earlier stage summary for the
   stepper UI.

### Design: Separate `bill_stage_summaries` Table

Keep `bills.aiSummary` and `bills.aiTopics` as the **current/latest** values
(backward compatible — no existing queries break). Store per-stage history in
a dedicated table:

```sql
CREATE TABLE bill_stage_summaries (
  id SERIAL PRIMARY KEY,
  bill_id INTEGER REFERENCES bills(id) NOT NULL,
  stage INTEGER NOT NULL,                    -- BillStage enum (0-6)
  summary JSONB NOT NULL,                    -- { he, en, ar, ru }
  topics JSONB,                              -- { he: [...], en: [...], ... }
  source_doc_type INTEGER,                   -- GroupTypeID of the document used
  source_doc_id INTEGER,                     -- FK to bill_documents.id
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bill_id, stage)
);
CREATE INDEX idx_bill_stage_summaries_bill ON bill_stage_summaries(bill_id);
```

### Document Type → Stage Mapping

| GroupTypeID | Document                  | BillStage                  |
| ----------- | ------------------------- | -------------------------- |
| 1           | הצעת חוק לדיון מוקדם      | PRELIMINARY (1)            |
| 2           | הצעת חוק לקריאה הראשונה   | FIRST_READING (3)          |
| 3           | נוסח מתוקן לקריאה ראשונה  | FIRST_READING (3)          |
| 4           | הצעת חוק לקריאה ב'+ג'     | SECOND_THIRD_READING (5)   |
| 60          | נוסח לדיון בוועדה (ב'+ג') | COMMITTEE_SECOND (4)       |
| 59          | חומר רקע                  | (use bill's current stage) |
| 12          | מסמך מרכז מחקר ומידע      | (use bill's current stage) |
| 17          | החלטת ממשלה               | SUBMITTED (0)              |

### Write Logic

```
On summary generation:
├── Determine stage from document type (see mapping above)
├── UPSERT into bill_stage_summaries (bill_id, stage)
│   → Overwrites if same stage is regenerated (e.g. corrected doc)
├── If this is the HIGHEST stage so far for this bill:
│   ├── Update bills.aiSummary ← new summary
│   └── Update bills.aiTopics  ← new topics
└── If NOT the highest stage:
    └── Only write to bill_stage_summaries (don't overwrite latest)
```

### Read Logic (Stepper UI)

```
InteractiveStagePipeline
├── Receives bill.aiSummary as "current" summary (always shown)
├── Query bill_stage_summaries WHERE bill_id = ? ORDER BY stage
├── For each completed stage in the stepper:
│   └── If a stage summary exists → show it in the stage detail panel
│       (e.g. tooltip, expandable section, or StageVotePanel)
└── Stages without a dedicated summary show nothing extra
```

### Topic Update Policy

- **Always store** topics alongside the stage summary in `bill_stage_summaries`
- **Update `bills.aiTopics`** (the "current" set) only when:
  1. Processing a **higher stage** than what was previously stored, OR
  2. Topics changed **significantly** (>50% new tags vs previous)
- Rationale: topic classifications rarely shift between stages unless the bill
  text was substantially amended in committee. Preliminary → first reading
  usually has the same topics. But committee rewrites (e.g. הצעת חוק הסדרים
  chapters restructured) can change classifications meaningfully.

### Backfill vs. Cron Behavior

| Scenario                                       | Behavior                                                                                                                                                 |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Backfill** (historical bill, all docs exist) | Process highest-priority doc → write to `bills.aiSummary` + `bill_stage_summaries`. Optionally process lower-stage docs too for richer stepper data.     |
| **Cron** (new doc appears for existing bill)   | Determine stage → UPSERT into `bill_stage_summaries`. If highest stage → also update `bills.aiSummary/aiTopics`. Previous stage summaries are preserved. |
| **Cron** (brand new bill, first doc)           | Normal flow — write to both tables.                                                                                                                      |
| **Regeneration** (manual re-run)               | Same as backfill. UPSERT replaces old stage summary.                                                                                                     |

---

---

# Part A: Document Reading & Summaries

## Architecture

### Phase 1: Sync Bill Documents (new job)

```
sync-bill-documents.ts
├── Fetch KNS_DocumentBill from OData (v4)
│   $select=Id,BillID,GroupTypeID,GroupTypeDesc,ApplicationDesc,FilePath,LastUpdatedDate
│   $orderby=LastUpdatedDate desc
├── Normalize FilePath (backslash → forward slash)
├── Upsert into bill_documents table
└── Checkpoint by LastUpdatedDate
```

**New table: `bill_documents`**

```sql
CREATE TABLE bill_documents (
  id SERIAL PRIMARY KEY,
  knesset_doc_id INTEGER UNIQUE NOT NULL,  -- DocumentBillID from OData
  bill_id INTEGER REFERENCES bills(id),     -- FK to our bills table
  knesset_bill_id INTEGER NOT NULL,         -- BillID from OData (for linking)
  group_type_id INTEGER NOT NULL,
  group_type_desc TEXT NOT NULL,
  application_desc TEXT NOT NULL,            -- DOC, PDF, DOCX, etc.
  file_path TEXT NOT NULL,                   -- Normalized URL
  last_updated TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_bill_documents_bill_id ON bill_documents(bill_id);
CREATE INDEX idx_bill_documents_type ON bill_documents(group_type_id);
```

### Phase 2: Document Reading (new module)

```
src/lib/ai/legislation/document-reader.ts
├── fetchBillDocuments(billKnessetId) → BillDocument[]
│   Query bill_documents by bill_id, ordered by priority
├── readDocument(doc: BillDocument) → string
│   ├── PDF → unpdf (local text extraction, $0)
│   ├── DOC/DOCX → officeparser → plain text
│   └── Fallback: skip if unavailable/too large
└── extractExplanatoryNotes(fullText) → string
    Extract "דברי הסבר" section from bill text (pattern matching)
```

**Why local extraction (unpdf) for PDF reading:**

- **Zero cost** — no API calls, no tokens, runs locally
- No rate limits or API keys needed
- Knesset bill PDFs are text-based (not scanned images) so OCR is unnecessary
- Handles Hebrew text well via standard PDF text extraction
- If a PDF is image-based (rare), `unpdf` returns empty → falls back to
  summary from metadata only (same as if document were unavailable)

**Why officeparser for DOC:**

- DOC files have plain text that can be extracted without AI
- No reason to burn tokens on text extraction
- `officeparser` handles both `.doc` and `.docx` formats

### Phase 3: Enhanced Summary Generator (Stage-Aware)

Update `summary-generator.ts` to incorporate document text and per-stage storage:

```
generateBillSummary(bill, chapterNames?)
├── 1. Fetch bill_documents ordered by type priority
│      Prioritize: Type 4 > 2 > 1 > 3 > 60 > 59 > 12
├── 2. Group documents by stage (DocType → BillStage mapping)
├── 3. For each stage with unprocessed documents (or highest only for backfill):
│      ├── Read document (PDF via unpdf / DOC via officeparser)
│      ├── Extract "דברי הסבר" section if present
│      ├── Tavily web search (optional — public debate context only,
│      │     not for bill comprehension; document text is sufficient)
│      ├── Build enhanced prompt with document context
│      ├── Claude Sonnet → summary + topics in 4 languages
│      ├── UPSERT into bill_stage_summaries (bill_id, stage)
│      └── If this is the highest stage:
│            ├── Update bills.aiSummary
│            └── Update bills.aiTopics (if significantly changed)
└── 4. Return results
```

**Determining "highest stage":**

```typescript
// Query the max stage already stored for this bill
const maxExistingStage = await db
  .select({ max: max(billStageSummaries.stage) })
  .from(billStageSummaries)
  .where(eq(billStageSummaries.billId, billId));

// Only update bills.aiSummary if new stage >= max existing
if (newStage >= (maxExistingStage ?? -1)) {
  await db
    .update(bills)
    .set({ aiSummary, aiTopics })
    .where(eq(bills.id, billId));
}
```

**Document context section in prompt:**

```
OFFICIAL BILL DOCUMENT:
The following is the actual text of the bill (or its explanatory notes).
Use this as the PRIMARY source for your summary. Web search results serve
as SUPPLEMENTARY context only.

--- BEGIN DOCUMENT ---
{extracted_text}
--- END DOCUMENT ---
```

### Phase 4: Updated Prompt

Add to `BILL_SUMMARY_SKILL`:

```
DOCUMENT CONTEXT PRIORITY:
- The official bill document is your PRIMARY and SUFFICIENT source for
  understanding what the bill does. You should not need web search to
  comprehend the bill's provisions.
- דברי הסבר (explanatory notes) describe the bill's PURPOSE and IMPACT — use
  these to write the summary and derive meaningful topic tags.
- Web search results (Tavily) are OPTIONAL SUPPLEMENTARY context — use them
  ONLY when you need information about public debate, implementation status,
  or political context that the document itself cannot provide.
- If the document text is available, your tags MUST reflect the specific
  provisions described in the document, not just the broad topic.
- When NO document is available, web search becomes primary (legacy behavior).
```

## Cost Estimates

| Item                        | Volume                         | Tokens    | Cost             |
| --------------------------- | ------------------------------ | --------- | ---------------- |
| PDF text extraction (unpdf) | ~5,000 bills                   | 0 (local) | **$0**           |
| DOC text extraction         | ~3,000 bills                   | 0 (local) | **$0**           |
| Claude Sonnet generation    | ~14,000 bills × 2K tok         | ~28M      | **~$84**         |
| Tavily search (summaries)   | ~6,000 bills without docs only | —         | **~$48** (basic) |
| **Total**                   |                                |           | **~$132**        |

Note: PDF/DOC text extraction is entirely local (unpdf + officeparser) with
zero API cost. Tavily cost reduced from ~$112 to ~$48 — with document text as
PRIMARY source, web search is only needed for bills without a readable document
(~40% of corpus) and for public debate context on high-profile legislation.
Bills with good document text skip Tavily entirely.

vs. current approach without documents: **~$154** (Tavily for all + Claude)
→ Document reading **saves** ~$22 (−14%) while producing significantly better quality.

---

# Part B: Policy Stance Classification (סיווג עמדות מדיניות)

> Per-vote directional classification of parliamentary votes into curated
> policy stances, enabling accurate "MK X voted strongly for affordable
> housing" analysis. Based on the [TheyVoteForYou](https://theyvoteforyou.org.au)
> methodology, adapted for automated AI classification with admin review.

## Core Concepts

| Concept           | Definition                                                     | Example                                     |
| ----------------- | -------------------------------------------------------------- | ------------------------------------------- |
| **Policy Stance** | A directional policy position that can be supported or opposed | "הקלת תנאי התחדשות עירונית"                 |
| **Pro-Position**  | What a FOR vote on a specific division represents              | "אישור הפחתת רוב דיירים ל-51% לפינוי-בינוי" |
| **Alignment**     | Whether a FOR vote supports or opposes the stance              | `supports` or `opposes`                     |
| **Confidence**    | AI's certainty in the classification (0.0–1.0)                 | 0.92                                        |

## Per-Vote Classification Flow

```
For each vote linked to a bill:
├── 1. Collect context:
│      ├── Vote title (enriched with session item)
│      ├── Bill document text (from Part A document reading)
│      ├── Bill name, stage, status
│      └── Other votes on same bill (for context)
├── 2. Claude Sonnet classifies:
│      ├── proPosition: what does FOR mean? (4 languages)
│      ├── Suggested policy stance match (from existing list)
│      │   OR suggest a NEW stance label if none fits
│      ├── alignment: supports | opposes
│      └── confidence: 0.0–1.0
├── 3. Routing:
│      ├── confidence ≥ threshold → auto-approve, write to DB
│      └── confidence < threshold → queue for admin review
└── 4. Store in vote_stance_alignment table
```

### Bill Document Context for Vote Classification

When a bill has multiple votes on different sections (e.g., חוקי הסדרים),
the AI needs the **bill document** to understand what each vote refers to.
The document reading pipeline (Part A) provides this:

```
BILL DOCUMENT CONTEXT:
The following is the bill text. Use it to understand what the specific
vote sections refer to.

--- BEGIN DOCUMENT ---
{bill_document_text}
--- END DOCUMENT ---

VOTE TO CLASSIFY:
Title: "הצעת חוק ההתייעלות הכלכלית — סעיפים 9-10 כהצעת הוועדה"
Vote date: 2026-03-30
Result: Accepted (for: 52, against: 40)

Based on the bill document, what do sections 9-10 cover?
What does a FOR vote on these sections represent?
```

For simple bills with a single vote, the bill summary/topics provide
sufficient context without needing the full document.

---

## MK Position Scale

Following TheyVoteForYou's proven methodology, each MK's position on a
policy stance is calculated from their voting record and displayed on
an ordinal scale:

| Score Range | Hebrew Label              | English Label                      |
| ----------- | ------------------------- | ---------------------------------- |
| ≥ 95%       | הצביע בעקביות בעד         | Voted consistently for             |
| 85–94%      | הצביע כמעט תמיד בעד       | Voted almost always for            |
| 60–84%      | הצביע בדרך כלל בעד        | Voted generally for                |
| 40–59%      | הצביע בתערובת של בעד ונגד | Voted a mixture of for and against |
| 16–39%      | הצביע בדרך כלל נגד        | Voted generally against            |
| 6–15%       | הצביע כמעט תמיד נגד       | Voted almost always against        |
| ≤ 5%        | הצביע בעקביות נגד         | Voted consistently against         |
| —           | לא הצביע בנושא זה         | Never voted on this                |

### Score Calculation

```sql
-- For MK {member_id} on stance {stance_id}:
SELECT
  count(*) FILTER (WHERE
    (vsa.alignment = 'supports' AND mv.vote_value = 'for') OR
    (vsa.alignment = 'opposes' AND mv.vote_value = 'against')
  )::float
  /
  NULLIF(count(*) FILTER (WHERE
    mv.vote_value IN ('for', 'against')
  ), 0)
  AS alignment_score
FROM member_votes mv
JOIN vote_stance_alignment vsa ON vsa.vote_id = mv.vote_id
WHERE mv.member_id = {member_id}
  AND vsa.stance_id = {stance_id}
  AND vsa.needs_review = false;

-- alignment_score: 0.0 = always opposed, 1.0 = always supported
-- NULL = never voted (absent/abstain only)
```

**Key rules:**

- Only count `for` and `against` votes (abstain/absent = non-participation)
- Only include reviewed/approved alignments (`needs_review = false`)
- Minimum vote threshold: at least 2 votes needed to show a score
  (avoid "100% for" based on a single vote)

### Faction Position Score

Since Israeli parliament operates with strong factional discipline (משמעת
סיעתית), faction-level aggregation is often more meaningful than individual
MK scores. The faction score aggregates all member votes:

```sql
-- For faction {faction_id} on stance {stance_id}:
SELECT
  count(*) FILTER (WHERE
    (vsa.alignment = 'supports' AND mv.vote_value = 'for') OR
    (vsa.alignment = 'opposes' AND mv.vote_value = 'against')
  )::float
  /
  NULLIF(count(*) FILTER (WHERE
    mv.vote_value IN ('for', 'against')
  ), 0)
  AS alignment_score,
  count(DISTINCT mv.vote_id) AS relevant_vote_count,
  count(DISTINCT mv.member_id) AS participating_members
FROM member_votes mv
JOIN members m ON m.id = mv.member_id
JOIN vote_stance_alignment vsa ON vsa.vote_id = mv.vote_id
WHERE m.faction_id = {faction_id}
  AND vsa.stance_id = {stance_id}
  AND vsa.needs_review = false;
```

**Faction score uses the same 7-level scale as MK scores.** The labels
adjust naturally:

| Score Range | Hebrew Label (faction)           | English Label (faction)                    |
| ----------- | -------------------------------- | ------------------------------------------ |
| ≥ 95%       | הסיעה הצביעה בעקביות בעד         | Faction voted consistently for             |
| 85–94%      | הסיעה הצביעה כמעט תמיד בעד       | Faction voted almost always for            |
| 60–84%      | הסיעה הצביעה בדרך כלל בעד        | Faction voted generally for                |
| 40–59%      | הסיעה הצביעה בתערובת של בעד ונגד | Faction voted a mixture of for and against |
| 16–39%      | הסיעה הצביעה בדרך כלל נגד        | Faction voted generally against            |
| 6–15%       | הסיעה הצביעה כמעט תמיד נגד       | Faction voted almost always against        |
| ≤ 5%        | הסיעה הצביעה בעקביות נגד         | Faction voted consistently against         |
| —           | הסיעה לא הצביעה בנושא זה         | Faction never voted on this                |

**Faction discipline indicator:** When displaying a faction score, also show
the **internal cohesion** — what percentage of the faction's members voted
in the same direction. High cohesion (>90%) = strong discipline. Low cohesion
(<60%) = genuine internal disagreement on this policy.

```sql
-- Cohesion: count how many members voted with the faction majority
-- vs. total members who voted
```

**Important:** Faction scores are scoped to the **current knesset** by
default. Historical factions (merged/split) are shown separately with
their period-appropriate membership.

---

## Policies Page (דף מדיניות ראשי)

> **Route: `/[locale]/policies`**
>
> A dedicated top-level page inspired by
> [TheyVoteForYou](https://theyvoteforyou.org.au/policies) where users
> can browse all policy stances, filter by domain, and see how every MK
> and faction scored on each stance.

### Page Structure

#### 1. Policies Index (`/[locale]/policies`)

```
┌─────────────────────────────────────────────────────────────┐
│  🏛️  מדיניות הכנסת                                         │
│  ──────────────────────                                     │
│  [חיפוש חופשי...        ]   [תחום ▼]   [סוג: ישיר/נגזר ▼]  │
│                                                             │
│  ┌─ ביטחון לאומי ────────────────────────────────────────┐  │
│  │  🎯 תמיכה בהרחבת פעולות צבאיות בגדה המערבית  (38 הצ') │  │
│  │  🎯 הגדלת תקציב הביטחון                        (12 הצ') │  │
│  │  🔍 פיתוח טריטוריאלי ביו"ש                     (25 הצ') │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─ רווחה וביטוח לאומי ──────────────────────────────────┐  │
│  │  🎯 הרחבת קצבאות ילדים                          (8 הצ') │  │
│  │  🔍 הטבות דמוגרפיות למשפחות מרובות ילדים       (8 הצ') │  │
│  │  🎯 העלאת שכר המינימום                         (5 הצ') │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  🎯 = ישיר (direct)   🔍 = נגזר (derived)                   │
│  מספר הצבעות = votes linked to this stance                  │
└─────────────────────────────────────────────────────────────┘
```

- Grouped by `domain`, sorted by `vote_count` within each domain
- Direct stances (🎯) shown first, derived stances (🔍) after
- Click on any stance → policy detail page

#### 2. Policy Detail (`/[locale]/policies/[stanceId]`)

Inspired by TheyVoteForYou's policy detail page. Two views: **MKs** and
**Factions**, toggled by tabs.

```
┌─────────────────────────────────────────────────────────────┐
│  הרחבת קצבאות ילדים                                         │
│  תחום: רווחה וביטוח לאומי  ·  סוג: ישיר  ·  22 הצבעות      │
│  ────────────────────────────────────────────────────────── │
│  [חברי כנסת]  [סיעות]                                       │
│                                                             │
│  ═══ חברי כנסת ══════════════════════════════════════════   │
│                                                             │
│  ▼ הצביעו באופן עקבי בעד (>95%)                             │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐              │
│  │ [img]│ │ [img]│ │ [img]│ │ [img]│ │ [img]│ ...          │
│  │ דרעי │ │ גפני │ │ טאוב │ │ גולד │ │ מרגי │              │
│  │ ש"ס  │ │ יהתה │ │ יהתה │ │ יהתה │ │ ש"ס  │              │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘              │
│                                                             │
│  ▼ הצביעו ברוב המקרים בעד (80-95%)                          │
│  ┌──────┐ ┌──────┐ ┌──────┐                                 │
│  │ [img]│ │ [img]│ │ [img]│ ...                             │
│  │ כהן  │ │ לוי  │ │ ביטון│                                 │
│  │ ליכוד│ │ ליכוד│ │ ש"ס  │                                 │
│  └──────┘ └──────┘ └──────┘                                 │
│                                                             │
│  ▼ הצביעו באופן מעורב (40-60%)                               │
│  ...                                                        │
│                                                             │
│  ▼ הצביעו באופן עקבי נגד (<5%)                               │
│  ┌──────┐ ┌──────┐ ┌──────┐                                 │
│  │ [img]│ │ [img]│ │ [img]│ ...                             │
│  │ לפיד│ │ הורו │ │ ליבר │                                 │
│  │ י"ע  │ │ ישאת │ │ ישאת │                                 │
│  └──────┘ └──────┘ └──────┘                                 │
│                                                             │
│  ▼ לא ניתן לקבוע (מעט הצבעות)                               │
│  ...                                                        │
│                                                             │
│  ═══ אסמכתאות: הצבעות רלוונטיות ═══════════════════════════  │
│  כל הצבעה מקושרת לדף ההצבעה + לדף החוק — המשתמש תמיד יכול  │
│  לאמת את הנתונים בעצמו.                                     │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 30.03.2026 │ סעיף 25 כהצעת הוועדה  │ ✅ אושר (52-40) │  │
│  │ חוק התייעלות הכלכלית        🔗 לחוק  🔗 להצבעה       │  │
│  │────────────────────────────────────────────────────────│  │
│  │ 15.02.2026 │ הצעת חוק קצבאות ילדים │ ❌ נדחה (38-54) │  │
│  │ הצעת חוק קצבאות ילדים       🔗 לחוק  🔗 להצבעה       │  │
│  └────────────────────────────────────────────────────────┘  │
│  🔗 לחוק = קישור לדף החוק במערכת   🔗 להצבעה = לדף ההצבעה  │
└─────────────────────────────────────────────────────────────┘
```

**Factions tab:**

```
┌─────────────────────────────────────────────────────────────┐
│  [חברי כנסת]  [סיעות]  ← active                            │
│                                                             │
│  ═══ סיעות ══════════════════════════════════════════════   │
│                                                             │
│  ▼ הצביעו באופן עקבי בעד (>95%)                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ ש"ס (11 מנדטים)              98% בעד  │ לכידות: 97%  │ │
│  │ יהדות התורה (7 מנדטים)       96% בעד  │ לכידות: 100% │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ▼ הצביעו ברוב המקרים בעד (80-95%)                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ הליכוד (32 מנדטים)           87% בעד  │ לכידות: 82%  │ │
│  │ הציונות הדתית (7 מנדטים)     83% בעד  │ לכידות: 78%  │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ▼ הצביעו באופן עקבי נגד (<5%)                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ יש עתיד (24 מנדטים)          3% בעד   │ לכידות: 95%  │ │
│  │ ישראל ביתנו (6 מנדטים)       2% בעד   │ לכידות: 100% │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  "לכידות" = faction cohesion — % of members who voted with  │
│  the faction majority direction on this stance              │
└─────────────────────────────────────────────────────────────┘
```

### Integration Points

**MK Profile Page (`/[locale]/members/[id]`):**

Shows the MK's stance scores as cards, filterable by domain. Each stance card
includes:

- Score label (7-level scale) + visual bar
- Link to policy detail page
- **אסמכתאות (קישורי הוכחה)**: לחיצה על כרטיס מדיניות מרחיבה את
  רשימת ההצבעות הרלוונטיות — כל הצבעה מקושרת לדף ההצבעה ולדף החוק.
  המשתמש תמיד יכול לאמת את הנתונים בעצמו.
- Both `direct` and `derived` stances shown (`derived` visually
  distinguished, e.g. a 🔍 badge)

**Faction Detail Page (future expansion):**

Add a "Policy Positions" tab to the existing faction detail page, showing
that faction's scores across all stances.

### tRPC Endpoints for Policies Page

```typescript
// policies.list — index page
policies.list({
  domain?: PolicyDomain,       // filter by domain
  stanceType?: 'direct' | 'derived' | 'all',
  knessetNum?: number,         // default: current
  sort?: 'vote_count' | 'label',
})
→ PolicyStance[] with vote_count

// policies.detail — policy detail page
policies.detail({
  stanceId: number,
  view: 'members' | 'factions',
  knessetNum?: number,
})
→ {
  stance: PolicyStance,
  // Grouped by the 7-level scale:
  tiers: Array<{
    level: string,           // 'very_strongly_for' | 'strongly_for' | ...
    label: Record<Locale, string>,
    items: MKScore[] | FactionScore[],
  }>,
  relevantVotes: Vote[],      // linked votes with date, title, result
}

// MKScore:
{ memberId, name, image, factionName, factionColor, score, voteCount }

// FactionScore:
{ factionId, name, color, seats, isCoalition, score, voteCount,
  cohesion, participatingMembers }
```

### `policy_stances` — Curated Policy Positions

```sql
CREATE TABLE policy_stances (
  id SERIAL PRIMARY KEY,
  label JSONB NOT NULL,              -- {he: "הקלת תנאי התחדשות עירונית", en: "..."}
  description JSONB,                 -- longer explanation, 4 languages
  domain TEXT,                       -- for filtering: housing, security, etc.
  stance_type TEXT NOT NULL DEFAULT 'direct'
    CHECK (stance_type IN ('direct', 'derived')),
    -- direct  = what the bill explicitly does
    -- derived = disproportionate impact / hidden agenda identified by AI
  is_active BOOLEAN DEFAULT true,    -- soft-delete / archive
  vote_count INTEGER DEFAULT 0,      -- denormalized: how many votes linked
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_policy_stances_domain ON policy_stances(domain);
CREATE INDEX idx_policy_stances_type ON policy_stances(stance_type);
```

**Stance Types:**

| Type      | Description                                                     | Example                                                            |
| --------- | --------------------------------------------------------------- | ------------------------------------------------------------------ |
| `direct`  | What the bill explicitly does — derived from its text/title     | "הקלת תנאי התחדשות עירונית"                                        |
| `derived` | Hidden/secondary agenda — who disproportionately benefits/loses | "הטבות כלכליות דיספרופורציונליות למשפחות מרובות ילדים (מגזר חרדי)" |

**Rules for `derived` stances:**

- Higher confidence threshold for auto-approval: **0.85** (vs 0.7 for direct)
- Always require admin review before first publication
- Must be **factual** (describe impact) not **judgmental** (assign intent)
  - GOOD: "משפחות עם 6+ ילדים מרוויחות פי 3 מהממוצע"
  - BAD: "חוק חרדי שנועד לקנות קולות"
- Seeded from a **curated list** of known secondary-impact patterns (see below)
- AI can suggest new derived stances but they always go to admin review

**Curated Derived-Stance Patterns (initial seed):**

The table below is grounded in recurring legislative patterns documented in
Israeli parliamentary history. Each pattern represents a _secondary impact_
axis that transcends the bill's stated purpose. The AI uses these as a
checklist when classifying derived stances. Tavily political-context searches
(see "Tavily for Derived Stance Detection" below) provide the era-specific
signals to ground each classification.

| #   | Pattern                         | Hebrew Label                            | Example Bills / Precedents                                          |
| --- | ------------------------------- | --------------------------------------- | ------------------------------------------------------------------- |
| 1   | Haredi demographic benefit      | הטבות דמוגרפיות למשפחות מרובות ילדים    | קצבאות ילדים, פטור מגיוס, תקצוב ישיבות                              |
| 2   | Settlement territorial          | פיתוח טריטוריאלי ביו"ש                  | תקציבי בינוי, הסדרת מאחזים, חוק ההסדרה (2017)                       |
| 3   | Judicial power shift            | צמצום סמכות בית המשפט העליון            | עילת הסבירות (2023), פסקת ההתגברות, ביטול חוק טל (2012)             |
| 4   | Executive power concentration   | ריכוז סמכויות בממשלה                    | סמכויות חירום, חקיקה מהירה, צמצום פיקוח מבקר המדינה                 |
| 5   | Arab minority impact            | השפעה דיספרופורציונלית על המגזר הערבי   | חוק לאום (2018 — הורדת מעמד ערבית), תכנון בנגב, תוכנית פראוור       |
| 6   | Media control                   | שליטה/הגבלה של תקשורת                   | פירוק רשות השידור→כאן, חוק ערוצים, הגבלות פרסום                     |
| 7   | Religious status quo            | שימור/שבירת הסטטוס קוו הדתי             | כשרות, נישואין אזרחיים, מסחר בשבת, הסעות שבת                        |
| 8   | Electoral threshold impact      | שינוי ייצוג מפלגתי                      | העלאת אחוז חסימה (2014 — 3.25%), שיטת בחירות                        |
| 9   | Coalition deal component        | רכיב בעסקת קואליציה                     | (detected by voting pattern + Tavily coalition-context search)      |
| 10  | Gender disproportionate impact  | השפעה דיספרופורציונלית מגדרית           | חופשת לידה, גיוס נשים, הדרת נשים בוועדות מינוי                      |
| 11  | Land / demographic engineering  | הנדסה דמוגרפית דרך מדיניות קרקע         | תוכנית פראוור (עקירת 40K+ בדואים), "פיתוח" גליל/נגב, ייהוד הגליל    |
| 12  | NGO / civil-society restriction | הגבלת ארגוני חברה אזרחית                | חוק שקיפות עמותות (2016), חוק החרם (2011), הגבלות מימון זר          |
| 13  | Retroactive legalization        | הכשרה בדיעבד של מעשים בלתי-חוקיים       | חוק ההסדרה (הכשרת מאחזים), הכשרת בנייה ללא היתר                     |
| 14  | Emergency powers normalization  | הפיכת סמכויות חירום לחקיקה קבועה        | הארכת תקנות שעת חירום, חוק המעצרים המנהליים                         |
| 15  | Basic Law instrumentalization   | שימוש בחוק יסוד ככלי פוליטי             | חוק יסוד: הלאום (2018), חוק יסוד: הלכות פסיקה (2023 — עילת סבירות)  |
| 16  | Conscription equity             | שוויון בנטל שירות צבאי/אזרחי            | חוק טל (2002→בוטל 2012), חוק גיוס אוניברסלי, פטור ישיבות            |
| 17  | Nationality / civic identity    | הגדרת זהות לאומית — אתנית vs. אזרחית    | חוק לאום (הגדרה עצמית ליהודים בלבד), חוק האזרחות, חוק נאמנות בתרבות |
| 18  | Public resource capture         | הפניית משאבים ציבוריים לקבוצות מצומצמות | הפרטת שירותים ציבוריים, הקצאת קרקעות, הטבות מס ממוקדות              |
| 19  | Education autonomy              | עצמאות מערכת חינוך מגזרית               | פטור ממקצועות ליבה (חינוך חרדי), אוטונומיה תוכנית לימודים           |
| 20  | Labor market closure            | הגנה על שוק עבודה סגור / פתיחתו         | הסדרת עובדים זרים, רישוי מקצועי, הגבלות תחרות                       |
| 21  | Individual rights erosion       | שחיקת זכויות פרט ופרטיות                | חוקי מעקב, צנזורה, הגבלת חופש ביטוי/הפגנה, מעצר מנהלי               |
| 22  | Equality & anti-discrimination  | שוויון זכויות ואיסור הפליה              | חוק שוויון ההזדמנויות, ייצוג הולם, נגישות, איסור הפליה בשירותים     |
| 23  | LGBTQ+ rights                   | זכויות קהילת הלהט"ב                     | פונדקאות לזוגות חד-מיניים, הכרה בזוגיות, איסור טיפולי המרה, אימוץ   |

### Tavily for Derived Stance Detection

**Key architectural decision:** Document text is sufficient for understanding
what a bill does (direct stances). Tavily's role shifts to providing the
**political subtext** needed for derived stance classification — the "spirit
of the era", coalition dynamics, sector impact analysis, and framing context
that cannot be extracted from the bill text alone.

**When Tavily is called:**

Tavily searches happen in `classify-vote-stances.ts` (Part B), NOT in the
summary generator (Part A). The search is triggered per-bill (not per-vote)
and cached for all votes on the same bill.

```
classify-vote-stances.ts:
├── For each bill with unclassified votes:
│   ├── 1. Load document text + summary (from Part A — already available)
│   ├── 2. Classify direct stances from document text alone (no Tavily)
│   ├── 3. Tavily political-context search (one query per bill)
│   │      Query: "[bill name] political analysis impact coalition"
│   │      Focus: WHO benefits, sector dynamics, coalition context
│   ├── 4. Classify derived stances using document text + Tavily context
│   │      Match against all 23 curated patterns
│   └── 5. Insert results into vote_stance_alignment
```

**Tavily query strategy for derived stances:**

| Query Pattern                 | Purpose                                                 |
| ----------------------------- | ------------------------------------------------------- |
| `"[bill name]" ניתוח פוליטי`  | Political analysis — who pushed, who opposed, why       |
| `"[bill name]" מי מרוויח`     | Sector impact — which groups disproportionately benefit |
| `"[bill name]" עסקת קואליציה` | Coalition deal context — was this a quid pro quo        |
| `"[bill name]" ביקורת`        | Criticism/opposition framing — reveals hidden impacts   |
| `"[bill name]" בג"ץ חוקתי`    | Constitutional implications — power shift signals       |

In practice, a single combined query (first three rows) is usually sufficient.
The job sends one Tavily search per bill and extracts relevant political
context from the results.

**Cost impact:**

| Item                             | Volume                        | Cost             |
| -------------------------------- | ----------------------------- | ---------------- |
| Tavily (derived context, Part B) | ~7,000 bills with voted bills | **~$56** (basic) |

Not all bills need Tavily for derived stances. Bills that are clearly
single-domain with no secondary impact (e.g., renaming a street) skip
the search. Estimated ~50% of voted-on bills trigger a Tavily query.

### `vote_stance_alignment` — Per-Vote Classification

```sql
CREATE TABLE vote_stance_alignment (
  id SERIAL PRIMARY KEY,
  vote_id INTEGER REFERENCES votes(id) NOT NULL,
  stance_id INTEGER REFERENCES policy_stances(id) NOT NULL,
  alignment TEXT NOT NULL CHECK (alignment IN ('supports', 'opposes')),
  pro_position JSONB NOT NULL,       -- {he: "what FOR means", en: "...", ar: "...", ru: "..."}
  confidence REAL NOT NULL,          -- 0.0–1.0
  needs_review BOOLEAN DEFAULT false,
  reviewed_by TEXT,                   -- admin user ID
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vote_id, stance_id)
);

CREATE INDEX idx_vsa_stance ON vote_stance_alignment(stance_id);
CREATE INDEX idx_vsa_review ON vote_stance_alignment(needs_review) WHERE needs_review = true;
CREATE INDEX idx_vsa_vote ON vote_stance_alignment(vote_id);
```

### Policy Domains (Enum — For Filtering Only)

Stored as a code constant, not a DB table. Used for `policy_stances.domain`:

```typescript
export const POLICY_DOMAINS = {
  national_security: {
    he: 'ביטחון לאומי וצבא',
    en: 'National Security & Military',
  },
  foreign_policy: { he: 'מדיניות חוץ', en: 'Foreign Policy' },
  criminal_justice: { he: 'משפט פלילי ואכיפה', en: 'Criminal Justice' },
  civil_rights: { he: 'זכויות אדם וחירויות', en: 'Human & Civil Rights' },
  economy: { he: 'כלכלה ומסחר', en: 'Economy & Trade' },
  taxation: { he: 'מיסוי ותקציב', en: 'Taxation & Budget' },
  healthcare: { he: 'בריאות', en: 'Healthcare' },
  education: { he: 'חינוך', en: 'Education' },
  welfare: { he: 'רווחה וביטוח לאומי', en: 'Welfare & Social Security' },
  labor: { he: 'עבודה ותעסוקה', en: 'Labor & Employment' },
  housing: { he: 'דיור ונדל"ן', en: 'Housing & Real Estate' },
  infrastructure: { he: 'תשתיות ותחבורה', en: 'Infrastructure & Transport' },
  environment: { he: 'איכות סביבה', en: 'Environment & Climate' },
  agriculture: { he: 'חקלאות ומזון', en: 'Agriculture & Food' },
  energy: { he: 'אנרגיה ומים', en: 'Energy & Water' },
  technology: { he: 'טכנולוגיה ותקשורת', en: 'Technology & Communications' },
  local_gov: { he: 'שלטון מקומי', en: 'Local Government' },
  civil_law: { he: 'משפט אזרחי', en: 'Civil & Commercial Law' },
  religion: { he: 'דת ומדינה', en: 'Religion & State' },
  minorities: { he: 'מיעוטים ושוויון', en: 'Minorities & Equality' },
  immigration: { he: 'עלייה וקליטה', en: 'Immigration & Absorption' },
  culture: { he: 'תרבות וספורט', en: 'Culture & Sport' },
  planning: { he: 'תכנון ובנייה', en: 'Planning & Construction' },
  governance: { he: 'ממשל ומנהל ציבורי', en: 'Governance & Public Admin' },
  parliamentary: { he: 'פיקוח פרלמנטרי', en: 'Parliamentary Oversight' },
} as const;

export type PolicyDomain = keyof typeof POLICY_DOMAINS;
```

---

## Vote Classification AI Prompt

### Single Vote Prompt

```typescript
export const VOTE_STANCE_SKILL = `You are an expert on Israeli parliamentary legislation.
Your task is to classify a parliamentary vote (הצבעה) by determining:
1. What a FOR vote represents (proPosition)
2. Which DIRECT policy stance(s) it aligns with
3. Whether FOR = supports or opposes each stance
4. Whether the vote has DERIVED (secondary) policy implications

INPUTS PROVIDED:
- Vote title and metadata
- Bill name and summary (if available)
- Bill document text (if available — PRIMARY source for direct stances)
- Tavily political context (if available — PRIMARY source for derived stances):
  Web search results providing political analysis, sector impact, coalition
  dynamics, and public debate context. Use this to identify WHO benefits
  beyond the bill's stated purpose.
- List of existing policy stances (to match against), separated by type:
  - DIRECT stances: what bills explicitly do
  - DERIVED stances: secondary/disproportionate impacts

TWO-TRACK CLASSIFICATION:
- DIRECT stances are classified from the BILL TEXT. The document tells you
  what the bill does — no external context needed.
- DERIVED stances are classified from the POLITICAL CONTEXT (Tavily results).
  The subtext — who really benefits, what coalition deal this serves, which
  sector gains disproportionately — comes from political analysis, not from
  the bill text itself. When Tavily context is provided, use it as the
  primary signal for derived stance detection. When it is absent, use the
  bill text alone but apply a higher confidence threshold (0.8 instead of 0.6).

RULES:
- proPosition must describe what voting FOR concretely means in plain language.
  BAD: "בעד החוק" / "תמיכה בהצעה"
  GOOD: "אישור הפחתת רוב הדיירים הנדרש מ-66% ל-51% בפרויקטי פינוי-בינוי"
- proPosition must be self-explanatory — a reader with no context should understand it.
- When matching to an existing stance, prefer an existing one if confidence > 0.7.
  If no existing stance fits well, suggest a NEW stance with a clear label.
- alignment: 'supports' if FOR vote advances the stance's goal,
             'opposes' if FOR vote works against it.
- confidence: your certainty in the stance match + alignment direction (0.0–1.0).
  Use lower confidence when:
  - Vote title is ambiguous
  - Multiple stances could apply
  - Section reference is unclear even with document
  - Bill is procedural (e.g., "שם החוק", "להעביר לוועדה")

MULTI-STANCE CLASSIFICATION:
A vote can be linked to MULTIPLE stances. Classify all that apply:

1. DIRECT STANCE (required if non-procedural):
   The primary policy action of the vote — what the bill text explicitly does.
   Every non-procedural vote MUST have exactly one direct stance.

2. DERIVED STANCES (optional, 0 or more):
   Secondary impacts that go beyond the bill's stated purpose.
   USE TAVILY POLITICAL CONTEXT as your primary signal here — the subtext
   is in the political analysis, not the bill text.

   Check the 20 curated patterns (provided in DERIVED stances list) against
   both the bill text AND the Tavily political context. Key detection axes:

   a) DEMOGRAPHIC TARGETING: Does this bill disproportionately benefit/harm
      a specific sector? (Haredi families, settlers, Arab citizens, etc.)
      TEST: Remove the bill name — look at WHO BENEFITS and BY HOW MUCH.
      Does a group gain 2x+ more than the general population?
      TAVILY SIGNAL: Look for phrases like "מיועד ל...", "משרת את...",
      "פוגע ב...", criticism from specific sector advocates.

   b) INSTITUTIONAL POWER SHIFT: Does the vote shift power between
      institutions? (Knesset↔Courts, Government↔Knesset, Central↔Local,
      Religious establishment↔Secular institutions)
      TAVILY SIGNAL: Legal commentary, constitutional lawyers' opinions,
      comparisons to prior power-shift legislation.

   c) FRAMING MISMATCH: Does the bill's name/framing suggest one thing but
      its content delivers something different or broader?
      TAVILY SIGNAL: Opposition criticism, NGO analysis, media editorials
      that point out the gap between stated purpose and actual impact.

   d) STATUS QUO DISRUPTION: Does the bill touch the religious-secular
      status quo (Shabbat, kashrut, marriage, education autonomy)?
      TAVILY SIGNAL: Religious/secular party reactions, rabbinate statements,
      references to the 1947 Ben-Gurion status quo agreement.

   e) COALITION DEAL CONTEXT: Was this bill part of a coalition agreement?
      TAVILY SIGNAL: References to coalition agreements, "דרישת..." party,
      quid pro quo analysis, timing relative to coalition formation.

   RULES FOR DERIVED STANCES:
   - Must be FACTUAL — describe the measurable impact, not intent
     GOOD: "משפחות עם 6+ ילדים מרוויחות פי 3 מהממוצע מהחוק"
     BAD: "החוק נועד לקנות קולות חרדיים"
   - Must have confidence ≥ 0.6 to include (don't speculate)
   - When Tavily context is unavailable, raise threshold to ≥ 0.8
   - Match to existing DERIVED stances when possible
   - If suggesting a new derived stance, provide clear justification

PROCEDURAL VOTES:
Votes on procedure (transferring to committee, naming the bill, continuity)
are NOT policy stances. Return: { "procedural": true }

OUTPUT FORMAT (JSON only):
{
  "procedural": false,
  "proPosition": {
    "he": "...", "en": "...", "ar": "...", "ru": "..."
  },
  "directStance": {
    "existingStanceId": 42,       // or null if suggesting new
    "newStanceLabel": null,       // or {he: "...", en: "..."} if new
    "newStanceDomain": null,      // or "housing" if new
    "alignment": "supports",
    "confidence": 0.88
  },
  "derivedStances": [             // empty array if none detected
    {
      "existingStanceId": 78,     // or null if suggesting new
      "newStanceLabel": null,     // or {he: "...", en: "..."} if new
      "newStanceDomain": null,
      "alignment": "supports",
      "confidence": 0.75,
      "justification": "families with 6+ children receive 3x more than avg"
    }
  ]
}

Or for procedural votes:
{ "procedural": true }
`;
```

### Batch Mode for Multi-Vote Bills

For bills with many votes (e.g., חוקי הסדרים with 69 votes), classify in
batches of 10–15 votes sharing the same bill document context:

```
BILL CONTEXT (shared for all votes below):
Bill: חוק ההתייעלות הכלכלית (תיקוני חקיקה להשגת יעדי התקציב 2026)

--- BEGIN DOCUMENT ---
{full bill text — provided once}
--- END DOCUMENT ---

--- BEGIN POLITICAL CONTEXT (Tavily) ---
{Tavily search results: political analysis, sector impact, coalition context.
 Used for DERIVED stance detection. Not provided if bill is low-profile.}
--- END POLITICAL CONTEXT ---

VOTES TO CLASSIFY (classify each independently):

[1] Title: "סעיף 25 כהצעת הוועדה"
    Date: 2026-03-30, Result: Accepted (52-40)

[2] Title: "סעיפים 18-24 כהצעת הוועדה"
    Date: 2026-03-30, Result: Accepted (51-41)

[3] Title: "סעיפים 14-17 כהצעת הוועדה"
    Date: 2026-03-30, Result: Rejected (38-54)

... (up to 15 per batch)

Classify each vote independently. Return a JSON array.
```

This amortizes the document token cost across many votes.

---

## Admin Review Queue

### Integration with Existing Admin Dashboard (doc-12)

Add a new review type to the existing `/admin/ai-review` polymorphic queue:

```typescript
type StanceReviewItem = {
  type: 'vote-stance';
  voteId: number;
  voteTitle: string;
  billName: string;
  proPosition: Record<string, string>;
  suggestedStance: { id?: number; label: Record<string, string> };
  suggestedAlignment: 'supports' | 'opposes';
  confidence: number;
  // Context for the reviewer:
  billSummary?: string;
  otherVotesOnBill?: number;
};
```

### Review Actions

| Action              | Effect                                                                 |
| ------------------- | ---------------------------------------------------------------------- |
| **Approve**         | Set `needs_review = false`, record reviewer                            |
| **Reject**          | Delete alignment (vote stays unclassified)                             |
| **Reassign**        | Change stance_id and/or alignment, approve                             |
| **Create & Assign** | Create new policy_stance, then assign vote to it                       |
| **Mark Procedural** | Delete alignment, mark vote as procedural (skip future classification) |

### Review Priority

Sort pending reviews by:

1. High vote participation (more MKs voted → higher impact)
2. Lower confidence (more uncertain → needs human more)
3. Bill importance (current knesset > historical)

---

## Combined Cost Estimates

### Part A: Document Reading & Summaries

| Item                        | Volume                         | Tokens    | Cost             |
| --------------------------- | ------------------------------ | --------- | ---------------- |
| PDF text extraction (unpdf) | ~5,000 bills                   | 0 (local) | **$0**           |
| DOC text extraction         | ~3,000 bills                   | 0 (local) | **$0**           |
| Claude Sonnet generation    | ~14,000 bills × 2K tok         | ~28M      | **~$84**         |
| Tavily search (summaries)   | ~6,000 bills without docs only | —         | **~$48** (basic) |
| **Subtotal A**              |                                |           | **~$132**        |

### Part B: Vote Stance Classification

| Item                                  | Volume                       | Tokens | Cost       |
| ------------------------------------- | ---------------------------- | ------ | ---------- |
| Stance seeding — direct (one-time)    | ~2,000 topics → ~100 stances | ~50K   | **~$0.15** |
| Stance seeding — derived (manual)     | ~23 curated stances          | 0      | **$0**     |
| Vote classification (backfill K25)    | ~8,000 votes × ~1.2K tok     | ~9.6M  | **~$29**   |
| Vote classification (backfill K23-24) | ~15,000 votes × ~1.2K tok    | ~18M   | **~$54**   |
| Multi-vote bills (doc context)        | ~500 bills × ~5K tok         | ~2.5M  | **~$7.50** |
| Tavily (derived stance context)       | ~7,000 bills with votes      | —      | **~$56**   |
| **Subtotal B**                        |                              |        | **~$147**  |

Note: Token estimate increased from ~1,100 to ~1,200 per vote to account for
Tavily political context in the prompt. Tavily search is per-bill (not per-vote),
so the ~$56 cost is amortized across all votes on each bill. Bills without
political significance (street renaming, etc.) skip Tavily search.

### Combined Total

|                                 | Cost                                       |
| ------------------------------- | ------------------------------------------ |
| **Total backfill (A + B)**      | **~$279**                                  |
| **Ongoing per knesset session** | **~$12/year** (stance classification only) |

Note: Multi-vote bill batching saves ~70% vs. classifying each vote
independently (document context + Tavily context sent once per batch, not
per vote). Tavily cost is redistributed: Part A uses less (~$48 vs $112)
because document text is primary, while Part B adds ~$56 for political
context searches specific to derived stance detection.

## Implementation Order

### Part A: Document Reading & Summaries

1. **Migration** — `bill_documents` + `bill_stage_summaries` +
   `pipeline_run_log` + `pipeline_item_log` tables
2. **Pipeline logging framework** — `runPipelineJob()` + `logItem()` helpers
   used by ALL subsequent jobs. Implement error categories enum.
3. **sync-bill-documents.ts** — OData sync job
   - Log each document sync attempt (success/404/error) to `pipeline_item_log`
   - Set `is_available = false` on 404 responses (Risk #4)
   - Retry 404 once after 24h, then mark permanently unavailable
4. **document-reader.ts** — PDF (unpdf) + DOC (officeparser) reading
   - `try/catch` per document — failure = `null`, not exception (Risk #2)
   - Log `PDF_EMPTY` / `DOC_PARSE_FAIL` error codes with document IDs
   - Truncate at paragraph boundary when exceeding `maxDocumentChars` (Risk #5)
   - Log truncation percentage per bill for monitoring
   - `extractExplanatoryNotes()` for דברי הסבר extraction (reduces tokens)
5. **Update summary-generator.ts** — incorporate document context + stage-aware writes
   - Document text as PRIMARY source; Tavily only when no doc available (Risk #5)
   - Log `TAVILY_EMPTY` / `TAVILY_ERROR` — continue without web context
   - Track token usage per bill in `pipeline_item_log`
6. **Update bill-summary.ts prompt** — document priority instructions
7. **Update app.config.ts** — document reading config (max pages, type priority)
8. **Rate limiting** — `p-limit(3)` + exponential backoff (429 → 1s→2s→4s...32s)
   - `dailyTokenBudget` check before each batch (Risk #3)
9. **Test run** — 100 bills (including old `.doc` files from K15-20):
   - Verify PDF extraction rate, DOC failure rate
   - Check token usage distribution → tune `maxDocumentChars`
   - Review pipeline_item_log for error patterns
10. **Full run** — all K25/24/23 bills (backfill: highest-priority doc per bill)
    - Monitor via admin pipeline dashboard
    - Pause/resume with checkpoint support
11. **Stepper integration** — query `bill_stage_summaries` in InteractiveStagePipeline

### Part B: Policy Stance Classification

Steps 12–13 can begin in parallel with steps 5–6 above.

12. **Migration** — `policy_stances` (with `stance_type`) +
    `vote_stance_alignment` + `bill_classification_context` +
    `stance_backfill_log` tables
13. **Seed direct stances** — One-time AI batch:
    - Collect all distinct `aiTopics` from existing bills
    - Send to Claude: "Group these ~2,000 topics into 80–150 directional
      policy stances. Each stance should represent a clear policy direction
      that an MK can support or oppose."
    - Insert results into `policy_stances` with `stance_type = 'direct'`
    - **Similarity gate**: before inserting, check cosine similarity vs.
      existing stances — merge if > 0.85 (Risk #6)
    - Manual admin review of the seeded stances (~1 hour of work)
14. **Seed derived stances** — Insert curated derived-stance patterns:
    - Use the 23-pattern seed table (Haredi demographic, settlement territorial,
      judicial power shift, land/demographic engineering, NGO restriction, etc.)
    - Insert into `policy_stances` with `stance_type = 'derived'`
    - Admin review + customize labels for 4 languages
15. **`classify-vote-stances.ts`** — Pipeline job:
    - Query: all votes with `bill_id IS NOT NULL` and no entry in
      `vote_stance_alignment`
    - Group by bill (to batch multi-vote bills)
    - **Adaptive batch size**: start at 15; if `needs_review` > 30% → shrink
      to 10; if < 10% → grow to 20 (Risk #11)
    - **Random order** within each batch to avoid attention fatigue (Risk #11)
    - For each group:
      - Fetch bill document text (from Part A)
      - Fetch bill summary/topics
      - **Direct stances**: classify from document text alone (no Tavily)
      - **Tavily political-context search** (one query per bill, cached):
        `"[bill name]" ניתוח פוליטי מי מרוויח עסקת קואליציה`
        - Graceful degradation: if Tavily empty → classify derived from
          doc text only, with higher threshold 0.8 (Risk #12)
        - Source diversity: `includeDomains` includes left + right media
      - **Derived stances**: classify using document text + Tavily context,
        match against 23 curated patterns
      - **Similarity gate** on suggested new stances: cosine > 0.85 →
        propose merge, queue for admin (Risk #6)
      - Insert into `vote_stance_alignment` (multiple rows per vote possible)
      - Queue low-confidence items for review (Risk #7)
      - Mark `low_turnout` on votes with < 10 participants (Risk #9)
      - **Procedural detection**: AI can mark as procedural → skip (Risk #7)
      - **Ambiguous enrichment**: if title generic, fetch other votes from
        same `sessItemId` as context (Risk #7)
      - Derived stances always queued for review on first occurrence
      - **Confidence decay**: lower confidence for older knessets (Risk #10)
      - UPSERT into `bill_classification_context`: save document_text,
        tavily_context, ai_topics, ai_summary for future incremental backfills
    - Log every item to `pipeline_item_log` with AI response + confidence
    - Checkpoint by vote.created_at
16. **Validation run** — after initial backfill:
    - Random sample of 50 votes from large batches → manual review (Risk #11)
    - Check confidence distribution per batch-position
    - Review `pipeline_item_log` error patterns
    - One-pass admin review of all new stances suggested by AI (Risk #6)
17. **Admin review UI** — Add stance review type to `/admin/ai-review`
    - Show `proPosition`, suggested stance, alignment, confidence
    - Show Tavily results used (from `pipeline_item_log.tavily_results`)
    - Actions: approve, reject, reassign, create & assign, mark procedural
    - Context: link to bill page + vote page for verification (Risk #8)
18. **Stance management page** — `/admin/stances` — CRUD, merge, archive
    - Filter by `stance_type` (direct / derived)
    - Show vote_count per stance
    - **Era-scoped stances**: support creating period-specific variants
      (e.g. "מחיר למשתכן (כנסת 20)") (Risk #10)
    - **Merge tool**: select 2+ similar stances → merge (all alignments
      re-pointed to surviving stance) (Risk #6)
    - **Periodic cleanup**: monthly job — AI identifies stances with
      < 3 votes → suggests merges (Risk #6)
    - **Run Backfill** button: trigger `add-stance-backfill.ts` for a
      specific stance → progress bar + status from `stance_backfill_log`
19. **add-stance-backfill.ts** — Incremental stance backfill job:
    - Embedding pre-filter (similarity > 0.3) → ~500-2,000 bills (Risk #13)
    - INCREMENTAL_STANCE_SCAN prompt (~500 tokens per bill)
    - Read from `bill_classification_context` (no re-fetching docs/Tavily)
    - Log to `stance_backfill_log` + `pipeline_item_log`
    - Admin override: "full scan" option skips embedding filter (Risk #13)
    - Embedding quality monitor: log `bills_above_threshold / total_matches`

### Part C: Policies Page & Aggregation

20. **tRPC endpoints** — `policies.list` + `policies.detail`:
    - `policies.list`: all stances grouped by domain, filterable by stance_type
    - `policies.detail`: MK scores + faction scores on the 7-level scale +
      **evidence links**: each vote linked to bill page + vote page
    - `members.stanceProfile`: MK position aggregation for MK profile page +
      per-stance list of relevant votes as evidence
    - All scores scoped per-knesset by default (Risk #10)
    - `low_turnout` votes excluded from scoring by default (Risk #9)
21. **Policies index page** — `/[locale]/policies`:
    - Browse all stances, filter by domain + type (direct/derived)
    - Search by keyword
    - Show vote_count per stance
22. **Policy detail page** — `/[locale]/policies/[stanceId]`:
    - Tabs: חברי כנסת / סיעות
    - MK tab: member cards grouped by 7-level scale (like TheyVoteForYou)
    - Faction tab: faction rows with score + cohesion indicator
    - Bottom: **אסמכתאות** — relevant votes with:
      - Date, title, result
      - 🔗 link to bill page + 🔗 link to vote page
      - proPosition explanation for each vote
    - Admin can reverse alignment direction (dynamic recalc) (Risk #8)
23. **MK profile integration** — Stance cards on MK profile page
    - Both direct + derived stances (derived visually distinguished)
    - Filterable by domain
    - Expandable: click card → see relevant votes as evidence links
    - Link to policy detail page
24. **Faction profile integration** — Add "Policy Positions" tab to faction page
    - Faction scores + cohesion indicator per stance
25. **Comparison view** — Select 2+ MKs (or 2+ factions), see stances side by side
26. **Admin pipeline dashboard** — `/admin/pipeline`:
    - Last run summary per job (status, items, errors, cost)
    - Error breakdown (last 7 days) with error category grouping
    - Cost tracking (tokens used, Tavily calls, estimated $ this month)
    - Download error log CSV
    - Review queue count badge
27. **Cron trigger** — When `sync-votes` inserts new votes, queue classification

### Future: Reservation Classification (הסתייגויות)

Deferred. When implemented:

- הסתייגויות are detected by title regex (already working in StageVotePanel)
- Each reservation vote would get classified independently
- Context would come from the committee protocol document (if available)
  or from the reservation title + bill document

### Incremental Stance Classification — Technical Design (סיווג מצטבר לדפוסים חדשים)

> Implemented in step 19 above (`add-stance-backfill.ts`). This section
> documents the detailed technical design.

**הבעיה**: כשמוסיפים דפוס מדיניות חדש (למשל דפוס #24), אי אפשר להריץ
מחדש את כל הסיווג על ~23,000 הצבעות — זה ~$80+ ב-Claude + ~$56 ב-Tavily.
צריך ארכיטקטורה שמאפשרת סיווג ממוקד לדפוס אחד בודד בעלות מינימלית.

**הפתרון — שלוש שכבות:**

#### 1. Cache הקשר ברמת הצעת חוק (`bill_classification_context`)

בזמן ה-backfill הראשוני, ה-pipeline כבר מוציא טקסט מסמך + תוצאות Tavily
לכל הצעת חוק. במקום לזרוק את ההקשר, שומרים אותו:

```sql
CREATE TABLE bill_classification_context (
  bill_id INTEGER PRIMARY KEY REFERENCES bills(id),
  document_text TEXT,              -- extracted doc text (from Part A)
  tavily_context TEXT,             -- Tavily political context results
  ai_topics TEXT[],                -- cached from bills.aiTopics
  ai_summary JSONB,               -- cached from bills.aiSummary
  context_created_at TIMESTAMPTZ DEFAULT NOW()
);
```

העלות: ~0 (אחסון DB בלבד). הטבלה מתמלאת כ-side effect של ה-backfill
הרגיל — לא צריך ריצה נוספת.

#### 2. סינון מקדים ב-Embedding (pre-filter)

לא כל 14,000 הצעות חוק רלוונטיות לדפוס חדש. לפני שליחה ל-Claude, מסננים
את המועמדים:

```
add-stance-backfill.ts:
├── 1. Input: new stance definition (label + description)
├── 2. Generate embedding for the stance description
├── 3. Cosine similarity vs. all bills' aiTopics/aiSummary embeddings
│      (embeddings pre-computed during Part A, stored in bill_classification_context
│       or computed lazily on first incremental scan)
├── 4. Filter: keep only bills with similarity > 0.3 (~500-2,000 bills typically)
├── 5. For each candidate bill:
│      ├── Load cached context from bill_classification_context
│      ├── Send INCREMENTAL_STANCE_SCAN prompt (see below)
│      ├── If match found → insert into vote_stance_alignment for all bill's votes
│      └── Queue for admin review (first occurrence of new stance)
└── 6. Log results: X bills scanned, Y matches found, Z sent to review
```

**עלות משוערת לדפוס חדש**:

| Item                      | Volume                 | Cost           |
| ------------------------- | ---------------------- | -------------- |
| Embedding generation      | 1 stance               | **~$0.001**    |
| Cosine similarity         | ~14,000 bills          | **$0** (local) |
| Claude classification     | ~1,000 bills × 500 tok | **~$1.50**     |
| Tavily (only if no cache) | ~200 bills             | **~$1.60**     |
| **Total per new stance**  |                        | **~$3**        |

לעומת ~$80+ אם היינו מריצים הכל מחדש — **חיסכון של ~96%**.

#### 3. Prompt ממוקד (`INCREMENTAL_STANCE_SCAN`)

Prompt קצר בהרבה מ-`VOTE_STANCE_SKILL` — שואל שאלה אחת בלבד:

```typescript
export const INCREMENTAL_STANCE_SCAN = `You are an expert on Israeli parliamentary legislation.

TASK: Determine if a specific policy pattern applies to a bill.

NEW STANCE TO EVALUATE:
- Label: {stance_label}
- Description: {stance_description}
- Type: {stance_type} (direct/derived)

BILL CONTEXT:
- Name: {bill_name}
- Summary: {bill_summary}
- Document text: {document_text_excerpt}
- Political context: {tavily_context}

QUESTION: Does this bill have a meaningful connection to the stance above?

If YES, for each vote on this bill, determine:
1. alignment: does a FOR vote 'support' or 'oppose' this stance?
2. confidence: how certain are you? (0.0–1.0)
3. justification: one sentence explaining the connection

If NO, return: { "matches": false }

OUTPUT FORMAT (JSON):
{
  "matches": true,
  "alignment": "supports",
  "confidence": 0.82,
  "justification": "The bill extends child allowances by 40%, disproportionately benefiting families with 6+ children"
}
`;
```

הפרומפט הזה ~500 tokens (במקום ~1,500 של VOTE_STANCE_SKILL) כי אין צורך
לבדוק עשרות דפוסים — רק אחד ספציפי. זה מה שמוריד את העלות מ-~$3/vote
ל-~$1.50/1,000 bills.

#### 4. תכנון טבלת `stance_backfill_log`

מעקב אחרי אילו דפוסים כבר עברו backfill:

```sql
CREATE TABLE stance_backfill_log (
  stance_id INTEGER REFERENCES policy_stances(id) PRIMARY KEY,
  backfill_status TEXT NOT NULL CHECK (backfill_status IN
    ('pending', 'in_progress', 'completed', 'failed')),
  bills_scanned INTEGER DEFAULT 0,
  bills_matched INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT
);
```

כשAdmin מוסיף stance חדש ב-`/admin/stances` (step 18), הוא רואה כפתור
"Run Backfill" שמריץ את `add-stance-backfill.ts` (step 19) עבור אותו stance.
סטטוס + progress bar מוצגים ב-admin panel.

> Note: The incremental backfill is now integrated into the main
> Implementation Order (step 15 saves context, step 19 runs backfill).
> Tables (`bill_classification_context`, `stance_backfill_log`) are
> created in step 12 migration.

````

## Pipeline Observability & Logging (מערכת לוגים ומעקב)

מערכת הלוגים נועדה לתת שקיפות מלאה לכל שלב ב-pipeline — לא רק document
reading, אלא כל שלב: sync, classification, Tavily, backfill, admin review.

### Pipeline Run Log (`pipeline_run_log`)

טבלת מעקב ריצות — כל הפעלה של job (sync, summary, classify, backfill) מתועדת:

```sql
CREATE TABLE pipeline_run_log (
  id SERIAL PRIMARY KEY,
  job_name TEXT NOT NULL,              -- 'sync-bill-documents' | 'generate-summaries' |
                                       -- 'classify-vote-stances' | 'add-stance-backfill'
  run_status TEXT NOT NULL CHECK (run_status IN
    ('running', 'completed', 'failed', 'partial')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  -- Counters
  items_processed INTEGER DEFAULT 0,   -- bills/votes/docs processed successfully
  items_failed INTEGER DEFAULT 0,      -- items that errored
  items_skipped INTEGER DEFAULT 0,     -- items skipped (already processed, not relevant, etc.)
  -- Cost tracking
  tokens_used INTEGER DEFAULT 0,       -- Claude tokens consumed
  tavily_calls INTEGER DEFAULT 0,      -- Tavily API calls made
  estimated_cost_usd REAL DEFAULT 0,   -- estimated $ spent this run
  -- Context
  config_snapshot JSONB,               -- app.config values used (for reproducibility)
  checkpoint TEXT,                     -- last checkpoint (e.g. "vote.created_at: 2026-01-15")
  error_summary TEXT,                  -- high-level error if failed
  metadata JSONB                       -- job-specific metadata
);

CREATE INDEX idx_prl_job ON pipeline_run_log(job_name, started_at DESC);
````

### Pipeline Item Log (`pipeline_item_log`)

לוג per-item — כל bill/vote/document שנכנס ל-pipeline מתועד בנפרד:

```sql
CREATE TABLE pipeline_item_log (
  id SERIAL PRIMARY KEY,
  run_id INTEGER REFERENCES pipeline_run_log(id) NOT NULL,
  item_type TEXT NOT NULL,             -- 'bill' | 'vote' | 'document' | 'stance'
  item_id INTEGER NOT NULL,            -- bill_id / vote_id / document_id
  status TEXT NOT NULL CHECK (status IN
    ('success', 'failed', 'skipped', 'needs_review')),
  -- Details
  duration_ms INTEGER,                 -- how long this item took
  tokens_used INTEGER,                 -- tokens for this specific item
  error_code TEXT,                     -- categorized error: 'PDF_404' | 'PARSE_FAIL' |
                                       -- 'RATE_LIMIT' | 'TOKEN_OVERFLOW' | 'TAVILY_EMPTY' |
                                       -- 'LOW_CONFIDENCE' | 'AMBIGUOUS_VOTE'
  error_message TEXT,                  -- detailed error message
  ai_response JSONB,                   -- full AI response (for debugging classification issues)
  tavily_results JSONB,                -- Tavily results used (if any)
  metadata JSONB,                      -- item-specific data (e.g. confidence scores)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pil_run ON pipeline_item_log(run_id);
CREATE INDEX idx_pil_status ON pipeline_item_log(status) WHERE status = 'failed';
CREATE INDEX idx_pil_error ON pipeline_item_log(error_code) WHERE error_code IS NOT NULL;
CREATE INDEX idx_pil_item ON pipeline_item_log(item_type, item_id);
```

### Error Categories

| Code              | Description                                         | Part | Action                          |
| ----------------- | --------------------------------------------------- | ---- | ------------------------------- |
| `PDF_404`         | Document file not found on fs.knesset.gov.il        | A    | Mark `is_available = false`     |
| `PDF_EMPTY`       | PDF parsed but no text extracted (image-based?)     | A    | Skip doc, fallback to metadata  |
| `DOC_PARSE_FAIL`  | officeparser failed on DOC/DOCX                     | A    | Skip doc, log for investigation |
| `TOKEN_OVERFLOW`  | Document text exceeded `maxDocumentChars`           | A    | Truncated — log truncation %    |
| `RATE_LIMIT`      | Claude/Tavily 429 — backoff and retry               | A+B  | Retry with exponential backoff  |
| `TAVILY_EMPTY`    | Tavily returned no relevant results                 | A+B  | Continue without web context    |
| `TAVILY_ERROR`    | Tavily API error                                    | A+B  | Continue without web context    |
| `LOW_CONFIDENCE`  | AI classification below threshold                   | B    | Queue for admin review          |
| `AMBIGUOUS_VOTE`  | Vote title too generic to classify                  | B    | Try enrichment, then review     |
| `NO_STANCE_MATCH` | AI couldn't match to any existing stance            | B    | Suggest new stance → review     |
| `SIMILARITY_DUP`  | Suggested new stance is too similar to existing one | B    | Propose merge → review          |
| `BATCH_TIMEOUT`   | Batch classification timed out                      | B    | Split into smaller batches      |
| `EMBED_MISSING`   | No embedding available for bill/stance              | B    | Compute lazily, retry           |

### Admin Dashboard — Pipeline Monitor

Add to existing admin dashboard (`/admin/pipeline`):

```
┌─────────────────────────────────────────────────────────────────┐
│  📊 Pipeline Monitor                                            │
│  ────────────────                                               │
│                                                                 │
│  ┌─ Last Run Summary ────────────────────────────────────────┐  │
│  │ Job                  │ Status   │ Items │ Errors │ Cost   │  │
│  │──────────────────────│──────────│───────│────────│────────│  │
│  │ sync-bill-documents  │ ✅ Done  │ 142   │ 3      │ $0     │  │
│  │ generate-summaries   │ ✅ Done  │ 85    │ 2      │ $2.40  │  │
│  │ classify-stances     │ 🔄 Run  │ 340   │ 12     │ $4.10  │  │
│  │ stance-backfill (#24)│ ✅ Done  │ 1,200 │ 0      │ $1.80  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ Error Breakdown (last 7 days) ───────────────────────────┐  │
│  │ PDF_404:          23   (↑5 from last week)                │  │
│  │ LOW_CONFIDENCE:   45   (review queue: 45 pending)         │  │
│  │ TAVILY_EMPTY:     12   (classified without web context)   │  │
│  │ DOC_PARSE_FAIL:    3   (bills: 5422, 5430, 5455)         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ Cost Tracking (current month) ───────────────────────────┐  │
│  │ Claude tokens:   2.4M / 300K daily budget                 │  │
│  │ Tavily calls:    340 / 1,000 monthly                      │  │
│  │ Estimated cost:  $12.30 / $50 monthly budget              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  [View full run history]  [Download error log CSV]              │
└─────────────────────────────────────────────────────────────────┘
```

### Logging in Code

כל pipeline job עוטף את הריצה ב-pattern אחיד:

```typescript
// Pipeline logging pattern (used by ALL jobs):
async function runPipelineJob(jobName: string, fn: () => Promise<void>) {
  const run = await db
    .insert(pipelineRunLog)
    .values({
      jobName,
      runStatus: 'running',
      configSnapshot: JSON.stringify(appConfig),
    })
    .returning();

  try {
    await fn();
    await db
      .update(pipelineRunLog)
      .set({ runStatus: 'completed', completedAt: new Date() })
      .where(eq(pipelineRunLog.id, run[0].id));
  } catch (error) {
    await db
      .update(pipelineRunLog)
      .set({
        runStatus: 'failed',
        completedAt: new Date(),
        errorSummary: error instanceof Error ? error.message : String(error),
      })
      .where(eq(pipelineRunLog.id, run[0].id));
    throw error;
  }
}

// Per-item logging:
async function logItem(runId: number, item: PipelineItemInput) {
  await db.insert(pipelineItemLog).values({ runId, ...item });
}
```

## Configuration (app.config.ts additions)

```typescript
billSummary: {
  // ... existing config ...
  documentReader: {
    /** Max pages to read from a bill PDF (local extraction via unpdf) */
    maxPages: Number(process.env.BILL_DOC_MAX_PAGES ?? 30),
    /** Max characters of document text to include in prompt */
    maxDocumentChars: Number(process.env.BILL_DOC_MAX_CHARS ?? 8000),
    /** Document type priority (GroupTypeID, highest first) */
    typePriority: [4, 2, 1, 3, 60, 59, 12, 17],
  },
},

policyStances: {
  ai: {
    /** Model for vote classification */
    model: process.env.STANCE_AI_MODEL ?? 'claude-sonnet-4-20250514',
    /** Max tokens per classification (increased for multi-stance output) */
    maxTokens: Number(process.env.STANCE_AI_MAX_TOKENS ?? 1500),
  },
  /** Confidence threshold for DIRECT stances — below this goes to admin review */
  directReviewThreshold: Number(process.env.STANCE_DIRECT_REVIEW_THRESHOLD ?? 0.75),
  /** Confidence threshold for DERIVED stances — higher bar */
  derivedReviewThreshold: Number(process.env.STANCE_DERIVED_REVIEW_THRESHOLD ?? 0.85),
  /** Max votes per batch (for multi-vote bills) */
  batchSize: Number(process.env.STANCE_BATCH_SIZE ?? 15),
  /** Minimum votes needed to display MK/faction score on a stance */
  minVotesForScore: Number(process.env.STANCE_MIN_VOTES ?? 2),
  incrementalBackfill: {
    /** Embedding similarity threshold for pre-filtering bills */
    similarityThreshold: Number(process.env.STANCE_SIMILARITY_THRESHOLD ?? 0.3),
    /** Max bills to send to Claude per incremental backfill */
    maxBillsPerScan: Number(process.env.STANCE_MAX_BILLS_PER_SCAN ?? 2000),
    /** Model for incremental scan (can be cheaper than full classification) */
    model: process.env.STANCE_INCREMENTAL_MODEL ?? 'claude-sonnet-4-20250514',
  },
},
```

## Risk Mitigation

### Part A Risks — Document Reading & Summaries

#### 1. Large PDFs (חוקי תקציב / הסדרים)

**הסיכון**: מסמכי PDF של חוקי תקציב יכולים להגיע ל-100+ עמודים. שליחת כל
המסמך ל-AI תגלוש מחלון ההקשר ותייקר את העיבוד באופן משמעותי.

**פתרונות**:

- הגבלת `maxPages` (ברירת מחדל: 30) — קורא רק את העמודים הראשונים
- חילוץ חכם: סריקת "דברי הסבר" (בדרך כלל בעמודים הראשונים) והפסקה אחרי
  שנמצא הסעיף האחרון
- לחוקי תקציב: שימוש ב-`BUDGET_CHAPTER_CONTEXT` שכבר קיים — כל פרק מטופל
  בנפרד עם תחום הדפים הרלוונטי בלבד
- Fallback: אם הטקסט חתוך, ההצעה עדיין מקבלת סיכום מ-metadata בלבד
  (כמו הזרימה הנוכחית). Tavily לא נדרש להבנת החוק — רק להקשר פוליטי
  בשלב סיווג העמדות (Part B)

#### 2. כשלון המרת DOC/DOCX

**הסיכון**: קבצי `.doc` ישנים (מכנסות 15-20) עלולים להשתמש בפורמטים
לא-סטנדרטיים ש-`officeparser` לא יודע לקרוא. הנתיב הזה
עלול לזרוק חריגה ולעצור את כל ה-pipeline.

**פתרונות**:

- `try/catch` סביב כל קריאת מסמך — כשל = `null`, לא exception
- Fallback: officeparser → skip
- לוג ברמת `warn` עם document ID — מאפשר ניתוח בדיעבד של שיעור הכשלונות
- ההצעה עדיין מקבלת סיכום מ-metadata בלבד (כמו הזרימה הנוכחית)
- בדיקה חד-פעמית: הרצת `readDocument()` על מדגם של 100 מסמכים ישנים
  כדי לזהות את שיעור הכשל לפני backfill מלא

#### 3. Rate Limiting של Claude API

**הסיכון**: Claude Sonnet API מגביל RPM ו-TPM לפי ה-tier.
ב-backfill של 14,000 הצעות חוק ללא טרוטלינג, נחסם תוך שניות.

**פתרונות**:

- `p-limit(3)` — מקסימום 3 קריאות מקבילות
- Exponential backoff על שגיאות 429: 1s → 2s → 4s → ... (מקסימום 32s)
- Dashboard counter: מספר קריאות Claude ביום ב-admin sync status
- `dailyTokenBudget` (300K default) — עוצר את ה-pipeline כשמגיעים למגבלה
  היומית ומדווח ל-admin
- PDF reading מתבצע מקומית (unpdf) — לא צורך AI ולכן לא נתקע על rate limits

#### 4. FilePath 404 (קישורים שבורים)

**הסיכון**: חלק מהמסמכים הישנים ב-`fs.knesset.gov.il` הועברו או נמחקו.
ה-OData עדיין מחזיר את ה-FilePath אבל HTTP GET מחזיר 404.

**פתרונות**:

- `HEAD` request לפני הורדה — חוסך bandwidth על קבצים גדולים שלא קיימים
- Cache של 404 תשובות ב-DB: שדה `is_available` על `bill_documents`
  שמתעדכן ב-sync. לא מנסים שוב מסמכים שכבר סומנו כלא-זמינים
- Retry פעם אחת אחרי 24h (יכול להיות תקלה זמנית בשרת הקבצים)
- לא חוסם את ה-pipeline — מסמך לא-זמין = skip, ממשיך למסמך הבא בעדיפות

#### 5. Token Overflow (גלישת חלון הקשר)

**הסיכון**: מסמך ארוך + system prompt + output עלולים לחרוג מה-sweet spot
לאיכות (~30K tokens). ב-Part B, Tavily context מתווסף לפרומפט ומגדיל
את הסיכון.

**פתרונות**:

- חיתוך `maxDocumentChars` (ברירת מחדל: 8,000 תווים ≈ ~3,000 tokens)
- אם הטקסט חורג: חתוך ב-boundary של פסקה (לא באמצע משפט)
- סדר עדיפות לטקסט: דברי הסבר > גוף החוק > נספחים
- `extractExplanatoryNotes()` שולף רק את סקציית דברי ההסבר (בדרך כלל
  20-30% מהמסמך) — מקטין את הטוקנים משמעותית
- Tavily context (Part B בלבד) — מוגבל ל-~2,000 תווים מהתוצאות הרלוונטיות
  ביותר. לא נשלח ב-Part A (שם הטקסט של המסמך מספיק)
- מוניטור: logging של token usage per bill — מאפשר כיוונון של `maxDocumentChars`

---

### Part B Risks — Policy Stance Classification

#### 6. Stance Proliferation (ריבוי עמדות)

**הסיכון**: ה-AI עלול להציע עמדה חדשה לכמעט כל הצבעה, מה שיוביל למאות
עמדות דומות במקום 80-150 ברורות. למשל: "הקלת פינוי-בינוי", "קידום התחדשות
עירונית", "הפחתת חסמים לפינוי-בינוי" — כולן בעצם אותו דבר.

**פתרונות**:

- **Similarity gate**: לפני הוספת stance חדש, חישוב embedding similarity
  מול כל ה-stances הקיימים. אם cosine similarity > 0.85 — מציע merge
  במקום יצירה חדשה, ושולח לadmin review
- **Prompt engineering**: ההוראה ל-AI מעדיפה match ל-stance קיים
  ("prefer existing stance if confidence > 0.7")
- **Admin batch review**: אחרי ה-backfill הראשון, admin מסתכל על כל
  ה-stances החדשים שנוצרו ומאחד כפילויות
- **Periodic cleanup job**: אחת לחודש — AI מרכז stance-ים עם < 3 הצבעות
  ומציע מיזוג ל-stances דומים

#### 7. הצבעות לא-ברורות (Ambiguous Votes)

**הסיכון**: חלק מההצבעות מעורפלות מצד עצמן:

- פרוצדורליות שנראות מהותיות ("להעביר לוועדה" — אבל בהקשר של חוק שנוי
  במחלוקת, ההעברה עצמה היא הצהרת עמדה)
- כותרות גנריות ("הצבעה") שאחרי ההעשרה עדיין לא ברורות
- הצבעות על "שם החוק" שטכנית הן פרוצדורליות אבל לפעמים שנויות במחלוקת

**פתרונות**:

- סף confidence נמוך (0.75) — כל ספק הולך ל-admin review
- קטגוריית `procedural: true` מפורשת — ה-AI יכול לסמן הצבעה כפרוצדורלית
  וכך היא מדלגת על הסיווג (לא נכנסת ל-review ולא מסווגת)
- Enrichment layer: אם הכותרת גנרית, הjob מנסה למצוא הצבעות אחרות באותו
  `sessItemId` שכן ברורות — ושולח את ההקשר הזה ל-AI
- Fallback: הצבעות שנשארות unclassified אחרי review לא פוגעות בשום דבר —
  פשוט לא נספרות ב-MK stance profile

#### 8. חוסר הסכמה על כיוון (Alignment Disagreement)

**הסיכון**: אנשים סבירים יכולים לחלוק על האם הצבעת "בעד" מייצגת תמיכה או
התנגדות ל-stance. למשל: חוק שמגביל הפגנות — האם "בעד" = תמיכה ב"סדר ציבורי"
או התנגדות ל"חופש הביטוי"? תלוי באיזה stance אתה משייך.

**פתרונות**:

- **שקיפות מלאה**: כל שיוך (alignment) מוצג עם הסבר ה-`proPosition` —
  המשתמש רואה "הצביע בעד = אישור הגבלת הפגנות ללא אישור משטרתי" ויכול
  לשפוט בעצמו
- **Admin reversibility**: admin יכול להפוך alignment מ-supports ל-opposes —
  כל ציוני ה-MKs מתעדכנים אוטומטית (חישוב דינמי, לא cached)
- **Stance framing**: ה-stances מנוסחים ככל האפשר **חד-כיווניים** —
  "הגבלת הפגנות ללא אישור" ולא "סדר ציבורי vs חופש ביטוי"
- **Multiple stances per vote**: הסכמה מאפשרת ש-vote אחד ישויך ל-2 stances
  שונים (UNIQUE על vote_id + stance_id). כך ההצבעה נספרת גם בהקשר של
  "סדר ציבורי" וגם בהקשר של "חופש ביטוי" — כל אחד עם alignment שונה

#### 9. הצבעות עם השתתפות נמוכה

**הסיכון**: הצבעות עם פחות מ-20 משתתפים (מתוך 120 ח"כים) עלולות לא לייצג
עמדה אמיתית — ח"כים רבים נעדרו מסיבות שאינן קשורות (ישיבות ועדה, חו"ל,
מחלה). שימוש בהן ל-stance analysis מעוות את התמונה.

**פתרונות**:

- **סף מינימלי להצגה**: `minVotesForScore` (ברירת מחדל: 2) — ח"כ צריך
  לפחות 2 הצבעות ב-stance כדי שהציון יוצג
- **סף השתתפות**: הצבעות עם < 10 משתתפים מסווגות אבל מסומנות כ-`low_turnout`
  — לא נכללות בחישוב ברירת מחדל, רק אם המשתמש מבקש "כולל all"
- **Weighted scoring (עתידי)**: הצבעות עם השתתפות גבוהה מקבלות משקל גדול יותר
  בחישוב הציון — 80 משתתפים > 30 משתתפים

#### 10. סחיפת הקשר היסטורי (Context Drift)

**הסיכון**: stance כמו "תמיכה בהתנחלויות" יכול להיות שונה לחלוטין בכנסת 15
(1999) לעומת כנסת 25 (2022). מחיר למשתכן ב-2015 ≠ מחיר למשתכן ב-2025.
שיוך הצבעות היסטוריות ל-stance "מודרני" עלול ליצור השוואות מטעות.

**פתרונות**:

- **שדה description**: כל stance כולל תיאור שמגדיר את ההיקף — "הקלת תנאי
  התחדשות עירונית (2020+)" מפורש לגבי תקופת הרלוונטיות
- **Era-scoped stances**: אם אותו נושא השתנה מהותית, יוצרים stance נפרד
  לכל תקופה — "תוכנית מחיר למשתכן (כנסת 20)" ≠ "תוכנית דיור לאומית (כנסת 25)"
- **Confidence decay**: ה-AI מתבקש להוריד confidence כשמדובר בהצבעה ישנה
  שה-match שלה ל-stance עכשווי לא ודאי — ככל שהפער בזמן גדול, יותר סיכוי ש-
  ילך ל-admin review
- **הפרדת כנסות ב-UI**: ציון MK מחושב per-knesset, לא aggregated על פני 25
  שנה. המשתמש רואה "כנסת 25: הצביע בעקביות בעד" בנפרד מכנסות קודמות

#### 11. איכות סיווג ב-Batch

**הסיכון**: כששולחים 15 הצבעות ב-prompt אחד (multi-vote bills), האיכות
עלולה לרדת להצבעות מאוחרות בגלל "attention fatigue" של המודל — ההצבעות
האחרונות מקבלות פחות תשומת לב.

**פתרונות**:

- **Random order**: ערבוב סדר ההצבעות בכל batch — אם יש ירידת איכות,
  היא לא תמיד פוגעת באותן הצבעות
- **Confidence monitoring**: מעקב אחרי distribution של confidence per
  position-in-batch. אם ההצבעות ב-positions 12-15 מקבלות consistently
  confidence נמוך יותר ← מקטינים את ה-batch size
- **Validation sample**: אחרי backfill — דגימת 50 הצבעות מ-batches גדולים
  ובדיקה ידנית שהסיווג הגיוני
- **Adaptive batch size**: התחלה ב-15, אם שיעור ה-`needs_review` > 30%
  ← ירידה ל-10. אם < 10% ← עלייה ל-20

#### 12. איכות Tavily להקשר פוליטי (Derived Stances)

**הסיכון**: תוצאות Tavily להצעות חוק ישנות או שוליות עלולות להיות ריקות,
לא רלוונטיות, או מוטות לצד פוליטי אחד. חוקים משנות ה-90 כמעט ולא
מופיעים באתרי חדשות עכשוויים.

**פתרונות**:

- **Graceful degradation**: אם Tavily לא מחזיר תוצאות רלוונטיות, הסיווג
  ממשיך ללא הקשר פוליטי — derived stances מסווגים מטקסט המסמך בלבד
  עם confidence threshold גבוה יותר (0.8 במקום 0.6)
- **Cache per-bill**: תוצאות Tavily נשמרות ב-`bill_classification_context`
  — לא קוראים שוב לאותה הצעה כשמוסיפים stance חדש
- **Source diversity**: `includeDomains` כולל גם כלי תקשורת ימניים וגם
  שמאליים (ynet, walla, mako, haaretz, kan) — מפחית הטיה
- **Admin review**: derived stances תמיד עוברים ביקורת — גם אם Tavily
  נתן confidence גבוה, ה-admin רואה את תוצאות החיפוש ויכול לדחות

#### 13. Incremental Backfill — סחיפת Embedding

**הסיכון**: סינון מקדים ב-embedding עלול לפספס הצעות חוק רלוונטיות
(false negatives) או להציף את Claude במועמדים לא-רלוונטיים (false positives)
— במיוחד עבור דפוסי מדיניות מופשטים כמו "ריכוז סמכויות".

**פתרונות**:

- **סף similarity נמוך** (0.3 ברירת מחדל) — מעדיף recall על precision.
  Claude מסנן false positives בעצמו, מה שזול (~$0.0015 per bill)
- **Admin override**: אם admin חושד ש-backfill פספס הצעות, יכול להריץ
  full scan (ללא embedding filter) על כנסת ספציפית — יקר יותר אבל מקיף
- **Embedding quality monitor**: אחרי backfill, logging של
  `bills_above_threshold / total_matches`. אם < 5% — ה-embedding
  לא טוב מספיק, צריך לנסח מחדש את ה-stance description
- **Lazy embedding computation**: embeddings מחושבים on-demand
  (בפעם הראשונה שמריצים incremental backfill) ונשמרים. לא מחייב
  חישוב מראש על כל הcorpus
