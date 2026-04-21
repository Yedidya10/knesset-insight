# פיצ'ר: יושרה ואתיקה של חברי כנסת ושרים

# Feature: MK & Minister Integrity & Ethics Profile

## 1. חזון (Vision)

להציג בפרופיל של כל חבר כנסת/שר "כרטיס יושרה" מקיף שמרכז מידע ממקורות ממשלתיים, משפטיים ופרלמנטריים רשמיים בנוגע לסוגיות אתיקה, עבריינות, ניגודי עניינים ומוסר ציבורי.

**דוגמה מעשית**: פרשת ח"כ ניסים ואטורי — רשם הקבלנים השעה את רישיונו כקבלן ל-3 שנים והטיל קנס של ~41K ₪ בגין השכרת רישיון לקבלן לא רשום; ארגונים שלחו קובלנה לוועדת האתיקה של הכנסת (ynet, מרץ 2024).

**מטרת הפיצ'ר**: לאפשר לאזרח לראות במקום אחד את כל המידע הפומבי-רשמי הרלוונטי על יושרו של נבחר ציבור, ללא פרשנות — רק עובדות ממקורות מוסמכים.

---

## 2. מקורות מידע (Data Sources)

### 2.1 מקורות זמינים דרך API / נתונים פתוחים

| #   | מקור                                     | סוג מידע                                        | ממשק גישה                                                                          | עדיפות |
| --- | ---------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------- | ------ |
| 1   | **ועדת האתיקה של הכנסת** — פרוטוקולים    | תלונות, החלטות, סנקציות, נזיפות, השעיות         | Knesset OData: `KNS_Committee` (type=ethics) + `KNS_CommitteeSession` → פרוטוקולים | P0     |
| 2   | **ועדת הכנסת (בית)** — בקשות הסרת חסינות | בקשות הסרת חסינות פרלמנטרית, החלטות             | Knesset OData: `KNS_Committee` + פרוטוקולים; חיפוש בסדר יום                        | P0     |
| 3   | **הצעות חוק הסרת חסינות**                | הצעות חוק להסרת חסינות ספציפיות                 | Knesset OData: `KNS_Bill` — סינון לפי סוג/כותרת                                    | P1     |
| 4   | **מבקר המדינה** — דוחות ביקורת           | ממצאי ביקורת, ליקויים, המלצות על משרדים/שרים    | `library.mevaker.gov.il` — Digital Library API / RSS / Scraping                    | P1     |
| 5   | **רשם החברות** (רשות התאגידים)           | בעלויות חברות, דירקטוריונים, ניגודי עניינים     | `ica.justice.gov.il` — חיפוש לפי שם                                                | P2     |
| 6   | **רשם הלוביסטים**                        | קשרים עם שדלנים (לוביסטים) ולקוחותיהם           | Open Knesset CSV: `lobbyists/v_lobbyist`, `v_lobbyist_clients`                     | P1     |
| 7   | **data.gov.il** — מאגרי מידע ממשלתיים    | רשמי קבלנים, רשויות מקומיות, רגולטורים          | REST API — datasets שונים                                                          | P2     |
| 8   | **פסיקה — בתי משפט**                     | כתבי אישום, פסקי דין, הרשעות של פוליטיקאים      | Nevo (בתשלום) / הרשות השופטת (`elyon1.court.gov.il`)                               | P2     |
| 9   | **הצהרות הון** (Financial Disclosures)   | הצהרות הון של חברי כנסת ושרים                   | אתר הכנסת — PDFs / סריקה                                                           | P3     |
| 10  | **Open Knesset — נתונים מורחבים**        | נוכחות, הצבעות, פעילות ועדות — כאינדיקציה נוספת | `production.oknesset.org/pipelines/data/` CSV                                      | P1     |

### 2.2 מקורות הדורשים עיבוד מתקדם (AI/NLP)

| #   | מקור                         | סוג עיבוד              | תיאור                                                              |
| --- | ---------------------------- | ---------------------- | ------------------------------------------------------------------ |
| A   | **פרוטוקולי ועדת אתיקה**     | NLP Extraction         | חילוץ שמות ח"כים, סוג תלונה, והחלטה מתוך פרוטוקולים טקסטואליים     |
| B   | **דוחות מבקר המדינה**        | NLP Extraction + RAG   | זיהוי אזכורים של ח"כים/שרים בדוחות, חילוץ ליקויים ומסקנות          |
| C   | **פסיקה משפטית**             | NLP Entity Recognition | זיהוי שמות פוליטיקאים בפסקי דין, סיווג סוג ההליך                   |
| D   | **חדשות** (news aggregation) | NLP Classification     | סיווג כתבות חדשותיות לפי קטגוריות אתיקה (scraping מחדשות ציבוריות) |

---

## 3. מודל נתונים (Database Schema)

### 3.1 טבלאות חדשות

