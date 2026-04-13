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
│   ├── PDF → Gemini Flash (258 tokens/page, ~$0.003/doc)
│   ├── DOC/DOCX → mammoth or officeparser → plain text
│   └── Fallback: skip if unavailable/too large
└── extractExplanatoryNotes(fullText) → string
    Extract "דברי הסבר" section from bill text (pattern matching)
```

**Why Gemini Flash for PDF reading:**

- 258 tokens per page vs 1,500–3,000 for Claude = **6–12x cheaper**
- Up to 1,000 pages (vs 600 for Claude)
- Free Files API (48h retention) — can cache uploaded PDFs
- URL-based PDF input — no need to download first
- Bill PDFs are typically 2–20 pages = **~500–5,000 tokens = <$0.001**

**Why officeparser/mammoth for DOC:**

- DOC files have plain text that can be extracted without AI
- No reason to burn tokens on text extraction
- `mammoth` converts DOCX→text; `officeparser` handles old `.doc` format

### Phase 3: Enhanced Summary Generator (Stage-Aware)

Update `summary-generator.ts` to incorporate document text and per-stage storage:

```
generateBillSummary(bill, chapterNames?)
├── 1. Fetch bill_documents ordered by type priority
│      Prioritize: Type 4 > 2 > 1 > 3 > 60 > 59 > 12
├── 2. Group documents by stage (DocType → BillStage mapping)
├── 3. For each stage with unprocessed documents (or highest only for backfill):
│      ├── Read document (PDF via Gemini / DOC via officeparser)
│      ├── Extract "דברי הסבר" section if present
│      ├── Tavily web search (existing, unchanged)
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
- If an official bill document is provided, it is your PRIMARY source of truth.
- דברי הסבר (explanatory notes) describe the bill's PURPOSE and IMPACT — use
  these to write the summary and derive meaningful topic tags.
- Web search results are supplementary — use them to verify currency and add
  context about public debate or implementation status.
- If the document text is available, your tags MUST reflect the specific
  provisions described in the document, not just the broad topic.
