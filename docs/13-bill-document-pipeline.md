# 13 — Bill Document Reading Pipeline (חילוץ תובנות מרשומות חוקים)

> Improved pipeline for extracting meaningful summaries and classifications
> from bill records by combining **web search**, **official DOC/PDF documents**
> from the Knesset file server, and **AI analysis**.

## Problem

The current pipeline uses **Tavily web search → Claude Sonnet** to generate
bill summaries. This works well for prominent bills that have media coverage,
but:

1. Many bills get **0 Tavily results** (especially technical/niche ones)
2. Web search only finds **news commentary**, not the **actual bill text**
3. "דברי הסבר" (explanatory notes) embedded in the bill PDFs contain the
   most authoritative description of what a bill does — but we don't read them
4. Tags remain too generic when the AI only has a bill name and a news snippet

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

### Phase 3: Enhanced Summary Generator

Update `summary-generator.ts` to incorporate document text:

```
generateBillSummary(bill, chapterNames?)
├── 1. Check bill_documents for available docs
│      Prioritize: Type 4 > 2 > 1 > 3 > 60 > 59 > 12
├── 2. Read highest-priority document (if exists)
│      Extract "דברי הסבר" section if present
├── 3. Tavily web search (existing, unchanged)
├── 4. Build enhanced prompt:
│      ├── Bill metadata (existing)
│      ├── [NEW] Document text / דברי הסבר
│      ├── Budget context (existing, if applicable)
│      └── Web search results (existing)
├── 5. Claude Sonnet → summary + topics in 4 languages
└── 6. Store results (existing)
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

## Implementation Order

1. **Migration** — `bill_documents` table
2. **sync-bill-documents.ts** — OData sync job
3. **document-reader.ts** — PDF (Gemini) + DOC (officeparser) reading
4. **Update summary-generator.ts** — incorporate document context
5. **Update bill-summary.ts prompt** — document priority instructions
6. **Update app.config.ts** — document reading config (Gemini model, max pages)
7. **Test run** — small batch with document context
8. **Full run** — all K25/24/23 bills

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
}
```

## Risk Mitigation

- **Large PDFs**: Budget bill PDFs (חוק התקציב) can be 100+ pages.
  Limit to `maxPages` and extract only relevant sections.
- **DOC conversion failures**: Some old `.doc` files may fail to parse.
  Log and skip gracefully — fall back to web search only.
- **Rate limiting**: Gemini API has generous free tier (15 RPM on Flash).
  Add 200ms delay between PDF reads.
- **FilePath 404s**: Some old documents may have moved. Check HTTP status
  before processing; skip broken links.
- **Token overflow**: If document text + web results + prompt > context window,
  truncate document text to `maxDocumentChars`.