```sql
-- === סוגיות יושרה ואתיקה של חברי כנסת ===

-- טבלת אירועי יושרה — לב הפיצ'ר
CREATE TABLE integrity_cases (
  id              SERIAL PRIMARY KEY,
  member_id       INTEGER NOT NULL REFERENCES members(id),

  -- סיווג
  category        TEXT NOT NULL,
  -- enum: 'ethics_complaint' | 'immunity_request' | 'criminal_indictment' |
  --       'criminal_conviction' | 'comptroller_finding' | 'conflict_of_interest' |
  --       'regulatory_sanction' | 'disciplinary_action' | 'financial_disclosure_issue'

  severity        TEXT NOT NULL DEFAULT 'info',
  -- enum: 'info' | 'warning' | 'serious' | 'critical'

  status          TEXT NOT NULL DEFAULT 'reported',
  -- enum: 'reported' | 'under_investigation' | 'decided' | 'appealed' |
  --       'closed' | 'convicted' | 'acquitted' | 'sanctions_applied'

  -- תוכן
  title           TEXT NOT NULL,       -- כותרת קצרה (עברית)
  title_en        TEXT,                -- כותרת באנגלית (תרגום AI)
  description     TEXT,                -- תיאור מפורט
  description_en  TEXT,

  -- מקור
  source_type     TEXT NOT NULL,
  -- enum: 'knesset_ethics_committee' | 'knesset_house_committee' |
  --       'state_comptroller' | 'court_ruling' | 'government_registry' |
  --       'police_investigation' | 'attorney_general' | 'official_gazette'
  source_name     TEXT NOT NULL,       -- שם המקור (e.g., "רשם הקבלנים", "ועדת האתיקה")
  source_url      TEXT,                -- קישור למסמך מקורי
  source_doc_id   TEXT,                -- מזהה מסמך במקור

  -- תאריכים
  event_date      DATE NOT NULL,       -- תאריך האירוע/ההחלטה
  reported_date   DATE,                -- תאריך הדיווח/פרסום
  resolution_date DATE,                -- תאריך החלטה סופית

  -- החלטה/תוצאה
  decision        TEXT,                -- תוצאת ההחלטה (e.g., "נזיפה", "השעיה 3 חודשים")
  sanction_type   TEXT,                -- סוג סנקציה אם הוטלה
  financial_amount NUMERIC,            -- סכום קנס/פיצוי (אם רלוונטי)

  -- מטא-דאטה
  metadata        JSONB DEFAULT '{}',  -- מידע נוסף גמיש
  ai_summary      TEXT,                -- סיכום AI
  ai_confidence   REAL,                -- רמת ודאות AI (0-1)
  verified        BOOLEAN DEFAULT FALSE, -- אומת ידנית?
  verified_by     TEXT,                -- מי אימת
  verified_at     TIMESTAMPTZ,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_integrity_cases_member ON integrity_cases(member_id);
CREATE INDEX idx_integrity_cases_category ON integrity_cases(category);
CREATE INDEX idx_integrity_cases_date ON integrity_cases(event_date DESC);
CREATE INDEX idx_integrity_cases_severity ON integrity_cases(severity);

-- קישורים בין אירועים (למשל: תלונה → חקירה → כתב אישום → הרשעה)
CREATE TABLE integrity_case_links (
  id            SERIAL PRIMARY KEY,
  case_id       INTEGER NOT NULL REFERENCES integrity_cases(id) ON DELETE CASCADE,
  related_case_id INTEGER NOT NULL REFERENCES integrity_cases(id) ON DELETE CASCADE,
  link_type     TEXT NOT NULL, -- 'preceded_by' | 'followed_by' | 'related_to' | 'appeals'
  UNIQUE(case_id, related_case_id)
);

-- מסמכי מקור מצורפים
CREATE TABLE integrity_documents (
  id            SERIAL PRIMARY KEY,
  case_id       INTEGER NOT NULL REFERENCES integrity_cases(id) ON DELETE CASCADE,
  doc_type      TEXT NOT NULL, -- 'protocol' | 'ruling' | 'report' | 'indictment' | 'response' | 'other'
  title         TEXT NOT NULL,
  url           TEXT,
  file_path     TEXT,          -- אם נשמר מקומית
  published_at  DATE,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_integrity_documents_case ON integrity_documents(case_id);

-- זיהויים ברשמי חברות (ניגודי עניינים)
CREATE TABLE member_corporate_affiliations (
  id              SERIAL PRIMARY KEY,
  member_id       INTEGER NOT NULL REFERENCES members(id),
  company_number  TEXT NOT NULL,        -- מספר חברה ברשם
  company_name    TEXT NOT NULL,
  role            TEXT NOT NULL,        -- 'director' | 'shareholder' | 'officer' | 'beneficiary'
  status          TEXT DEFAULT 'active', -- 'active' | 'inactive' | 'dissolved'
  start_date      DATE,
  end_date        DATE,
  source_url      TEXT,
  potential_conflict BOOLEAN DEFAULT FALSE,
  conflict_description TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, company_number, role)
);

CREATE INDEX idx_corporate_member ON member_corporate_affiliations(member_id);

-- קשרים עם לוביסטים
CREATE TABLE member_lobbyist_connections (
  id              SERIAL PRIMARY KEY,
  member_id       INTEGER NOT NULL REFERENCES members(id),
  lobbyist_name   TEXT NOT NULL,
  lobbyist_number TEXT,                  -- מספר רשם
  client_name     TEXT,                  -- לקוח הלוביסט
  connection_type TEXT NOT NULL,         -- 'meeting' | 'committee_attendance' | 'registered_contact'
  event_date      DATE,
  source_url      TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, lobbyist_name, event_date)
);

CREATE INDEX idx_lobbyist_member ON member_lobbyist_connections(member_id);

-- ציון יושרה מחושב (Integrity Score) — אגרגציה
CREATE TABLE member_integrity_scores (
  id              SERIAL PRIMARY KEY,
  member_id       INTEGER NOT NULL REFERENCES members(id) UNIQUE,

  -- ציונים לפי קטגוריה (0-100, גבוה = טוב יותר)
  ethics_score    REAL,          -- ועדת אתיקה
  legal_score     REAL,          -- הליכים משפטיים
  transparency_score REAL,       -- שקיפות והצהרות הון
  conflict_score  REAL,          -- ניגודי עניינים
  attendance_score REAL,         -- נוכחות והשתתפות (from existing data)

  overall_score   REAL,          -- ציון משוקלל כולל

  -- מטא-דאטה
  total_cases     INTEGER DEFAULT 0,
  open_cases      INTEGER DEFAULT 0,
  serious_cases   INTEGER DEFAULT 0,
  last_case_date  DATE,

  calculated_at   TIMESTAMPTZ DEFAULT NOW(),
  methodology_version TEXT DEFAULT 'v1.0'
);

-- לוג סנכרון מקורות יושרה
-- (משתמש ב-syncLog הקיים עם entity חדש)
```

