# Bill Document Pipeline — Test Results

**Date**: 2026-04-10  
**Pipeline**: `src/pipeline/jobs/sync-bill-documents.ts` → `src/lib/ai/legislation/document-reader.ts` → `src/lib/ai/legislation/summary-generator.ts` → `src/pipeline/jobs/generate-bill-summaries.ts`

## 1. Document Reading Test (--read-only)

All 5 document types were tested for raw text extraction without AI summarization.

| #   | DocType | Type Name           | Extension | Read Method  | Chars Extracted | Time (s) | Status |
| --- | ------- | ------------------- | --------- | ------------ | --------------- | -------- | ------ |
| 1   | 1       | דיון מוקדם          | .docx     | officeparser | 2,366           | 1.0      | ✅     |
| 2   | 2       | קריאה ראשונה        | .pdf      | unpdf        | 51,992          | 1.5      | ✅     |
| 3   | 4       | קריאה שנייה ושלישית | .pdf      | unpdf        | 61,627          | 4.0      | ✅     |
| 4   | 59      | חומר רקע            | .pdf      | unpdf        | 53,061          | 0.7      | ✅     |
| 5   | 60      | נוסח לוועדה         | .docx     | officeparser | 3,393           | 0.3      | ✅     |

### Observations

- **PDF extraction** (unpdf): Fast and reliable, extracts full Hebrew text including RTL. Larger PDFs (60K+ chars) take ~4s.
- **DOCX extraction** (officeparser v6): Returns structured object with `.toText()`. Much less text than PDF equivalents since DOC files are typically shorter bill proposals.
- **Document context truncation**: The pipeline uses `maxDocumentChars: 8000` from `app.config.ts` to cap the document text sent to the AI.

---

## 2. Per-Stage AI Summary Tests

Each test: syncs target documents → reads document → generates 4-language summary + topics → writes to `bill_stage_summaries` table.

### Summary Table

