# 14 — State Budget Analysis Pipeline (ניתוח תקציב המדינה)

> **Status: Future — to be implemented after bill document pipeline (doc 13)**
>
> This plan covers linking Knesset budget votes to actual budget content,
> enabling citizens to understand what each vote on "סעיף 43 כהצעת הוועדה"
> or "הסתייגות 1169" actually means in practical terms.

## Problem

The Knesset votes on the state budget at the **section level** — each vote
corresponds to a specific budget section (סעיף), reservation (הסתייגות), or
group of sections. Our `votes` table has:

- **16,478 total votes** in the DB, **2,981** budget-related
- **0 summaries**, **0 metadata** — completely empty content fields
- Vote titles like: `"הצעת חוק התוכנית הכלכלית...— סעיף 43 כהצעת הוועדה"`
- `VoteSubject` from OData: `"סעיף 43 כהצעת הוועדה"` / `"הסתייגות 1169"`
- **No description** of what section 43 actually does or what reservation 1169 changes

Additionally, many items on the budget agenda are actually **approvals for
various laws** that require budget allocation (חוקי תקופה, הקצאות תקציביות).

## Data Sources

### 1. Budget Excel Files (Ministry of Finance / Tableau)

**Direct download URLs:**

```
https://www.gov.il/BlobFolder/policy/tableau/he/tableau_BudgetData-{YEAR}.xlsx
```

Available: 1997–2026 (updated March 2026).

**Contains:** Itemized budget by section numbers — ministry, program, sub-program,
economic classification, amounts (proposed, approved, actual).

**Interactive dashboard:**

```
https://public.tableau.com/app/profile/mof.takzivim/viz/_17478098558190/sheet0
```

### 2. Budget Bill PDFs (Knesset)

From `KNS_DocumentBill`:

- **Type 2** (first reading) and **Type 4** (2nd/3rd reading) PDFs for
  חוק התקציב bills
- Example: `https://fs.knesset.gov.il/25/law/25_ls2_12119197.pdf`
  (חוק התקציב 2026 — 2nd/3rd reading)
- These PDFs contain the actual **legal text** of budget sections

### 3. Budget Booklets (Knesset Budget Docs Page)

```
https://main.knesset.gov.il/About/Pages/Budget/Budgetdocs{YEAR}.aspx
```

PDF booklets organized by topic/ministry from the Knesset research center.
The page is JS-rendered (cannot be scraped with simple fetch), may need
a headless browser or manual URL extraction.

### 4. Budget Explanations Page

```
https://main.knesset.gov.il/About/Pages/Budget/default.aspx
```

General explanations of the budget process and structure.

### 5. Votes OData

- **OData v4**: `KNS_PlenumVote` — `VoteTitle`, `VoteSubject`, `ItemID`
- **OData v3**: `View_vote_rslts_hdr_Approved` — `vote_item_dscr`, `sess_item_dscr`

## Architecture Overview

### Phase 1: Budget Data Ingestion

```
A. Download & parse budget Excel
   ├── xlsx parser (SheetJS) → structured JSON
   ├── Columns: ministry, program, sub-program, section, amount, description
   └── Store in new budget_items table

B. Download budget bill PDFs
   ├── From KNS_DocumentBill (Type 4 for final version)
   ├── Send to Gemini Flash for section extraction
   └── Output: {sectionNumber, title, legalText} per section

C. Map vote sections to budget items
   ├── Parse vote title: "סעיף 43" → sectionNumber=43
   ├── Parse reservation: "הסתייגות 1169" → reservationId=1169
   ├── Join with budget_items on section + year
   └── Store mapping in vote_budget_context table
```

### Phase 2: AI Enrichment

```
For each budget vote:
├── Context assembly:
│   ├── Vote title + subject
│   ├── Budget item details (from Excel: ministry, program, amount, description)
│   ├── Legal text (from PDF: what the section actually says)
│   ├── Related bill name (from votes.billId join)
│   └── Web search (Tavily, if needed for high-profile items)
├── Claude Sonnet → summary + classification in 4 languages
└── Store in votes.summary + votes.metadata
```

### Phase 3: Reservation Resolution

Budget reservations (הסתייגויות) are proposed amendments to specific sections:

- `"הסתייגות 1169"` → need to find what it proposes to change
- Reservations are discussed in committee protocols (KNS_DocumentBill Type 23)
- May need to cross-reference with plenum session records

## New Tables

```sql
-- Budget items from Excel/Tableau data
CREATE TABLE budget_items (
  id SERIAL PRIMARY KEY,
  fiscal_year INTEGER NOT NULL,
  ministry_code TEXT,
  ministry_name TEXT,
  program_code TEXT,
  program_name TEXT,
  sub_program_code TEXT,
  sub_program_name TEXT,
  section_number INTEGER,
  economic_code TEXT,
  description TEXT,
  proposed_amount BIGINT,
  approved_amount BIGINT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_budget_items_year_section ON budget_items(fiscal_year, section_number);

-- Vote-to-budget mapping
CREATE TABLE vote_budget_context (
  id SERIAL PRIMARY KEY,
  vote_id INTEGER REFERENCES votes(id),
  budget_item_id INTEGER REFERENCES budget_items(id),
  section_number INTEGER,
  reservation_id INTEGER,
  context_type TEXT NOT NULL,  -- 'section', 'reservation', 'group'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_vote_budget_vote ON vote_budget_context(vote_id);
```

## AI Model Selection

| Task                                         | Model                 | Rationale                                     |
| -------------------------------------------- | --------------------- | --------------------------------------------- |
| **PDF reading** (budget bills, 50–200 pages) | Gemini Flash          | 258 tok/page, 1000 page limit, free Files API |
| **Excel parsing**                            | Code (SheetJS)        | No AI needed — structured data                |
| **Summary + classification**                 | Claude Sonnet         | Best reasoning quality for Hebrew legal text  |
| **Reservation research**                     | Gemini Flash + Tavily | Cheaper for information gathering             |

## Cost Estimates

| Item                              | Volume                        | Tokens | Cost        |
| --------------------------------- | ----------------------------- | ------ | ----------- |
| Budget PDF reading (Gemini Flash) | ~4 PDFs × 100 pages           | ~100K  | ~$0.01      |
| Excel parsing                     | Code only                     | 0      | $0          |
| Vote summary generation (Claude)  | 2,981 budget votes × 1.5K tok | ~4.5M  | ~$13.50     |
| Tavily search (selective)         | ~500 high-profile votes       | —      | ~$4         |
| **Total**                         |                               |        | **~$17.50** |

## Dependencies

- **Bill document pipeline (doc 13)** must be built first — shares:
  - `bill_documents` table and sync job
  - Gemini Flash PDF reading module
  - Document priority and prompt patterns
- **xlsx** (SheetJS) npm package for Excel parsing
- Budget Excel file structure analysis (column mapping)

## Implementation Order (Future)

1. Analyze budget Excel column structure
2. Create `budget_items` table + migration
3. Build Excel ingestion script
4. Build vote-section mapping logic
5. Create `vote_budget_context` table + migration
6. Build vote enrichment pipeline (context assembly + AI)
7. Add reservation resolution (Phase 3)
8. UI integration — show vote context on vote detail pages

## Open Questions

- [ ] Can we reliably extract section numbers from vote titles? (regex: `סעיף \d+`)
- [ ] How are "קבוצת סעיפים" (section groups) handled? (e.g., "סעיפים 44–55")
- [ ] Are reservation numbers traceable to specific committee protocols?
- [ ] Should we also process non-budget votes (regular bill votes)?
- [ ] What's the best way to handle the Tableau interactive dashboard data?