### 3.2 Drizzle ORM Schema Extension

```typescript
// src/lib/db/schema/integrity.ts

import {
  pgTable,
  serial,
  integer,
  text,
  date,
  boolean,
  real,
  numeric,
  jsonb,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { members } from './members';

export const integrityCases = pgTable('integrity_cases', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .notNull()
    .references(() => members.id),
  category: text('category').notNull(),
  severity: text('severity').notNull().default('info'),
  status: text('status').notNull().default('reported'),
  title: text('title').notNull(),
  titleEn: text('title_en'),
  description: text('description'),
  descriptionEn: text('description_en'),
  sourceType: text('source_type').notNull(),
  sourceName: text('source_name').notNull(),
  sourceUrl: text('source_url'),
  sourceDocId: text('source_doc_id'),
  eventDate: date('event_date').notNull(),
  reportedDate: date('reported_date'),
  resolutionDate: date('resolution_date'),
  decision: text('decision'),
  sanctionType: text('sanction_type'),
  financialAmount: numeric('financial_amount'),
  metadata: jsonb('metadata').default({}),
  aiSummary: text('ai_summary'),
  aiConfidence: real('ai_confidence'),
  verified: boolean('verified').default(false),
  verifiedBy: text('verified_by'),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ... additional table definitions ...
```

---

## 4. אסטרטגיית איסוף נתונים (Data Pipeline)

### 4.1 Phase 1 — נתוני כנסת (OData)

```
Pipeline: sync-integrity-knesset
Schedule: כל 12 שעות
Sources: Knesset OData API

Steps:
1. זיהוי ועדת האתיקה (KNS_Committee WHERE TypeDesc = 'ועדת האתיקה')
2. שליפת ישיבות הוועדה (KNS_CommitteeSession)
3. הורדת פרוטוקולים (document links)
4. עיבוד AI: חילוץ שמות ח"כים + סוג תלונה + החלטה מפרוטוקולים
5. שליפת בקשות הסרת חסינות דרך ועדת הכנסת
6. Upsert ל-integrity_cases
```

### 4.2 Phase 2 — מבקר המדינה

```
Pipeline: sync-integrity-comptroller
Schedule: שבועי (ראשון 03:00)
Source: library.mevaker.gov.il

Steps:
1. סריקת דוחות חדשים (RSS/API)
2. הורדת דוחות PDF/HTML
3. עיבוד AI: זיהוי אזכורים של ח"כים/שרים
4. סיווג ממצאים לפי חומרה
5. Upsert ל-integrity_cases
```

### 4.3 Phase 3 — רשמים ממשלתיים

```
Pipeline: sync-integrity-registries
Schedule: שבועי (שלישי 03:00)
Sources: רשם החברות, רשם הלוביסטים, data.gov.il

Steps:
1. רשם החברות: חיפוש שמות ח"כים → בעלויות/דירקטוריונים
2. רשם הלוביסטים: מיפוי קשרים ח"כ–לוביסט (Open Knesset CSV)
3. רשמים ממשלתיים נוספים (קבלנים, רו"ח, וכו'): חיפוש ממוקד
4. Upsert ל-member_corporate_affiliations + member_lobbyist_connections
```

### 4.4 Phase 4 — מערכת המשפט