| #   | Stage           | DocType | BillStage                | Bill Name                                              | Tokens | Time (s) | Status        |
| --- | --------------- | ------- | ------------------------ | ------------------------------------------------------ | ------ | -------- | ------------- |
| 1   | Preliminary     | 1       | 1 (PRELIMINARY)          | הצעת חוק הביטוח הלאומי (תיקון – אישור ועדת העבודה...   | 3,615  | 18.6     | ✅            |
| 2   | First Reading   | 2       | 3 (FIRST_READING)        | הצעת חוק תאגידי מים וביוב (תיקון מס' 20)...            | 15,295 | 25.5     | ✅            |
| 3   | 2nd+3rd Reading | 4       | 5 (SECOND_THIRD_READING) | הצעת חוק שיקום נזקי מלחמה בדרך של התחדשות עירונית...   | 8,454  | 30.2     | ✅            |
| 4   | Committee       | 60      | 4 (COMMITTEE_SECOND)     | חוק לתיקון פקודת העיריות (הוראת שעה) (תיקון מס' 5)...  | 4,436  | 22.3     | ✅            |
| 5   | Background      | 59      | 0 (SUBMITTED)            | הצעת חוק העמדה לדין של משתתפי אירועי טבח 7 באוקטובר... | 3,356  | 6.2      | ❌ NO_SUMMARY |

---

## 3. Detailed Results

### 3.1 Preliminary (דיון מוקדם) — DocType 1

- **Bill**: הצעת חוק הביטוח הלאומי (תיקון – אישור ועדת העבודה והרווחה לשינויים בהסכם הניידות), התשפ"ו–2026
- **Bill ID**: 85, Knesset Bill ID: 2241208
- **Document**: https://fs.knesset.gov.il/25/law/25_lst_12079387.docx
- **Read Method**: officeparser (DOCX) → 2,366 chars
- **Stage Detected**: 1 (PRELIMINARY) from doc type 1
- **Tokens**: 3,615 | **Time**: 18.6s
- **Web Search**: Tavily — results found, skipping per doc priority

#### Hebrew Summary

> הצעת החוק מחייבת אישור מראש של ועדת העבודה והרווחה של הכנסת לשינויים מהותיים בהסכם הניידות, במקום חובת התייעצות בלבד. השינוי נועד למנוע מהממשלה לבצע רפורמות חד-צדדיות שפוגעות בזכויות אנשים עם מוגבלויות.

#### English Summary

> The bill requires prior approval from the Knesset Labor and Welfare Committee for significant changes to the mobility agreement, replacing the current requirement of mere consultation. The change aims to prevent the government from implementing unilateral reforms that harm the rights of people with disabilities.

#### Topics

- **Hebrew**: פיקוח פרלמנטרי על הסכם ניידות, זכויות אנשים עם מוגבלויות, חופש בחירה בספקי שירותי אבזור, מניעת רפורמות חד-צדדיות בביטוח לאומי
- **English**: Parliamentary oversight of mobility agreements, Rights of people with disabilities, Freedom of choice for assistive equipment suppliers, Prevention of unilateral social security reforms

---

### 3.2 First Reading (קריאה ראשונה) — DocType 2

- **Bill**: הצעת חוק תאגידי מים וביוב (תיקון מס' 20) (הפעלת שירותי מים וביוב על ידי רשות מקומית), התשפ"ו–2026
- **Bill ID**: 15, Knesset Bill ID: 2197981
- **Document**: https://fs.knesset.gov.il/25/law/25_ls1_12204616.pdf
- **Read Method**: unpdf (PDF) → 51,992 chars (truncated to 8,000 for AI)
- **Stage Detected**: 3 (FIRST_READING) from doc type 2
- **Tokens**: 15,295 | **Time**: 25.5s
- **Web Search**: Tavily returned 5 results

#### Hebrew Summary

> הצעת חוק המאפשרת לרשויות מקומיות לנהל בעצמן את שירותי המים והביוב שבתחומן, ללא צורך בהקמת תאגיד מים וביוב, בתנאי שיעמדו בקריטריונים של פחת מים נמוך, שיעור גבייה גבוה ויציבות פיננסית. החוק מבטל את החובה להקים תאגידי מים אזוריים.

#### English Summary

> A bill allowing local authorities to operate water and sewage services independently within their jurisdiction without establishing a water and sewage corporation, provided they meet criteria for low water loss, high collection rates, and financial stability.

#### Topics

- **Hebrew**: הפעלה עצמית של שירותי מים וביוב, ביטול חובת הקמת תאגידי מים אזוריים, קריטריונים לפחת מים ושיעור גבייה, אישור שר האנרגיה להפעלה עצמית
- **English**: Independent water and sewage services operation, Cancellation of regional water corporation requirement, Water loss and collection rate criteria, Energy minister approval for independent operation

---

### 3.3 Second + Third Reading (קריאה ב'+ג') — DocType 4

- **Bill**: הצעת חוק שיקום נזקי מלחמה בדרך של התחדשות עירונית, התשפ"ו–2026
- **Bill ID**: 2, Knesset Bill ID: 1046091
- **Document**: https://fs.knesset.gov.il/25/law/25_ls2_12193041.pdf
- **Read Method**: unpdf (PDF) → 61,627 chars (truncated to 8,000 for AI)
- **Stage Detected**: 5 (SECOND_THIRD_READING) from doc type 4
- **Tokens**: 8,454 | **Time**: 30.2s
- **Web Search**: Tavily returned 1 result

#### Hebrew Summary

> החוק מאפשר הכרזה על אזורים שנפגעו מנזקי מלחמה כאזורי שיקום והתחדשות, כולל בניינים הרוסים או פגועים. החוק מגדיר מנגנונים להתחדשות עירונית מהירה באזורים אלה, קובע נהלים לעסקאות עם בעלי דירות ומגרשים, וכולל הוראות מיוחדות לשיקום.

#### English Summary

> The law enables declaring war-damaged areas as rehabilitation and urban renewal zones, including destroyed or damaged buildings. It establishes mechanisms for rapid urban renewal in these areas, sets procedures for transactions with property owners.

#### Topics

- **Hebrew**: שיקום אזורים פגועי מלחמה, התחדשות עירונית מואצת, זכויות בעלי דירות בשיקום, הליכי הכרזה על אזורי שיקום
- **English**: War-damaged area rehabilitation, Accelerated urban renewal, Property owners' rights in rehabilitation, Rehabilitation zone declaration procedures

---

### 3.4 Committee Version (נוסח לוועדה) — DocType 60

- **Bill**: חוק לתיקון פקודת העיריות (הוראת שעה) (תיקון מס' 5), התש"ף-2020
- **Bill ID**: Knesset 23, Knesset Bill ID: 2140470
- **Document**: https://fs.knesset.gov.il//23/law/23_lsc2_573768.docx
- **Read Method**: officeparser (DOCX) → 3,393 chars
- **Stage Detected**: 4 (COMMITTEE_SECOND) from doc type 60
- **Tokens**: 4,436 | **Time**: 22.3s
- **Web Search**: Tavily returned 0 results (older bill from Knesset 23)

#### Hebrew Summary

> החוק מאריך הוראת שעה הנוגעת לעיריות עד 31 בדצמבר 2021, וקובע חובת דיווח על עיריות לשר הפנים לגבי הוצאותיהן ותקבוליהן בשנים 2018-2020, כולל פירוט פעולות אכיפה ופיקוח. השר נדרש להעביר דיווח מסכם לוועדת הפנים.

#### English Summary

> The law extends a temporary provision regarding municipalities until December 31, 2021, and establishes mandatory reporting requirements for municipalities to the Interior Minister regarding their expenditures and revenues.

#### Topics

- **Hebrew**: הארכת הוראת שעה לעיריות, חובת דיווח עירוני לשר הפנים, פיקוח על הוצאות עיריות, דיווח למועצת הכנסת על פעילות עירונית
- **English**: Extension of municipal temporary provision, Municipal reporting requirement to Interior Minister, Municipal expenditure oversight, Parliamentary reporting on municipal activities

---

### 3.5 Background Material (חומר רקע) — DocType 59 ❌

- **Bill**: הצעת חוק העמדה לדין של משתתפי אירועי טבח 7 באוקטובר, התשפ"ו–2026
- **Bill ID**: 576, Knesset Bill ID: 2222852
- **Document**: https://fs.knesset.gov.il/25/law/25_ls_bk_12110189.pdf
- **Read Method**: unpdf (PDF) → 53,061 chars (truncated to 8,000 for AI)
- **Stage Detected**: 0 (SUBMITTED)
- **Tokens**: 3,356 | **Time**: 6.2s
- **Result**: **NO_SUMMARY** — The background document was a research paper about the Special Court for Sierra Leone, not directly about the Israeli bill. The AI correctly identified the document as insufficient for generating a bill summary.

> **Note**: This bill actually has official documents (types 1, 2 — visible on its Knesset page). In the test we forced type 59 in isolation; in production the pipeline would never reach type 59 for this bill because official docs have higher priority. See "Background Document Handling" below.

#### Post-Test Fix: Background Document Safeguards

Two safeguards were added to `document-reader.ts` after this test:

1. **Skip when official docs exist** — If a bill has any official document types (1, 2, 3, 4, 17, 60), background/research types (59, 12) are skipped entirely. No download, no text extraction, no tokens wasted.

2. **Keyword relevance check** — When a background doc _is_ the only option, the pipeline extracts key Hebrew words from the bill name and checks if ≥2 appear in the document text. The Sierra Leone paper would fail this check (no Hebrew bill keywords found) and be skipped _before_ reaching the AI, saving ~3,356 tokens.

```
readBillDocumentContext(billId, billName)
  ├── Has official docs (types 1,2,3,4,17,60)?
  │   └── YES → skip types 59, 12 entirely
  │   └── NO  → try type 59/12 but check relevance first:
  │       ├── isDocumentRelevant(billName, docText) → true → use it
  │       └── isDocumentRelevant(billName, docText) → false → skip, log warning
  └── Fall through to web search only
```

---

## 4. Performance Comparison

| Stage           | DocType  | Read Method  | Doc Size     | Tokens | AI Time (s) | Total Cost (est.) |
| --------------- | -------- | ------------ | ------------ | ------ | ----------- | ----------------- |
| Preliminary     | 1 (DOC)  | officeparser | 2,366 chars  | 3,615  | 18.6        | ~$0.02            |
| First Reading   | 2 (PDF)  | unpdf        | 51,992 chars | 15,295 | 25.5        | ~$0.08            |
| 2nd+3rd Reading | 4 (PDF)  | unpdf        | 61,627 chars | 8,454  | 30.2        | ~$0.04            |
| Committee       | 60 (DOC) | officeparser | 3,393 chars  | 4,436  | 22.3        | ~$0.02            |
| Background      | 59 (PDF) | unpdf        | 53,061 chars | 3,356  | 6.2         | ~$0.02            |

**Total tokens across 5 tests**: 35,156 (~$0.18 estimated)

### Key Observations

1. **PDF extraction is free** — Switched from Gemini Flash ($0.01/1K tokens) to unpdf (local, free). Significant cost savings at scale (15K+ documents).
2. **Document context improves summary quality** — When the document directly relates to the bill, the summary is more specific and accurate than web-search-only summaries.
3. **Token usage varies significantly** — First Reading used 15K tokens (5 web sources + doc context) vs Preliminary at 3.6K tokens (doc only). Depends on web search results.
4. **Background documents are pre-filtered** — Type 59/12 (חומר רקע, מחקר) are skipped when official docs exist, and undergo a keyword relevance check otherwise. Saves ~3K+ tokens per irrelevant document.
5. **Stage detection works correctly** — Each document type maps to the correct BillStage value.

---

## 5. Stage Storage Verification

After all tests, the `bill_stage_summaries` table contains:

| Bill ID | Stage | Stage Name           | Source Doc Type |
| ------- | ----- | -------------------- | --------------- |
| 85      | 1     | PRELIMINARY          | 1               |
| 15      | 3     | FIRST_READING        | 2               |
| 2       | 5     | SECOND_THIRD_READING | 4               |
| 2140470 | 4     | COMMITTEE_SECOND     | 60              |

The per-stage UPSERT logic works: each bill can have multiple stage summaries, and `bills.aiSummary` is only updated when a higher stage is processed.

---

## 6. Bug Fixes During Testing

1. **Double URL prefix** — OData v4 returns full URLs (`https://fs.knesset.gov.il/...`), but `normalizeFilePath()` was prepending the base again. Fixed with URL detection.
2. **Gemini API key missing** — No `GOOGLE_GENERATIVE_AI_API_KEY` in `.env.local`. Switched PDF extraction from Gemini Flash to local `unpdf` library (free, no API key needed).
3. **officeparser v6 API change** — `parseOfficeAsync` replaced with `parseOffice`, returns object with `.toText()` method instead of plain string.
4. **AI SDK v6 schema** — `mimeType` renamed to `mediaType` for file parts (noted for future Gemini integration).
5. **Background doc token waste** — Type 59/12 docs sent to AI even when irrelevant. Added two-layer filter: skip when official docs exist + keyword relevance check.

---

## 7. Architecture Summary

```
OData v4 API (KNS_DocumentBill)
    ↓ sync-bill-documents.ts (full/incremental)
bill_documents table (15K+ docs with type, file_path)
    ↓ document-reader.ts
    ├── Priority sort: 4 → 2 → 1 → 3 → 60 → 59 → 12 → 17
    ├── Types 59/12 skipped if official types exist
    ├── Types 59/12 keyword relevance check (if only option)
    ├── PDF → unpdf (local text extraction)
    └── DOC/DOCX → officeparser (local text extraction)
    ↓ extractExplanatoryNotes() → maxDocumentChars: 8000
summary-generator.ts
    ├── Document context (PRIMARY)
    ├── Tavily web search (SUPPLEMENTARY)
    └── Claude Sonnet 4 → 4 languages
    ↓ generate-bill-summaries.ts
bill_stage_summaries (per-stage UPSERT)
    ↓ if highest stage
bills.aiSummary + bills.aiTopics (main record)
```
