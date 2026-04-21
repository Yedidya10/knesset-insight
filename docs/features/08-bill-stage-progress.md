# 08 — שלבי חוק מקובצים עם רכיב התקדמות מודרני

## 1. רקע ומטרה

כיום, דף פירוט הצעת חוק מציג סטטוס בודד כ-Badge מנותק — ללא הקשר לשלבים הקודמים או הבאים בתהליך החקיקה. המשתמש לא רואה את **מסע החוק** מהגשה ועד אישור.

**המטרה**: לבנות רכיב progress מודרני שמציג את שלבי החקיקה כקבוצה ויזואלית, כולל טיפול ב:

- מסלולים שונים (הצעת חוק פרטית vs ממשלתית)
- חוקים שמוזגו (union) או פוצלו (split)
- דין רציפות (continuity law)
- חוקים שנעצרו או הוסבו

---

## 2. מיפוי מקורות נתונים מה-OData API

### 2.1 טבלאות OData רלוונטיות

| Entity                     | תיאור            | שדות מרכזיים                                                                                        |
| -------------------------- | ---------------- | --------------------------------------------------------------------------------------------------- |
| `KNS_Bill`                 | הצעת חוק         | `BillID`, `StatusID`, `SubTypeID`, `SubTypeDesc`, `KnessetNum`, `IsContinuationBill`, `CommitteeID` |
| `KNS_BillUnion`            | מיזוג חוקים      | `BillUnionID`, `MainBillID`, `UnionBillID`                                                          |
| `KNS_BillSplit`            | פיצול חוקים      | `BillSplitID`, `MainBillID`, `SplitBillID`, `Name`                                                  |
| `KNS_BillName`             | היסטוריית שמות   | `BillNameID`, `BillID`, `Name`, `NameHistoryTypeID`, `NameHistoryTypeDesc`                          |
| `KNS_BillHistoryInitiator` | היסטוריית יוזמים | `BillHistoryInitiatorID`, `BillID`, `PersonID`, `StartDate`, `EndDate`, `ReasonID`, `ReasonDesc`    |
| `KNS_DocumentBill`         | מסמכים מקושרים   | `DocumentBillID`, `BillID`, `GroupTypeID`, `GroupTypeDesc`, `FilePath`                              |
| `KNS_Status` (TypeID=2)    | טבלת סטטוסים     | `StatusID`, `Desc`, `IsActive`, `OrderTransition`                                                   |

### 2.2 SubTypeID — סוגי הצעות חוק

| SubTypeID | SubTypeDesc | משמעות                         |
| --------- | ----------- | ------------------------------ |
| 53        | ממשלתית     | הצעת חוק ממשלתית — מסלול מקוצר |
| 54        | פרטית       | הצעת חוק פרטית — מסלול מלא     |
| 55        | ועדה        | הצעת חוק של ועדה               |

### 2.3 BillName — NameHistoryTypeDesc (סוגי שינוי שם)

| NameHistoryTypeID | NameHistoryTypeDesc | משמעות                     |
| ----------------- | ------------------- | -------------------------- |
| 5201              | בקריאה הראשונה      | שם כפי שהוגש בקריאה ראשונה |
| 5204              | תיקון טעות          | שם תוקן                    |
| 10062             | לחוק שהתקבל         | שם החוק הסופי שהתקבל       |

---

## 3. מיפוי שלבי החקיקה (Legislative Stage Model)

### 3.1 המסלול הקנוני (Canonical Pipeline)

התהליך החקיקתי בכנסת מורכב מ-**7 שלבים עיקריים** (stages), כאשר כל שלב מכיל תת-סטטוסים (statuses):