```
Pipeline: sync-integrity-legal
Schedule: יומי (05:00)
Sources: הרשות השופטת, מאגרי פסיקה

Steps:
1. חיפוש פסקי דין הכוללים שמות ח"כים/שרים
2. סיווג: פלילי / אזרחי / מנהלי
3. חילוץ: כתב אישום, הרשעה, זיכוי, גזר דין
4. Upsert ל-integrity_cases
```

### 4.5 תרשים זרימה (Pipeline Flow)

```
┌─────────────────────────────────────────────────────────────┐
│                    Data Source Layer                         │
├──────────┬──────────┬───────────┬──────────┬───────────────┤
│ Knesset  │ State    │ Companies │ Courts   │ Lobbyist     │
│ OData    │ Comptr.  │ Registrar │ (Nevo)   │ Registry     │
│ Ethics + │ Reports  │ Directors │ Rulings  │ OKnesset CSV │
│ Immunity │ PDF/HTML │ Officers  │ Indict.  │              │
└────┬─────┴────┬─────┴─────┬─────┴────┬─────┴──────┬───────┘
     │          │           │          │            │
     ▼          ▼           ▼          ▼            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Processing Layer                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │ Protocol    │  │ Report NLP   │  │ Name Matching &    │ │
│  │ Parser      │  │ (AI Extract) │  │ Entity Resolution  │ │
│  │ (AI/Regex)  │  │              │  │                    │ │
│  └──────┬──────┘  └──────┬───────┘  └─────────┬──────────┘ │
│         │                │                     │            │
│         ▼                ▼                     ▼            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Normalization & Deduplication              │   │
│  │  • category assignment  • severity classification   │   │
│  │  • member ID resolution • timeline ordering         │   │
│  └───────────────────────┬──────────────────────────────┘   │
└──────────────────────────┼──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Storage Layer                            │
├─────────────────────────────────────────────────────────────┤
│  integrity_cases │ integrity_documents │ member_corporate_  │
│                  │                     │ affiliations       │
│  integrity_case_ │ member_lobbyist_   │ member_integrity_  │
│  links           │ connections         │ scores             │
└──────────────────┴─────────────────────┴────────────────────┘
```

---

## 5. ממשק משתמש (UI/UX Design)

### 5.1 כרטיס יושרה בפרופיל חבר כנסת

מיקום: טאב חדש **"יושרה ואתיקה"** בדף הפרופיל של חבר הכנסת, לצד הטאבים הקיימים (הצבעות, הצעות חוק, ועדות).

```
┌────────────────────────────────────────────────────────────────────┐
│  📊 [הצבעות]  📜 [הצעות חוק]  🏛 [ועדות]  ⚖️ [יושרה ואתיקה]   │
└────────────────────────────────────────────────────────────────────┘
```

### 5.2 סקירה כללית (Overview Card)

```
┌────────────────────────────────────────────────────────────────────┐
│  ⚖️ מדד יושרה                                                    │
│                                                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│  │  אתיקה   │ │  משפטי   │ │ שקיפות   │ │ ניגודי   │             │
│  │  ██████░░ │ │ ████████ │ │ █████░░░ │ │ ███████░ │             │
│  │   75%     │ │  100%    │ │   63%    │ │   88%    │             │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘             │
│                                                                    │
│  ציון כולל: 82/100                 סה"כ אירועים: 3               │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ ████████████████████████████████████░░░░░░░░░░░░░░░░░░░░░░ │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ℹ️ הציון מבוסס על נתונים פומביים ממקורות רשמיים בלבד.           │
│     אין בציון כדי להוות חוות דעת או פסיקה.                        │
└────────────────────────────────────────────────────────────────────┘
```

### 5.3 ציר זמן אירועים (Timeline)

```
┌────────────────────────────────────────────────────────────────────┐
│  📅 ציר זמן — אירועי יושרה                                       │
│                                                                    │
│  ● 2024-03-27  ⚠️ סנקציה רגולטורית                     [חמור]    │
│  │  רשם הקבלנים: השעיית רישיון ל-3 שנים + קנס 41,816 ₪          │
│  │  📎 החלטת רשם הקבלנים    🔗 מקור                              │
│  │                                                                 │
│  ● 2024-03-27  📋 תלונה לוועדת האתיקה                  [בבירור]  │
│  │  קובלנה מארגוני עובדים בנושא השכרת רישיון קבלן               │
│  │  📎 מכתב לוועדת האתיקה   🔗 מקור                              │
│  │                                                                 │
│  ● 2023-XX-XX  🔍 חקירה                                 [נסגר]   │
│  │  צו הפסקת עבודות מרשם הקבלנים — פרויקט תמ"א 38 ת"א          │
│  │  📎 צו הפסקת עבודה       🔗 מקור                              │
│                                                                    │
│  [הצג עוד ▼]                                                      │
└────────────────────────────────────────────────────────────────────┘
```

### 5.4 פילטרים וסינון