```

## Cost Estimates

| Item                       | Volume                     | Tokens    | Cost              |
| -------------------------- | -------------------------- | --------- | ----------------- |
| PDF reading (Gemini Flash) | ~5,000 bills × 5 pages avg | ~6.5M     | **~$0.065**       |
| DOC text extraction        | ~3,000 bills               | 0 (local) | **$0**            |
| Claude Sonnet generation   | ~14,000 bills × 2K tok     | ~28M      | **~$84**          |
| Tavily search              | ~14,000 bills              | —         | **~$112** (basic) |
| **Total**                  |                            |           | **~$196**         |

vs. current approach without documents: **~$154** (Tavily + Claude)
→ Incremental cost of document reading: **~$42** (+27%) for significantly better quality.

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

| Score Range | Hebrew Label          | English Label                      |
| ----------- | --------------------- | ---------------------------------- |
| > 95%       | הצביע באופן עקבי בעד  | Voted very strongly for            |
| 80–95%      | הצביע ברוב המקרים בעד | Voted strongly for                 |
| 60–80%      | הצביע לרוב בעד        | Voted moderately for               |
| 40–60%      | הצביע באופן מעורב     | Voted a mixture of for and against |
| 20–40%      | הצביע לרוב נגד        | Voted moderately against           |
| 5–20%       | הצביע ברוב המקרים נגד | Voted strongly against             |
| < 5%        | הצביע באופן עקבי נגד  | Voted very strongly against        |
| —           | לא הצביע בנושא זה     | Never voted on this                |

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

---

## Stance Database Schema

### `policy_stances` — Curated Policy Positions

```sql
CREATE TABLE policy_stances (
  id SERIAL PRIMARY KEY,
  label JSONB NOT NULL,              -- {he: "הקלת תנאי התחדשות עירונית", en: "..."}
  description JSONB,                 -- longer explanation, 4 languages
  domain TEXT,                       -- for filtering: housing, security, etc.
  is_active BOOLEAN DEFAULT true,    -- soft-delete / archive
  vote_count INTEGER DEFAULT 0,      -- denormalized: how many votes linked
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_policy_stances_domain ON policy_stances(domain);
```

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
2. Which policy stance it aligns with
3. Whether FOR = supports or opposes that stance

INPUTS PROVIDED:
- Vote title and metadata
- Bill name and summary (if available)
- Bill document text (if available — use to understand section-specific votes)
- List of existing policy stances (to match against)

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

PROCEDURAL VOTES:
Votes on procedure (transferring to committee, naming the bill, continuity)
are NOT policy stances. Return: { "procedural": true }

OUTPUT FORMAT (JSON only):
{
  "procedural": false,
  "proPosition": {
    "he": "...", "en": "...", "ar": "...", "ru": "..."
  },
  "stanceMatch": {
    "existingStanceId": 42,       // or null if suggesting new
    "newStanceLabel": null,       // or {he: "...", en: "..."} if new
    "newStanceDomain": null,      // or "housing" if new
    "alignment": "supports",
    "confidence": 0.88
  }
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

| Item                       | Volume                     | Tokens    | Cost              |
| -------------------------- | -------------------------- | --------- | ----------------- |
| PDF reading (Gemini Flash) | ~5,000 bills × 5 pages avg | ~6.5M     | **~$0.065**       |
| DOC text extraction        | ~3,000 bills               | 0 (local) | **$0**            |
| Claude Sonnet generation   | ~14,000 bills × 2K tok     | ~28M      | **~$84**          |
| Tavily search              | ~14,000 bills              | —         | **~$112** (basic) |
| **Subtotal A**             |                            |           | **~$196**         |

### Part B: Vote Stance Classification

| Item                                  | Volume                       | Tokens | Cost       |
| ------------------------------------- | ---------------------------- | ------ | ---------- |
| Stance seeding (one-time)             | ~2,000 topics → ~100 stances | ~50K   | **~$0.15** |
| Vote classification (backfill K25)    | ~8,000 votes × ~800 tok      | ~6.4M  | **~$19**   |
| Vote classification (backfill K23-24) | ~15,000 votes × ~800 tok     | ~12M   | **~$36**   |
| Multi-vote bills (doc context)        | ~500 bills × ~5K tok         | ~2.5M  | **~$7.50** |
| **Subtotal B**                        |                              |        | **~$63**   |

### Combined Total

|                                 | Cost                                      |
| ------------------------------- | ----------------------------------------- |
| **Total backfill (A + B)**      | **~$259**                                 |
| **Ongoing per knesset session** | **~$7/year** (stance classification only) |

Note: Multi-vote bill batching saves ~70% vs. classifying each vote
independently (document context sent once per batch, not per vote).

## Implementation Order

### Part A: Document Reading & Summaries

1. **Migration** — `bill_documents` + `bill_stage_summaries` tables
2. **sync-bill-documents.ts** — OData sync job
3. **document-reader.ts** — PDF (Gemini) + DOC (officeparser) reading
4. **Update summary-generator.ts** — incorporate document context + stage-aware writes
5. **Update bill-summary.ts prompt** — document priority instructions
6. **Update app.config.ts** — document reading config (Gemini model, max pages)
7. **Test run** — small batch with document context + verify stage summaries
8. **Full run** — all K25/24/23 bills (backfill: highest-priority doc per bill)
9. **Stepper integration** — query `bill_stage_summaries` in InteractiveStagePipeline

### Part B: Policy Stance Classification

Steps 10–11 can begin in parallel with steps 4–5 above.

10. **Migration** — `policy_stances` + `vote_stance_alignment` tables
11. **Seed stances** — One-time AI batch:
    - Collect all distinct `aiTopics` from existing bills
    - Send to Claude: "Group these ~2,000 topics into 80–150 directional
      policy stances. Each stance should represent a clear policy direction
      that an MK can support or oppose."
    - Insert results into `policy_stances`
    - Manual admin review of the seeded stances (~1 hour of work)
12. **`classify-vote-stances.ts`** — Pipeline job:
    - Query: all votes with `bill_id IS NOT NULL` and no entry in
      `vote_stance_alignment`
    - Group by bill (to batch multi-vote bills)
    - For each group:
      - Fetch bill document text (from Part A)
      - Fetch bill summary/topics
      - Send to Claude (single or batch mode)
      - Insert into `vote_stance_alignment`
      - Queue low-confidence items for review
    - Checkpoint by vote.created_at
13. **Admin review UI** — Add stance review type to `/admin/ai-review`
14. **Stance management page** — `/admin/stances` — CRUD, merge, archive
15. **tRPC endpoint** — `members.stanceProfile` (MK position aggregation)
16. **MK profile UI** — Stance cards on MK profile page, filterable by domain
17. **Comparison view** — Select 2+ MKs, see stances side by side
18. **Cron trigger** — When `sync-votes` inserts new votes, queue classification

### Future: Reservation Classification (הסתייגויות)

Deferred. When implemented:

- הסתייגויות are detected by title regex (already working in StageVotePanel)
- Each reservation vote would get classified independently
- Context would come from the committee protocol document (if available)
  or from the reservation title + bill document

## Configuration (app.config.ts additions)

```typescript
billSummary: {
  // ... existing config ...
  documentReader: {
    /** Gemini model for PDF text extraction */
    pdfModel: process.env.BILL_DOC_PDF_MODEL ?? 'gemini-2.5-flash',
    /** Max pages to read from a bill PDF */
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
    /** Max tokens per classification */
    maxTokens: Number(process.env.STANCE_AI_MAX_TOKENS ?? 1024),
  },
  /** Confidence threshold — below this goes to admin review */
  reviewThreshold: Number(process.env.STANCE_REVIEW_THRESHOLD ?? 0.75),
  /** Max votes per batch (for multi-vote bills) */
  batchSize: Number(process.env.STANCE_BATCH_SIZE ?? 15),
  /** Minimum votes needed to display MK score on a stance */
  minVotesForScore: Number(process.env.STANCE_MIN_VOTES ?? 2),
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
- Fallback: אם הטקסט חתוך, ה-AI עדיין מקבל את Tavily כהקשר משלים

#### 2. כשלון המרת DOC/DOCX

**הסיכון**: קבצי `.doc` ישנים (מכנסות 15-20) עלולים להשתמש בפורמטים
לא-סטנדרטיים ש-`officeparser` ו-`mammoth` לא יודעים לקרוא. הנתיב הזה
עלול לזרוק חריגה ולעצור את כל ה-pipeline.

**פתרונות**:

- `try/catch` סביב כל קריאת מסמך — כשל = `null`, לא exception
- Fallback chain: `mammoth` → `officeparser` → skip
- לוג ברמת `warn` עם document ID — מאפשר ניתוח בדיעבד של שיעור הכשלונות
- ההצעה עדיין מקבלת סיכום מ-Tavily / metadata בלבד (כמו הזרימה הנוכחית)
- בדיקה חד-פעמית: הרצת `readDocument()` על מדגם של 100 מסמכים ישנים
  כדי לזהות את שיעור הכשל לפני backfill מלא

#### 3. Rate Limiting של Gemini API

**הסיכון**: Gemini Flash מציע 15 RPM בחינם. ב-backfill של 5,000 PDF-ים
ללא טרוטלינג, נחסם תוך שניות.

**פתרונות**:

- דילאי של 200ms בין קריאות PDF (= 5 RPM, בטוח מתחת למגבלה)
- `p-limit(3)` — מקסימום 3 קריאות מקבילות
- Exponential backoff על שגיאות 429: 1s → 2s → 4s → ... (מקסימום 32s)
- Dashboard counter: מספר קריאות Gemini ביום ב-admin sync status
- שקלול: אם הfree tier לא מספיק, Gemini API pricing הוא $0.075/M input
  tokens — עדיין זול ב-10x מ-Claude

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

**הסיכון**: מסמך ארוך + תוצאות Tavily + system prompt + output עלולים לחרוג
מחלון ההקשר של Claude (200K). בפועל, ה-sweet spot לאיכות הוא הרבה מתחת —
~30K tokens.

**פתרונות**:

- חיתוך `maxDocumentChars` (ברירת מחדל: 8,000 תווים ≈ ~3,000 tokens)
- אם הטקסט חורג: חתוך ב-boundary של פסקה (לא באמצע משפט)
- סדר עדיפות לטקסט: דברי הסבר > גוף החוק > נספחים
- `extractExplanatoryNotes()` שולף רק את סקציית דברי ההסבר (בדרך כלל
  20-30% מהמסמך) — מקטין את הטוקנים משמעותית
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
- **סף השתתפות**: הצבעות עם < 20 משתתפים מסווגות אבל מסומנות כ-`low_turnout`
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