```
┌─────────────────────────────────────────────────────────────────┐
│ Stage 0: הגשה                                                    │
│ Stage 1: דיון מוקדם במליאה (קריאה טרומית) *פרטית בלבד*          │
│ Stage 2: ועדה — הכנה לקריאה ראשונה                               │
│ Stage 3: קריאה ראשונה במליאה                                      │
│ Stage 4: ועדה — הכנה לקריאה שנייה ושלישית                        │
│ Stage 5: קריאה שנייה ושלישית במליאה                               │
│ Stage 6: החוק התקבל ✓                                            │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 מיפוי StatusID → Stage

```typescript
enum BillStage {
  SUBMITTED = 0, // הגשה
  PRELIMINARY = 1, // דיון מוקדם (קריאה טרומית)
  COMMITTEE_FIRST = 2, // ועדה — הכנה לקריאה ראשונה
  FIRST_READING = 3, // קריאה ראשונה במליאה
  COMMITTEE_SECOND = 4, // ועדה — הכנה לקריאה שנייה ושלישית
  SECOND_THIRD_READING = 5, // קריאה שנייה ושלישית במליאה
  PASSED = 6, // התקבלה ✓
}
```

| Stage                         | StatusIDs                                | תיאור                                               |
| ----------------------------- | ---------------------------------------- | --------------------------------------------------- |
| 0 (הגשה)                      | `104`, `141`, `130`, `131`               | הונחה על שולחן הכנסת                                |
| 1 (דיון מוקדם)                | `150`                                    | במליאה לדיון מוקדם                                  |
| 2 (ועדה — קריאה ראשונה)       | `106`, `142`, `101`, `108`, `109`, `167` | בוועדה/אושרה בוועדה לקריאה ראשונה                   |
| 3 (קריאה ראשונה)              | `111`                                    | לדיון במליאה לקראת הקריאה הראשונה                   |
| 4 (ועדה — קריאה שנייה-שלישית) | `113`, `178`, `179`, `115`               | הכנה/אושרה בוועדה לקריאה שנייה-שלישית, הוחזרה לועדה |
| 5 (קריאה שנייה-שלישית)        | `114`, `117`                             | לדיון במליאה לקראת קריאה שנייה-שלישית / שלישית      |
| 6 (התקבלה)                    | `118`                                    | התקבלה בקריאה שלישית                                |

### 3.3 סטטוסים מיוחדים (לא בתוך ה-pipeline הליניארי)

| סוג                 | StatusIDs                  | תיאור                               | טיפול ברכיב                         |
| ------------------- | -------------------------- | ----------------------------------- | ----------------------------------- |
| **מיזוג**           | `122`, `126`, `169`        | מוזגה / לאישור מיזוג                | Badge מיוחד + קישור לחוק המאחד      |
| **פיצול**           | `158`, `161`, `162`, `165` | לאישור פיצול במליאה                 | Badge מיוחד + קישורים לחוקים שפוצלו |
| **הסבה**            | `124`                      | הוסבה להצעה לסדר היום               | Badge מיוחד — יצאה מהפייפליין       |
| **עצירה**           | `177`                      | נעצרה                               | Badge "נעצרה" + סימון ויזואלי       |
| **דין רציפות**      | `120`, `175`, `176`, `181` | בקשה/דיון/אישור/דחייה של דין רציפות | תווית נוספת על ה-stage הרלוונטי     |
| **הסרה**            | `140`, `143`               | להסרה מסדר היום לבקשת ועדה          | Badge "הוסרה"                       |
| **דין רציפות נדחה** | `110`                      | הבקשה לדין רציפות נדחתה במליאה      | Badge "נדחה דין רציפות"             |

---

## 4. מסלולים שונים לפי סוג הצעה

### 4.1 הצעת חוק ממשלתית (SubTypeID=53)

מדלגת על שלב 1 (דיון מוקדם). המסלול:

```
הגשה → [ועדה: הכנה לקריאה ראשונה] → קריאה ראשונה → [ועדה: הכנה ל-2+3] → קריאה 2+3 → התקבלה
```

**5 שלבים בלבד** (0, 2, 3, 4, 5, 6) — שלב 1 מוסתר.

### 4.2 הצעת חוק פרטית (SubTypeID=54)

המסלול המלא:

```
הגשה → דיון מוקדם (קריאה טרומית) → [ועדה] → קריאה ראשונה → [ועדה] → קריאה 2+3 → התקבלה
```

**7 שלבים** (0–6).

### 4.3 הצעת חוק של ועדה (SubTypeID=55)

בדרך כלל מתחילה ישירות מהוועדה ומדלגת על קריאה טרומית. ממופה כמו ממשלתית.

---

## 5. מקרי קצה (Edge Cases) — ניתוח מעמיק

### 5.1 מיזוג (Union) — `KNS_BillUnion`

**מה קורה**: מספר הצעות חוק דומות מתמזגות לכדי הצעה אחת. ההצעה ה"מקבלת" (MainBill) ממשיכה, והמוזגות מקבלות StatusID=122.

**מבנה הנתונים**:

```
KNS_BillUnion {
  BillUnionID: number      // PK
  MainBillID: number       // ← החוק שממשיך (winner)
  UnionBillID: number      // ← החוק שנבלע (StatusID → 122)
}
```

**טיפול ברכיב**:

- בחוק שנבלע (122): הצג את ה-progress שהחוק עבר עד כה, עם Badge "מוזגה" + קישור: "מוזגה עם → [שם החוק המאחד]"
- בחוק המאחד (MainBill): הצג תווית "כולל מיזוג" עם רשימת החוקים שמוזגו אליו (כ-tooltip או expandable section)

### 5.2 פיצול (Split) — `KNS_BillSplit`

**מה קורה**: הצעת חוק גדולה מפוצלת למספר הצעות חוק עצמאיות. החוק המקורי ממשיך (או נסגר), והפיצולים הופכים לחוקים עצמאיים.

**מבנה הנתונים**:

```
KNS_BillSplit {
  BillSplitID: number      // PK
  MainBillID: number       // ← החוק המקורי שפוצל ממנו
  SplitBillID: number      // ← החוק החדש שנוצר מהפיצול
  Name: string             // שם החוק המפוצל
}
```

**דוגמה מהנתונים**: BillID 258446 פוצל ל-3 חוקים: 262881, 262882, 262883.

**טיפול ברכיב**:

- בחוק המקורי: הצג שלב "פוצל" עם קישורים לכל החוקים שנוצרו ממנו
- בחוק שנוצר מפיצול: הצג Badge "פוצל מ-" + קישור לחוק המקורי, ו-progress עצמאי מנקודת הפיצול

### 5.3 דין רציפות (Continuity Law)

**מה קורה**: הצעת חוק שהייתה בתהליך בכנסת קודמת ומבקשים להמשיך אותה בכנסת הנוכחית (במקום להתחיל מהתחלה).

**שדה**: `KNS_Bill.IsContinuationBill = true`

**טיפול ברכיב**:

- הצג Badge "דין רציפות" ליד ה-stage הנוכחי
- אם דין הרציפות **נדחה** (StatusID=110, 176) — Badge "דין רציפות נדחה" בצבע אדום + החוק נעצר
- אם אושר — החוק ממשיך מהשלב שבו הפסיק בכנסת הקודמת

### 5.4 חוק שנעצר (StatusID=177)

**טיפול**: הצג את ה-progress עד לנקודת העצירה, עם סימון ויזואלי ברור (גרדיאנט אפור / קו מחיקה) ו-Badge "נעצרה".

### 5.5 הסבה להצעה לסדר היום (StatusID=124)

**מה קורה**: הצעת חוק הומרה להצעה לסדר היום (נושא פחות מחייב). הצעת החוק מפסיקה להתקדם.

**טיפול**: progress קטוע + Badge "הוסבה להצעה לסדר היום".

### 5.6 חוק שחוזר מוועדה (StatusID=115)

**מה קורה**: חוק שכבר עבר קריאה שנייה-שלישית הוחזר לוועדה לתיקון לפני קריאה שלישית.

**טיפול**: ה-progress מראה את Stage 4 כפעיל שוב (animated "חזרה") + tooltip "הוחזר מהמליאה לוועדה".

### 5.7 שינוי שם בין קריאות (`KNS_BillName`)

**מה קורה**: שם הצעת החוק משתנה בין שלבי החקיקה (בקריאה ראשונה שם אחד, בסופו של דבר שם אחר).

**טיפול**: לכל stage שיש שם שונה, הצג tooltip עם השם שהיה באותו שלב.

### 5.8 החזרה לשלב קודם (Regression)

**מציאות**: החוק יכול "לרדת" שלב — למשל, מקריאה שנייה בחזרה לוועדה. ה-pipeline לא תמיד ליניארי.

**טיפול**: הרכיב צריך להיות מסוגל להציג stage מוקדם יותר כ-"active" גם אם stages מאוחרים יותר כבר הושלמו פעם.

---

## 6. סכימת בסיס הנתונים — טבלאות חדשות

### 6.1 `bill_unions` — מיזוגים

```sql
CREATE TABLE bill_unions (
  id              SERIAL PRIMARY KEY,
  knesset_id      INTEGER NOT NULL UNIQUE,    -- BillUnionID מ-OData
  main_bill_id    INTEGER NOT NULL REFERENCES bills(id),
  union_bill_id   INTEGER NOT NULL REFERENCES bills(id),
  last_updated    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_bill_unions_main_union ON bill_unions(main_bill_id, union_bill_id);
```

### 6.2 `bill_splits` — פיצולים

```sql
CREATE TABLE bill_splits (
  id              SERIAL PRIMARY KEY,
  knesset_id      INTEGER NOT NULL UNIQUE,    -- BillSplitID מ-OData
  main_bill_id    INTEGER NOT NULL REFERENCES bills(id),
  split_bill_id   INTEGER NOT NULL REFERENCES bills(id),
  name            TEXT,
  last_updated    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_bill_splits_main_split ON bill_splits(main_bill_id, split_bill_id);
```

### 6.3 `bill_names` — היסטוריית שמות

```sql
CREATE TABLE bill_names (
  id                      SERIAL PRIMARY KEY,
  knesset_id              INTEGER NOT NULL UNIQUE,      -- BillNameID מ-OData
  bill_id                 INTEGER NOT NULL REFERENCES bills(id),
  name                    TEXT NOT NULL,
  name_history_type_id    INTEGER,                      -- 5201, 5204, 10062...
  name_history_type_desc  TEXT,                         -- "בקריאה הראשונה", "לחוק שהתקבל"
  last_updated            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);
```

### 6.4 שינויים בטבלת `bills` הקיימת

```sql
ALTER TABLE bills ADD COLUMN sub_type_id INTEGER;           -- 53/54/55
ALTER TABLE bills ADD COLUMN is_continuation_bill BOOLEAN;  -- דין רציפות
ALTER TABLE bills ADD COLUMN committee_id INTEGER;          -- ועדה מטפלת
```

---

## 7. Sync Pipeline — Jobs חדשים

### 7.1 `sync-bill-unions.ts`

```
Source: KNS_BillUnion
Strategy: Incremental (LastUpdatedDate)
Maps: MainBillID → bills.knessetId, UnionBillID → bills.knessetId
Target: bill_unions
```

### 7.2 `sync-bill-splits.ts`

```
Source: KNS_BillSplit
Strategy: Incremental (LastUpdatedDate)
Maps: MainBillID → bills.knessetId, SplitBillID → bills.knessetId
Target: bill_splits
```

### 7.3 `sync-bill-names.ts`

```
Source: KNS_BillName
Strategy: Incremental (LastUpdatedDate)
Maps: BillID → bills.knessetId
Target: bill_names
```

### 7.4 עדכון `sync-bills.ts`

הוסף sync של שדות נוספים מ-`KNS_Bill`:

- `SubTypeID` → `bills.sub_type_id`
- `IsContinuationBill` → `bills.is_continuation_bill`
- `CommitteeID` → `bills.committee_id`

---

## 8. ארכיטקטורת רכיב ה-Progress (UI)

### 8.1 מבנה הרכיבים

```
BillProgressSection (Server Component)
├── BillStagePipeline          ← הרכיב המרכזי — שלבי progress
│   ├── BillStageNode          ← צומת (stage) בודד
│   └── BillStageConnector     ← הקו בין צמתים
├── BillRelationshipBanner     ← באנר למיזוג/פיצול/דין רציפות
│   ├── BillUnionBadge
│   ├── BillSplitBadge
│   └── BillContinuityBadge
└── BillStageDetails           ← פירוט כל stage (expand)
    ├── BillNameAtStage        ← שם החוק בשלב זה
    ├── BillVoteAtStage        ← הצבעה רלוונטית
    └── BillDocumentAtStage    ← מסמך רלוונטי
```

### 8.2 BillStagePipeline — העיצוב המודרני

**עיקרון**: רכיב אופקי (desktop) / אנכי (mobile), עם צמתים עגולים מחוברים בקו.

```
Desktop (LTR):
  ○──────●──────●──────◉──────○──────○──────○
  הגשה   דיון    ועדה   קריאה  ועדה    קריאה  התקבלה
         מוקדם          ראשונה         2+3

Desktop (RTL):
  ○──────○──────○──────◉──────●──────●──────○
  התקבלה  קריאה  ועדה   קריאה  ועדה   דיון   הגשה
          2+3          ראשונה         מוקדם

Legend:
  ● = הושלם (completed)
  ◉ = שלב נוכחי (current — pulsing/glow)
  ○ = עתידי (upcoming — dimmed)
```

**עיצוב**:

- הקו: gradient מירוק (completed) → כחול (current) → אפור (upcoming)
- הצמתים: עיגול עם אייקון (✓ = completed, ● = current, ○ = upcoming)
- טקסט מתחת לכל צומת: שם השלב
- Hover/click: פופאפ עם תאריך, הצבעות, מסמכים

**RTL תמיכה**: הכיוון מתהפך אוטומטית — הגשה מימין, התקבלה משמאל (ב-RTL).

### 8.3 מצבים מיוחדים

#### חוק מוזג (status=122)

```
  ●──────●──────●──╳
  הגשה   דיון   ועדה  [מוזגה →]
                       ↓
                   Link to MainBill
```

הקו "נשבר" וב-Banner מתחת מוצג: "מוזגה עם הצעת חוק [שם] →"

#### חוק מפוצל

```
  ●──────●──────●──────●──┬──(חוק א')
  הגשה   דיון   ועדה  קריאה ├──(חוק ב')
                    ראשונה └──(חוק ג')
```

אחרי נקודת הפיצול, מוצגים קישורים לחוקים שנוצרו.

#### חוק שנעצר (status=177)

```
  ●──────●──────●──────⊘
  הגשה   דיון   ועדה   נעצרה
```

הצמתים שאחרי נקודת העצירה מוצגים ב-strikethrough/muted.

#### דין רציפות

```
  [כנסת 24]
  ●──────●──────●─ ─ ─ → [כנסת 25: דין רציפות]
  הגשה   דיון   ועדה     ◉──────○──────○
                          ועדה   קריאה  התקבלה
```

קו מקווקו בין הכנסות + Badge "דין רציפות".

### 8.4 תגובתיות (Responsive)

| Breakpoint       | Layout                            |
| ---------------- | --------------------------------- |
| `>= lg` (1024px) | אופקי — צמתים בשורה               |
| `< lg`           | אנכי — צמתים בעמודה (מלמעלה למטה) |

### 8.5 נגישות (Accessibility)

- `role="progressbar"` עם `aria-valuenow` (stage נוכחי), `aria-valuemin=0`, `aria-valuemax=6`
- כל צומת: `aria-label` עם שם השלב + סטטוס ("הושלם" / "נוכחי" / "ממתין")
- צבעים: מינימום contrast ratio 4.5:1 (WCAG AA)
- מצב כהה (dark mode): גרדיאנטים מותאמים

---

## 9. tRPC — הרחבת ה-API

### 9.1 הרחבת `billsRouter.byId()`

```typescript
// הוספת שדות לתוצאה:
{
  // ...existing fields
  subTypeId: number | null,          // סוג ההצעה
  isContinuationBill: boolean | null,
  committeeId: number | null,

  // קשרים חדשים:
  unions: {
    id: number,
    mainBillId: number,
    mainBillName: string,        // שם החוק המאחד
    mainBillKnessetId: number,   // לקישור
  }[],
  splits: {
    id: number,
    splitBillId: number,
    splitBillName: string,       // שם החוק המפוצל
    splitBillKnessetId: number,  // לקישור
  }[],
  nameHistory: {
    name: string,
    typeDesc: string,            // "בקריאה הראשונה", "לחוק שהתקבל"
  }[],
}
```

### 9.2 פונקציית חישוב Stage

```typescript
function computeBillStage(
  statusId: string,
  subTypeId: number | null,
): {
  currentStage: BillStage;
  stages: StageInfo[]; // רשימת stages רלוונטיים (ללא דיון מוקדם אם ממשלתית)
  specialStatus: 'merged' | 'split' | 'stopped' | 'converted' | null;
};
```

---

## 10. i18n — מפתחות תרגום חדשים

```json
{
  "legislation": {
    "stages": {
      "submitted": "הגשה",
      "preliminary": "דיון מוקדם (קריאה טרומית)",
      "committeeFirst": "ועדה — הכנה לקריאה ראשונה",
      "firstReading": "קריאה ראשונה במליאה",
      "committeeSecond": "ועדה — הכנה לקריאה שנייה ושלישית",
      "secondThirdReading": "קריאה שנייה ושלישית במליאה",
      "passed": "התקבלה בקריאה שלישית",
      "completed": "הושלם",
      "current": "שלב נוכחי",
      "upcoming": "ממתין"
    },
    "special": {
      "merged": "מוזגה עם הצעת חוק אחרת",
      "mergedWith": "מוזגה עם",
      "includesMerge": "כולל מיזוג מ-",
      "split": "פוצלה",
      "splitFrom": "פוצלה מ-",
      "splitInto": "פוצלה ל-",
      "stopped": "נעצרה",
      "converted": "הוסבה להצעה לסדר היום",
      "continuity": "דין רציפות",
      "continuityRejected": "דין רציפות נדחה",
      "returnedToCommittee": "הוחזרה לוועדה",
      "removedFromAgenda": "הוסרה מסדר היום"
    },
    "billType": {
      "government": "ממשלתית",
      "private": "פרטית",
      "committee": "ועדה"
    }
  }
}
```

---

## 11. תכנית יישום (שלבי עבודה)

### Phase 1: Data Layer (Backend)

1. **Schema migration** — הוספת עמודות ל-`bills` + טבלאות חדשות (`bill_unions`, `bill_splits`, `bill_names`)
2. **Sync jobs** — `sync-bill-unions.ts`, `sync-bill-splits.ts`, `sync-bill-names.ts`
3. **עדכון sync-bills.ts** — sync שדות SubTypeID, IsContinuationBill, CommitteeID
4. **הרצת sync** — למלא את הנתונים החדשים

### Phase 2: Business Logic

5. **`bill-stages.ts`** — לוגיקת מיפוי StatusID → Stage, כולל כל מקרי הקצה
6. **הרחבת tRPC `byId()`** — returns unions, splits, nameHistory, computed stage

### Phase 3: UI Components

7. **`BillStagePipeline`** — הרכיב המרכזי
8. **`BillStageNode`** + **`BillStageConnector`** — תת-רכיבים
9. **`BillRelationshipBanner`** — מיזוג/פיצול/דין רציפות
10. **אינטגרציה ב-`legislation/[id]/page.tsx`** — החלפת ה-Badge הבודד ברכיב ה-progress

### Phase 4: Polish

11. **Animations** — CSS transitions + pulse effect לשלב נוכחי
12. **Responsive** — layout אנכי ב-mobile
13. **Dark mode** — גרדיאנטים ועיצוב כהה
14. **i18n** — 4 שפות (he, en, ar, ru)

---

## 12. תלויות טכנולוגיות

| רכיב       | טכנולוגיה               | הערות                                                               |
| ---------- | ----------------------- | ------------------------------------------------------------------- |
| Layout     | Tailwind CSS flexbox    | `flex-row` (desktop) / `flex-col` (mobile) + `rtl:flex-row-reverse` |
| Animations | CSS `@keyframes`        | Pulse glow לשלב הנוכחי                                              |
| Tooltip    | shadcn/ui `Tooltip`     | פרטי כל stage                                                       |
| Expandable | shadcn/ui `Collapsible` | פירוט מסמכים/הצבעות                                                 |
| Badge      | shadcn/ui `Badge`       | סטטוסים מיוחדים                                                     |
| Link       | Next.js `Link`          | קישורים בין חוקים (מיזוג/פיצול)                                     |
| Icons      | Lucide                  | CheckCircle, Circle, XCircle, GitMerge, GitBranch, Pause            |

---

## 13. סיכום ויזואלי — דוגמאות

### חוק רגיל (פרטי, שלב קריאה ראשונה):

```
 ✓ הגשה  →  ✓ דיון מוקדם  →  ✓ ועדה  →  ◉ קריאה ראשונה  →  ○ ועדה  →  ○ קריאה 2+3  →  ○ התקבלה
```

### חוק ממשלתי שהתקבל:

```
 ✓ הגשה  →  ✓ ועדה  →  ✓ קריאה ראשונה  →  ✓ ועדה  →  ✓ קריאה 2+3  →  ✓ התקבלה ✅
```

(ללא שלב "דיון מוקדם")

### חוק שמוזג:

```
 ✓ הגשה  →  ✓ דיון מוקדם  →  ✓ ועדה  →  ╳ מוזגה
 ┌──────────────────────────────────────────────┐
 │  🔀 מוזגה עם: הצעת חוק XYZ ←               │
 └──────────────────────────────────────────────┘
```

### חוק שנעצר:

```
 ✓ הגשה  →  ✓ דיון מוקדם  →  ⊘ נעצרה
 ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
 (שלבים נוספים מוצגים כמבוטלים)
```