```
┌────────────────────────────────────────────────────────┐
│  סינון:                                                │
│  [קטגוריה ▼] [חומרה ▼] [סטטוס ▼] [תקופה ▼]          │
│                                                        │
│  קטגוריות:                                             │
│  ☑ תלונות אתיקה      ☑ הסרת חסינות                    │
│  ☑ הליכים פליליים     ☑ ממצאי מבקר המדינה             │
│  ☑ ניגודי עניינים     ☑ סנקציות רגולטוריות             │
│  ☑ קשרי לוביסטים      ☑ הצהרות הון                     │
└────────────────────────────────────────────────────────┘
```

### 5.5 זיהויים עסקיים (Corporate Affiliations Card)

```
┌────────────────────────────────────────────────────────────────────┐
│  🏢 זיהויים עסקיים                                               │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  חברה: ואטורי בנייה בע"מ  │  ח.פ.: 51-XXXXXX-X           │  │
│  │  תפקיד: בעלים + דירקטור   │  סטטוס: פעילה                 │  │
│  │  ⚠️ ניגוד עניינים פוטנציאלי: רישיון קבלן + חבר כנסת       │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  קשרי לוביסטים: 2 מפגשים מתועדים                                 │
│  └─ לוביסט א' (לקוח: חברת בנייה X) — 15.01.2024                  │
│  └─ לוביסט ב' (לקוח: איגוד קבלנים) — 03.02.2024                  │
└────────────────────────────────────────────────────────────────────┘
```

### 5.6 הערות חשובות ב-UI

- **Disclaimer** קבוע בראש הדף: "המידע המוצג מבוסס על מקורות רשמיים פומביים. אין בהצגתו כדי להוות פסיקה, חוות דעת משפטית, או קביעה בדבר אשמה."
- כל פריט מידע מקושר למקור המקורי (source URL)
- סימון ברור: ✅ אומת / 🤖 זוהה אוטומטית / ⏳ בבדיקה
- תמיכה מלאה ב-RTL/LTR וב-4 שפות (he, en, ar, ru)
- מצב כהה (dark mode) מלא

---

## 6. API Design (tRPC Router)

### 6.1 Router: `integrity`

```typescript
// src/server/routers/integrity.ts

export const integrityRouter = router({
  // שליפת אירועי יושרה של חבר כנסת
  getCases: publicProcedure
    .input(
      z.object({
        memberId: z.number(),
        category: z.enum([...categories]).optional(),
        severity: z.enum(['info', 'warning', 'serious', 'critical']).optional(),
        status: z.enum([...statuses]).optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(50).default(20),
      }),
    )
    .query(async ({ input }) => {
      /* ... */
    }),

  // שליפת ציון יושרה
  getScore: publicProcedure
    .input(z.object({ memberId: z.number() }))
    .query(async ({ input }) => {
      /* ... */
    }),

  // שליפת זיהויים עסקיים
  getCorporateAffiliations: publicProcedure
    .input(z.object({ memberId: z.number() }))
    .query(async ({ input }) => {
      /* ... */
    }),

  // שליפת קשרי לוביסטים
  getLobbyistConnections: publicProcedure
    .input(z.object({ memberId: z.number() }))
    .query(async ({ input }) => {
      /* ... */
    }),

  // סטטיסטיקות כלליות (for dashboard)
  getOverallStats: publicProcedure.query(async () => {
    /* ... */
  }),

  // השוואת ציוני יושרה בין חברי כנסת
  compareScores: publicProcedure
    .input(
      z.object({
        memberIds: z.array(z.number()).min(2).max(10),
      }),
    )
    .query(async ({ input }) => {
      /* ... */
    }),
});
```

---

## 7. AI Integration

### 7.0 AI Provider — Anthropic Claude with Custom Skills

> **Decision**: For all integrity-related AI analysis, we use **Anthropic Claude**
> (via `@ai-sdk/anthropic` Vercel AI SDK adapter) with **Claude Skills** —
> custom, reusable instruction sets hosted at `claude.com/skills`.
> This is separate from the project's default Gemini provider used for
> general AI features (chat, bill summaries).

**Why Claude for integrity analysis?**

- Superior Hebrew language understanding for legal/parliamentary documents
- Claude Skills allow creating reusable, versioned analysis capabilities
- Structured output with high reliability for JSON extraction
- Strong safety guardrails for sensitive legal/ethical data

**Architecture:**

```
appConfig.integrity.ai.provider = 'anthropic'
appConfig.integrity.ai.model = 'claude-sonnet-4-20250514'

src/lib/ai/integrity/provider.ts  → dedicated Anthropic provider
src/lib/ai/integrity/skills/       → Claude Skill definitions (system prompts)
```

Each skill is a structured system prompt that defines Claude's behavior
for a specific extraction task. Skills are versioned and can be updated
independently.

### 7.1 Protocol Parser (חילוץ מפרוטוקולים)

```typescript
// src/lib/ai/integrity/skills/protocol-parser.ts
// Claude Skill: Ethics Committee Protocol Analyzer

export const PROTOCOL_PARSER_SKILL = `
<skill name="knesset-ethics-protocol-parser" version="1.0">
<purpose>
You analyze protocols (פרוטוקולים) from the Knesset Ethics Committee (ועדת האתיקה).
Your task is to extract structured factual information from Hebrew-language
parliamentary documents.
</purpose>

<instructions>
1. Identify all Knesset Members (ח"כ) discussed in the protocol
2. For each member mentioned in a complaint context, extract:
   - Full name (Hebrew)
   - Type of complaint/issue
   - Decision made (if any)
   - Sanction severity (if imposed)
   - Relevant dates
3. Return ONLY factual information present in the text
4. Never infer, assume, or editorialize
5. If information is unclear, return null for that field
6. Distinguish between complainant, respondent, and witnesses
</instructions>

<output_format>
Return a JSON array of extracted cases. Each case:
{
  "memberName": string,
  "complaintType": string,
  "decision": string | null,
  "sanctionType": string | null,
  "sanctionDetails": string | null,
  "eventDate": string | null,  // ISO date
  "severity": "info" | "warning" | "serious" | "critical",
  "status": "reported" | "under_investigation" | "decided" | "closed",
  "summary": string  // 1-2 sentence factual summary in Hebrew
}
</output_format>
</skill>
`;
```

### 7.2 Comptroller Report Analyzer

```typescript
// src/lib/ai/integrity/skills/comptroller-analyzer.ts
// Claude Skill: State Comptroller Report Analyzer

export const COMPTROLLER_ANALYZER_SKILL = `
<skill name="knesset-comptroller-analyzer" version="1.0">
<purpose>
You analyze State Comptroller reports (דוחות מבקר המדינה) to identify
findings related to Knesset Members and government ministers.
</purpose>

<instructions>
1. Identify mentions of MKs, ministers, and senior public officials
2. For each person-related finding, extract:
   - Name and role at time of finding
   - Description of the issue/finding
   - Comptroller's recommendation
   - Severity level
3. Only extract specific findings, not general policy discussions
4. Do not classify mentions that are neutral (e.g., "Minister X attended")
5. Focus on: mismanagement, ethical violations, regulatory failures,
   budget irregularities, conflicts of interest
</instructions>

<output_format>
Return JSON array of findings:
{
  "officialName": string,
  "role": string,
  "findingDescription": string,
  "recommendation": string | null,
  "severity": "info" | "warning" | "serious" | "critical",
  "summary": string
}
</output_format>
</skill>
`;
```

### 7.3 Integrity Score Calculator

> **DEFERRED** — Scoring formula is deferred to a future phase. The current
> implementation focuses on presenting factual data without computing a
> single numeric score. A weighted scoring system is too simplistic to
> capture the nuance of ethical/legal situations and risks oversimplification.
> The `member_integrity_scores` table is **not created** in this phase.

---

## 8. תכנית יישום (Implementation Roadmap)

### Phase 1: Foundation (שבועות 1-3)

| שבוע | משימה                                     | תלויות               |
| ---- | ----------------------------------------- | -------------------- |
| 1    | DB schema + Drizzle migration             | —                    |
| 1    | tRPC router skeleton (integrity)          | schema               |
| 1    | i18n keys (he, en, ar, ru)                | —                    |
| 2    | Sync pipeline: ethics committee protocols | OData client         |
| 2    | AI protocol parser (Gemini)               | AI provider          |
| 2    | Basic timeline component                  | tRPC router          |
| 3    | Integrity tab on member profile page      | timeline component   |
| 3    | Score calculation engine (v1.0)           | integrity_cases data |
| 3    | Integrity score card component            | score engine         |

### Phase 2: Expand Sources (שבועות 4-6)

| שבוע | משימה                                 | תלויות          |
| ---- | ------------------------------------- | --------------- |
| 4    | Comptroller report scraper/parser     | —               |
| 4    | AI comptroller analyzer               | AI provider     |
| 4    | Immunity request detection pipeline   | OData           |
| 5    | Lobbyist registry sync (OKnesset CSV) | OKnesset client |
| 5    | Companies registrar integration       | ICA API         |
| 5    | Corporate affiliations card UI        | tRPC router     |
| 6    | Lobbyist connections card UI          | tRPC router     |
| 6    | Filters & sorting UI                  | all data        |
| 6    | Mobile responsive design              | UI components   |

### Phase 3: Legal & Advanced (שבועות 7-9)

| שבוע | משימה                                        | תלויות          |
| ---- | -------------------------------------------- | --------------- |
| 7    | Court rulings integration (public sources)   | legal API       |
| 7    | AI legal case classifier                     | AI provider     |
| 7    | Case linking engine (connect related events) | integrity_cases |
| 8    | Financial disclosures parser                 | Knesset PDFs    |
| 8    | Comparison view (multiple MKs)               | score engine    |
| 8    | Dashboard integration (overall stats)        | all data        |
| 9    | Comprehensive testing                        | all             |
| 9    | Performance optimization (Redis cache)       | cache layer     |
| 9    | Disclaimer & legal review                    | —               |

### Phase 4: Intelligence & Polish (שבועות 10-12)

| שבוע | משימה                                  | תלויות              |
| ---- | -------------------------------------- | ------------------- |
| 10   | AI-powered integrity summary per MK    | RAG pipeline        |
| 10   | Trend analysis (integrity over time)   | historical data     |
| 10   | Email/push notifications for new cases | notification system |
| 11   | Data verification workflow (admin)     | admin panel         |
| 11   | Public API for researchers             | tRPC                |
| 11   | Accessibility audit (WCAG 2.1 AA)      | all UI              |
| 12   | Final QA & launch                      | —                   |
| 12   | Documentation & user guide             | —                   |

---

## 9. שיקולים משפטיים ואתיים

### 9.1 עקרונות יסוד

1. **רק מידע פומבי** — כל המידע המוצג חייב להיות ממקורות פומביים רשמיים. אין שימוש במידע מסווג, חסוי, או שהושג שלא כדין.

2. **ללא פרשנות** — הפלטפורמה מציגה עובדות בלבד. אין ניתוח מגמתי, אין חוות דעת, אין קביעת אשמה.

3. **זכות תגובה** — מנגנון שמאפשר לחברי כנסת/שריהם לשלוח תגובה שתוצג לצד הממצאים.

4. **דיוק ואימות** — כל פריט מידע מסומן כ"אומת" או "אוטומטי". מנגנון דיווח טעויות.

5. **חזקת חפות** — הליכים שלא הסתיימו מסומנים בבירור כ"פתוח" / "בבירור". אין הצגה של "אשם" לפני הרשעה חלוטה.

### 9.2 הגנות משפטיות

- **דיסקליימר** בכל דף: הבהרה שהמידע מקורו בפרסומים רשמיים פומביים
- **הגנת אמת בפרסום** (סעיף 14 לחוק איסור לשון הרע): כל מידע מבוסס על מקורות מוסמכים
- **עניין ציבורי** (סעיף 15(4)): נבחרי ציבור — עניין ציבורי מובהק
- **GDPR/Privacy**: מידע על נבחרי ציבור בכובעם הציבורי — לא מידע פרטי
- **Terms of Service** ברור לרשמים/APIs — שימוש במסגרת הרשאה

### 9.3 Moderation & Quality

- Manual verification queue for AI-extracted data
- Confidence threshold: AI-extracted data with <70% confidence goes to review queue
- Community reporting mechanism for inaccuracies
- Periodic audit of all integrity data by editorial team

---

## 10. קבצים חדשים (File Structure)

```
src/
├── lib/
│   ├── db/
│   │   └── schema/
│   │       └── integrity.ts           # Drizzle schema definitions
│   ├── ai/
│   │   └── integrity/
│   │       ├── protocol-parser.ts      # Ethics committee protocol AI parser
│   │       ├── comptroller-analyzer.ts # State comptroller report analyzer
│   │       ├── legal-classifier.ts     # Court ruling classifier
│   │       └── score-calculator.ts     # Integrity score computation
│   └── knesset/
│       └── integrity-sources.ts        # Registry API clients (companies, contractors, etc.)
├── pipeline/
│   └── jobs/
│       ├── sync-integrity-knesset.ts   # Ethics committee + immunity sync
│       ├── sync-integrity-comptroller.ts # State comptroller reports
│       ├── sync-integrity-registries.ts  # Companies/lobbyists/regulators
│       └── sync-integrity-legal.ts     # Court rulings
├── server/
│   └── routers/
│       └── integrity.ts                # tRPC router
├── components/
│   └── integrity/
│       ├── IntegrityTab.tsx            # Main tab wrapper
│       ├── IntegrityScoreCard.tsx      # Score overview card
│       ├── IntegrityTimeline.tsx       # Event timeline
│       ├── IntegrityCaseCard.tsx       # Individual case display
│       ├── CorporateAffiliations.tsx   # Business connections card
│       ├── LobbyistConnections.tsx     # Lobbyist relationships card
│       ├── IntegrityFilters.tsx        # Category/severity/status filters
│       ├── IntegrityComparison.tsx     # Compare multiple MKs
│       └── IntegrityDisclaimer.tsx     # Legal disclaimer component
├── app/
│   └── [locale]/
│       └── (public)/
│           └── members/
│               └── [id]/
│                   └── integrity/
│                       └── page.tsx    # Dedicated integrity sub-page (or tab)
└── i18n/
    └── messages/
        ├── he.json  # + integrity.* keys
        ├── en.json  # + integrity.* keys
        ├── ar.json  # + integrity.* keys
        └── ru.json  # + integrity.* keys
```

---

## 11. מפתחות i18n

```json
{
  "integrity": {
    "title": "יושרה ואתיקה",
    "score": {
      "title": "מדד יושרה",
      "overall": "ציון כולל",
      "ethics": "אתיקה",
      "legal": "משפטי",
      "transparency": "שקיפות",
      "conflicts": "ניגודי עניינים",
      "attendance": "נוכחות"
    },
    "timeline": {
      "title": "ציר זמן — אירועי יושרה",
      "showMore": "הצג עוד",
      "noEvents": "לא נמצאו אירועים"
    },
    "categories": {
      "ethics_complaint": "תלונה לוועדת האתיקה",
      "immunity_request": "בקשת הסרת חסינות",
      "criminal_indictment": "כתב אישום",
      "criminal_conviction": "הרשעה",
      "comptroller_finding": "ממצאי מבקר המדינה",
      "conflict_of_interest": "ניגוד עניינים",
      "regulatory_sanction": "סנקציה רגולטורית",
      "disciplinary_action": "הליך משמעתי",
      "financial_disclosure_issue": "בעיה בהצהרת הון"
    },
    "severity": {
      "info": "מידע",
      "warning": "אזהרה",
      "serious": "חמור",
      "critical": "קריטי"
    },
    "status": {
      "reported": "דווח",
      "under_investigation": "בחקירה",
      "decided": "הוחלט",
      "appealed": "בערעור",
      "closed": "נסגר",
      "convicted": "הורשע",
      "acquitted": "זוכה",
      "sanctions_applied": "הוטלו סנקציות"
    },
    "corporate": {
      "title": "זיהויים עסקיים",
      "companyName": "שם חברה",
      "role": "תפקיד",
      "potentialConflict": "ניגוד עניינים פוטנציאלי"
    },
    "lobbyist": {
      "title": "קשרי לוביסטים",
      "meetings": "מפגשים מתועדים"
    },
    "source": "מקור",
    "sourceDocument": "מסמך מקורי",
    "verified": "אומת",
    "automatic": "זוהה אוטומטית",
    "underReview": "בבדיקה",
    "disclaimer": "המידע המוצג מבוסס על מקורות רשמיים פומביים. אין בהצגתו כדי להוות פסיקה, חוות דעת משפטית, או קביעה בדבר אשמה. כל אדם חף מפשע עד שהוכח אחרת.",
    "filters": {
      "category": "קטגוריה",
      "severity": "חומרה",
      "status": "סטטוס",
      "period": "תקופה"
    },
    "comparison": {
      "title": "השוואת ציוני יושרה",
      "selectMembers": "בחר חברי כנסת להשוואה"
    }
  }
}
```

---

## 12. Configuration (app.config.ts additions)

```typescript
integrity: {
  syncSchedule: {
    knesset: env.INTEGRITY_SYNC_KNESSET_CRON ?? '0 */12 * * *',       // כל 12 שעות
    comptroller: env.INTEGRITY_SYNC_COMPTROLLER_CRON ?? '0 3 * * 0',   // ראשון 03:00
    registries: env.INTEGRITY_SYNC_REGISTRIES_CRON ?? '0 3 * * 2',     // שלישי 03:00
    legal: env.INTEGRITY_SYNC_LEGAL_CRON ?? '0 5 * * *',              // יומי 05:00
  },
  scoring: {
    ethicsWeight: 0.30,
    legalWeight: 0.30,
    transparencyWeight: 0.15,
    conflictWeight: 0.15,
    attendanceWeight: 0.10,
  },
  ai: {
    confidenceThreshold: 0.70,        // מתחת — נשלח לבדיקה ידנית
    protocolParserModel: 'gemini',
    comptrollerAnalyzerModel: 'gemini',
  },
  cache: {
    scoreTtl: 3600,                   // שעה
    casesTtl: 1800,                   // 30 דקות
  },
  sources: {
    knessetOData: 'https://knesset.gov.il/Odata/ParliamentInfo.svc',
    comptrollerLibrary: 'https://library.mevaker.gov.il',
    companiesRegistrar: 'https://ica.justice.gov.il',
    oknessetLobbyists: 'lobbyists/v_lobbyist',
    oknessetLobbyistClients: 'lobbyists/v_lobbyist_clients',
  },
},
```

---

## 13. Security & Privacy Considerations

| Concern              | Mitigation                                                                    |
| -------------------- | ----------------------------------------------------------------------------- |
| Defamation liability | Only official public sources; clear disclaimer; right of response             |
| Data accuracy        | AI confidence scoring; manual verification queue; correction mechanism        |
| Scraping legality    | Respect robots.txt; official APIs preferred; proper rate limiting             |
| Personal data        | Only public-capacity data about public officials; no private life information |
| Bias                 | Transparent methodology; open-source scoring formula; no editorial opinion    |
| Political abuse      | Equal treatment for all MKs; automated scoring (no manual overrides)          |
| API abuse            | Rate limiting via Upstash Redis; caching with TTL                             |

---

## 14. KPIs & Success Metrics

| Metric              | Target                                   |
| ------------------- | ---------------------------------------- |
| מספר מקורות משולבים | ≥ 5 מקורות רשמיים                        |
| כיסוי ח"כים         | 100% ח"כים פעילים + ≥ 80% ח"כי עבר       |
| דיוק AI extraction  | ≥ 85% precision (verified sample)        |
| זמן עדכון           | < 24 שעות מפרסום רשמי                    |
| שימוש               | ≥ 30% מביקורי פרופיל צופים את טאב היושרה |
| דיווחי טעויות       | < 5% מהפריטים מדווחים כשגויים            |
| נגישות              | WCAG 2.1 AA compliance                   |
