# 10 — קרדיט מקור הצעת חוק: זיהוי "גניבת הצעות" ומתן אשראי הוגן

## 1. הבעיה

תופעה מוכרת ומתועדת בכנסת:

1. חבר כנסת מהאופוזיציה מגיש הצעת חוק פרטית
2. ההצעה מוסרת מסדר היום / לא מובאת לדיון מוקדם
3. תוך שבועות-חודשים, ח"כ מהקואליציה (או הממשלה) מגיש הצעה דומה/זהה
4. ההצעה "החדשה" עוברת הליך חקיקה רגיל

**הדגמה (הצעות שהמשתמש זיהה):**

| #   | lawItemId | מגיש             | עמדה      | תאריך (משוער) | סטטוס           |
| --- | --------- | ---------------- | --------- | ------------- | --------------- |
| 1   | 2235125   | ח"כ אופוזיציה    | אופוזיציה | ראשון         | הוסרה מסדר היום |
| 2   | 2234872   | ח"כ קואליציה     | קואליציה  | ~שבועיים אחרי | טרם הובאה לדיון |
| 3   | 2236436   | ח"כים מהקואליציה | קואליציה  | ~חודש אחרי    | טרם הובאה לדיון |

**למה זה חשוב:**

- שקיפות: הציבור צריך לדעת מי באמת יזם את הרעיון
- הוגנות: ח"כי אופוזיציה שמציעים הצעות טובות ראויים לקרדיט
- ניתוח פוליטי: התופעה חושפת דינמיקות קואליציה-אופוזיציה

---

## 2. מודל הנתונים: אשכול הצעות דומות (Bill Cluster)

### 2.1 רעיון מרכזי

במקום "גניבת הצעות" (ביטוי שיפוטי), נשתמש במושג **"אשכול הצעות"** — קבוצה של הצעות חוק שעוסקות באותו נושא, עם מנגנון **"קרדיט מקור"** (Origin Credit) למי שהגיש ראשון.

### 2.2 טבלאות חדשות

```sql
-- אשכול הצעות דומות
CREATE TABLE bill_clusters (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,           -- שם תיאורי לאשכול (מנוהל/AI)
  description   TEXT,                    -- תיאור קצר של הנושא
  category      TEXT,                    -- קטגוריה (חינוך, ביטחון, רווחה...)
  confidence    REAL DEFAULT 0,          -- 0.0-1.0 רמת ודאות ההתאמה
  method        TEXT NOT NULL,           -- 'manual' | 'ai' | 'name_similarity' | 'union_inferred'
  created_by    TEXT,                    -- 'system' | 'ai' | userId (לעריכת אדמין)
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- שיוך הצעה לאשכול
CREATE TABLE bill_cluster_members (
  id            SERIAL PRIMARY KEY,
  cluster_id    INTEGER NOT NULL REFERENCES bill_clusters(id) ON DELETE CASCADE,
  bill_id       INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  is_origin     BOOLEAN DEFAULT FALSE,   -- ← האם זו ההצעה המקורית (הראשונה)
  added_method  TEXT NOT NULL,           -- 'auto' | 'manual' | 'ai'
  notes         TEXT,                    -- הערות (למה שויך)
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cluster_id, bill_id)
);

-- אינדקסים
CREATE INDEX idx_bcm_cluster ON bill_cluster_members(cluster_id);
CREATE INDEX idx_bcm_bill ON bill_cluster_members(bill_id);
CREATE INDEX idx_bcm_origin ON bill_cluster_members(cluster_id, is_origin) WHERE is_origin = TRUE;
```

### 2.3 Drizzle Schema

```ts
// src/lib/db/schema.ts

export const billClusters = pgTable('bill_clusters', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category'),
  confidence: numeric('confidence', { precision: 3, scale: 2 }),
  method: text('method').notNull(), // 'manual' | 'ai' | 'name_similarity' | 'union_inferred'
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const billClusterMembers = pgTable(
  'bill_cluster_members',
  {
    id: serial('id').primaryKey(),
    clusterId: integer('cluster_id')
      .references(() => billClusters.id, { onDelete: 'cascade' })
      .notNull(),
    billId: integer('bill_id')
      .references(() => bills.id, { onDelete: 'cascade' })
      .notNull(),
    isOrigin: boolean('is_origin').default(false),
    addedMethod: text('added_method').notNull(), // 'auto' | 'manual' | 'ai'
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [unique().on(t.clusterId, t.billId)],
);
```

### 2.4 ערך `is_origin`: מי המקור?

- ההצעה **הראשונה כרונולוגית** (`proposedDate`) באשכול מסומנת `is_origin = true`
- יכולות להיות שתי הצעות-מקור אם הוגשו באותו יום (נדיר)
- אדמין/AI יכולים לשנות את הסימון ידנית אם הלוגיקה הכרונולוגית שגויה

---

## 3. אסטרטגיות זיהוי אשכולות

### 3.1 Layer 1: Union-Inferred (פסיבי, מדויק)

**מקור:** טבלת `bill_unions` הקיימת כבר ב-DB.

כש-bill A מוזגה ל-bill B (`KNS_BillUnion`), הן ברורות-נושא.
Pipeline:

1. עבור כל רשומת `bill_unions` שבה שתי ההצעות מסוגים שונים (פרטית vs. ממשלתית)
2. צור אשכול אם לא קיים
3. סמן את ההצעה שהוגשה ראשונה כ-`is_origin`

**confidence:** 0.95 (מוזגו רשמית = כמעט בוודאות אותו נושא)

**method:** `'union_inferred'`

### 3.2 Layer 2: Name Similarity (אוטומטי, בינוני)

**לוגיקה:** הצעות חוק עם שמות דומים שהוגשו בפרק זמן קרוב.

Pipeline:

1. עבור כל הצעת חוק חדשה/מעודכנת
2. חפש הצעות אחרות מאותה כנסת עם דמיון שם ≥ 0.7 (Levenshtein / trigram similarity)
3. פילטר: הפרש תאריכים ≤ 180 יום (ניתן לכוונון ב-`appConfig`)
4. אם נמצא — צור/עדכן אשכול

**confidence:** 0.5–0.8 (תלוי במידת הדמיון)

**method:** `'name_similarity'`

**דוגמה לחישוב:**

```sql
-- PostgreSQL trigram similarity
SELECT b1.id, b2.id, similarity(b1.name, b2.name) as sim
FROM bills b1
JOIN bills b2 ON b1.id < b2.id
  AND b1.knesset_num = b2.knesset_num
  AND ABS(b1.proposed_date::date - b2.proposed_date::date) <= 180
WHERE similarity(b1.name, b2.name) >= 0.7;
```

### 3.3 Layer 3: AI Semantic Clustering (עתידי, Phase 2)

**לוגיקה:** שימוש ב-embedding vectors לזיהוי הצעות שעוסקות באותו נושא גם אם השם שונה.

Pipeline:

1. לכל הצעת חוק — generate embedding מה-name + summary (אם קיים)
2. אחסון ב-`pgvector` extension (או שירות חיצוני)
3. חיפוש שכנים קרובים (cosine similarity ≥ 0.85)
4. סינון לפי חלון זמן ריאלי (אותה כנסת, ≤ 365 יום)
5. AI judgment: Gemini/OpenAI מקבל את שני שמות ההצעות + סיכומים ומאשר/דוחה

**confidence:** 0.6–0.95 (תלוי ב-embedding + AI validation)

**method:** `'ai'`

> **חשוב:** ה-AI abstraction דרך `@/lib/ai/provider` — לעולם לא ייבוא ישיר של SDK.

### 3.4 Layer 4: Manual (אדמין / קהילה)

- ממשק אדמין לשיוך ידני של הצעות לאשכול
- אפשרות עתידית: משתמשים רשומים מציעים שיוכים (community flagging)

**confidence:** 1.0

**method:** `'manual'`

---

## 4. תובנה: "ציון מקור" (Origin Score) ברמת חבר כנסת

### 4.1 מטריקה חדשה: Origin Credit Count

לכל חבר כנסת, נספור:

```
originCredits = מספר ההצעות שבהן הוא/היא מסומנ/ת כמגיש/ה של is_origin=true bill באשכול
```

### 4.2 מטריקה משלימה: Adoption Rate

```
adoptionRate = (אשכולות שבהם ח"כ הוא/היא origin וההצעה של מישהו אחר באשכול התקדמה)
               ÷ (סה"כ אשכולות שבהם ח"כ הוא/היא origin)
```

**פרשנות:**

- `adoptionRate` גבוה = ח"כ מציע/ה רעיונות שבסוף מתקבלים (אבל דרך אחרים)
- שלוב עם `isCoalition` מגלה דפוסי קואליציה-אופוזיציה

### 4.3 מטריקה ברמת סיעה/קואליציה

```
factionOriginRate = (הצעות-מקור של הסיעה) ÷ (סה"כ הצעות באשכולות שהסיעה מעורבת בהם)
coalitionAdoptionRate = (אשכולות שבהם origin מהאופוזיציה והמתקדמת מהקואליציה) ÷ (כלל האשכולות)
```

---

## 5. ממשק משתמש

### 5.1 באנר בדף הצעת חוק (Bill Detail Page)

כאשר הצעת חוק שייכת לאשכול, מציגים באנר חדש — **OriginCreditBanner** — בדומה ל-`BillRelationshipBanner` הקיים:

```
┌──────────────────────────────────────────────────────────────┐
│ 💡 הצעות דומות                                              │
│                                                              │
│ הצעה זו חלק מאשכול של 3 הצעות בנושא "XYZ".                 │
│ ההצעה המקורית הוגשה ע"י ח"כ [שם] (אופוזיציה)              │
│ ב-[תאריך], 14 ימים לפני הצעה זו.                           │
│                                                              │
│ 📋 ראו את כל ההצעות באשכול:                                 │
│   1. [שם הצעה 1] — ח"כ X (אופוזיציה) — הוסרה מסדר היום ← מקור │
│   2. [שם הצעה 2] — ח"כ Y (קואליציה) — טרם נידונה           │
│   3. [שם הצעה 3] — ח"כ Z (קואליציה) — טרם נידונה           │
│                                                              │
│ [🤖 זוהה אוטומטית · confidence: 85% · פרטים]               │
└──────────────────────────────────────────────────────────────┘
```

**וריאנטים:**

- אם ההצעה הנוכחית **היא** המקור: באנר ירוק "הצעה זו זוהתה כהצעה המקורית באשכול"
- אם ההצעה הנוכחית **אינה** המקור: באנר כתום "הצעה דומה הוגשה לפני כן ע"י..."
- שקיפות: תמיד מציגים confidence + method

### 5.2 כרטיס בפרופיל חבר כנסת

בדף חבר הכנסת, טאב/כרטיס חדש **"קרדיט יוזמה"**:

```
┌─────────── קרדיט יוזמה ───────────┐
│                                    │
│  הצעות מקור:        12            │
│  אימוץ ע"י אחרים:   5 (42%)      │
│                                    │
│  ─────────────────────────────     │
│  דוגמאות:                          │
│  • חוק XYZ — הוגש 1.1.26         │
│    → אומץ ע"י ח"כ A (קואליציה)   │
│  • חוק ABC — הוגש 15.2.26        │
│    → עדיין מקורי (אין כפילות)     │
│                                    │
└────────────────────────────────────┘
```

### 5.3 דשבורד ניתוח (Analytics Page — עתידי)

- **Top Origin Creators**: ח"כים שהכי הרבה רעיונות שלהם "אומצו"
- **Coalition Adoption Patterns**: אחוז הצעות-מקור מהאופוזיציה שהקואליציה הגישה בגרסה דומה
- **Timeline View**: ציר זמן של אשכול ספציפי — מתי כל הצעה הוגשה, ע"י מי, ומה הסטטוס
- **Filter by**: כנסת, סיעה, קטגוריה, confidence threshold

---

## 6. tRPC Router — הרחבות

### 6.1 Router חדש: `clusterRouter`

```ts
// src/server/routers/clusters.ts

clusterRouter = router({
  // הצעות באותו אשכול של הצעה נתונה
  byBillId: publicProcedure
    .input(z.object({ billId: z.number() }))
    .query(/* ... */),

  // אשכולות של חבר כנסת ספציפי (הצעות שהוא/היא origin)
  byMemberId: publicProcedure
    .input(z.object({ memberId: z.number() }))
    .query(/* ... */),

  // סטטיסטיקות origin credit לח"כ
  memberOriginStats: publicProcedure
    .input(z.object({ memberId: z.number() }))
    .query(/* → { originCount, adoptedCount, adoptionRate } */),

  // Top origin creators (analytics)
  topOriginCreators: publicProcedure
    .input(
      z.object({
        knessetNum: z.number().optional(),
        limit: z.number().default(20),
      }),
    )
    .query(/* ... */),
});
```

### 6.2 הרחבת `bills.byId`

- מוסיפים שדה `cluster` לתשובה:
  ```ts
  cluster: {
    id: number;
    name: string;
    isOrigin: boolean;        // ← האם ההצעה הזו היא המקור
    confidence: number;
    method: string;
    otherBills: {
      id: number;
      name: string;
      proposedDate: string;
      isOrigin: boolean;
      initiators: { name: string; isCoalition: boolean }[];
      status: string;
    }[];
  } | null
  ```

---

## 7. Pipeline: סנכרון וזיהוי אוטומטי

### 7.1 Job חדש: `detect-bill-clusters.ts`

```
src/pipeline/jobs/detect-bill-clusters.ts
```

**מתי רץ?** אחרי `sync-bills` + `sync-bill-initiators` (בסדר ה-pipeline)

**שלבים:**

```
1. Layer 1 — Union-Inferred
   ├─ שליפת כל bill_unions שבהם ההצעות מסוגים שונים
   ├─ לכל זוג: בדוק אם כבר באשכול
   └─ אם לא → צור אשכול, סמן origin כרונולוגית

2. Layer 2 — Name Similarity
   ├─ שליפת הצעות חדשות/מעודכנות מאז checkpoint
   ├─ לכל הצעה: pg_trgm similarity מול שאר ההצעות באותה כנסת
   ├─ פילטר: sim ≥ 0.7, date diff ≤ 180 days
   ├─ לכל match: בדוק אם כבר באשכול
   └─ אם לא → צור/ הוסף לאשכול, סמן origin

3. (Phase 2) Layer 3 — AI Semantic
   ├─ Generate embeddings לכל הצעה ללא embedding
   ├─ Cosine similarity search
   ├─ AI validation call
   └─ Create/update clusters

4. Recalculate is_origin
   └─ לכל אשכול שהשתנה: מעדכן is_origin לפי min(proposedDate)
```

### 7.2 תלויות

- **pg_trgm extension** — צריך להפעיל ב-Supabase:
  ```sql
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE INDEX idx_bills_name_trgm ON bills USING gin (name gin_trgm_ops);
  ```
- **appConfig keys חדשים:**
  ```ts
  // app.config.ts
  billClusters: {
    nameSimilarityThreshold: parseFloat(process.env.BILL_CLUSTER_NAME_THRESHOLD ?? '0.7'),
    maxDateDiffDays: parseInt(process.env.BILL_CLUSTER_MAX_DATE_DIFF ?? '180'),
    aiConfidenceThreshold: parseFloat(process.env.BILL_CLUSTER_AI_THRESHOLD ?? '0.85'),
  }
  ```

---

## 8. i18n Keys

```jsonc
// legislation.cluster namespace — all 4 locales (he, en, ar, ru)
{
  "legislation": {
    "cluster": {
      "title": "הצעות דומות",
      "originBill": "הצעה מקורית",
      "originBillDesc": "הצעה זו זוהתה כהצעה הראשונה שהוגשה בנושא זה",
      "similarBillDesc": "הצעה דומה הוגשה קודם לכן ע\"י {name}",
      "daysBeforeThis": "{count} ימים לפני הצעה זו",
      "allBillsInCluster": "כל ההצעות באשכול",
      "confidence": "רמת ודאות: {value}%",
      "method": {
        "manual": "שיוך ידני",
        "ai": "זוהה ע\"י AI",
        "name_similarity": "דמיון שמות",
        "union_inferred": "נגזר ממיזוג רשמי",
      },
      "originCredit": "קרדיט יוזמה",
      "originCount": "הצעות מקור",
      "adoptedCount": "אומצו ע\"י אחרים",
      "adoptionRate": "שיעור אימוץ",
      "coalition": "קואליציה",
      "opposition": "אופוזיציה",
      "noCluster": "לא זוהו הצעות דומות",
    },
  },
}
```

---

## 9. שיקולים אתיים ומשפטיים

### 9.1 שפה ניטרלית

- ❌ לא "גניבת הצעות", "העתקה", "ניכוס"
- ✅ כן "הצעות דומות", "אשכול", "קרדיט מקור", "הצעה מקורית"
- הסבר: המערכת מציגה **עובדות** (מי הגיש ראשון, דמיון שמות) ולא שופטת

### 9.2 שקיפות אלגוריתמית

- תמיד מציגים **confidence** ו-**method** — המשתמש יודע למה שויכו ההצעות
- אשכולות AI/אוטומטיים מסומנים בבירור כ"זוהה אוטומטית"
- אפשרות עתידית: "דווח על שגיאה" — משתמש יכול לדווח שהשיוך שגוי

### 9.3 דיוק

- Layer 1 (union) = אמין מאוד, מבוסס נתונים רשמיים
- Layer 2 (שם) = צריך threshold גבוה — שמות דומים לא בהכרח אותו נושא
- Layer 3 (AI) = לעולם לא 100%, תמיד עם confidence
- **ברירת מחדל בתצוגה**: מציגים רק אשכולות עם confidence ≥ 0.7

---

## 10. שלבי יישום

### Phase 1: תשתית (שבוע 1-2)

- [ ] Drizzle schema: `billClusters`, `billClusterMembers`
- [ ] Migration SQL + `pg_trgm` extension
- [ ] appConfig keys
- [ ] tRPC `clusterRouter` — `byBillId`, `memberOriginStats`

### Phase 2: זיהוי אוטומטי — Layers 1+2 (שבוע 2-3)

- [ ] Pipeline job: `detect-bill-clusters.ts`
- [ ] Layer 1: Union-inferred clustering
- [ ] Layer 2: Name similarity (pg_trgm)
- [ ] Origin auto-marking logic

### Phase 3: UI — באנר + פרופיל (שבוע 3-4)

- [ ] `OriginCreditBanner` component (legislation detail page)
- [ ] Origin credit card in member profile
- [ ] i18n keys (he, en, ar, ru)

### Phase 4: AI Clustering (Phase 2 של הפרויקט)

- [ ] Embedding generation pipeline
- [ ] pgvector integration / חיפוש סמנטי
- [ ] AI validation step
- [ ] Layer 3 integration in detect-bill-clusters

### Phase 5: Analytics Dashboard (Phase 2-3 של הפרויקט)

- [ ] Top origin creators view
- [ ] Coalition adoption patterns
- [ ] Timeline visualization
- [ ] Filtering + export

---

## 11. קשר למערכת הקיימת

### מה קיים ומתחבר:

| רכיב קיים                | קשר לפיצ'ר                                 |
| ------------------------ | ------------------------------------------ |
| `bills` table            | בסיס — כל הצעה משויכת לאשכול               |
| `billInitiators`         | מי הגיש — חיוני לקביעת קואליציה/אופוזיציה  |
| `billUnions`             | Layer 1 — מקור ראשי לזיהוי אשכולות         |
| `members.isCoalition`    | ניתוח קואליציה/אופוזיציה                   |
| `factions`               | שיוך סיעתי                                 |
| `BillRelationshipBanner` | תבנית UI — OriginCreditBanner יהיה דומה    |
| `BillStagePipeline`      | מציג התקדמות — ישמש להשוואת סטטוסים באשכול |
| `computeBillStage()`     | לוגיקת שלבים — תשמש לזיהוי "הצעה שהתקדמה"  |
| `@/lib/ai/provider`      | Layer 3 — AI semantic analysis             |
| `appConfig`              | כל הפרמטרים (thresholds, limits)           |

### מה צריך לשנות ברכיבים קיימים:

1. **`bills.byId` (tRPC)** — להוסיף שליפת cluster data
2. **Legislation detail page** — להוסיף `OriginCreditBanner`
3. **Member profile page** — להוסיף כרטיס origin credit
4. **Pipeline schedule** — להוסיף `detect-bill-clusters` job
5. **i18n messages** — namespace חדש `legislation.cluster`

---

## 12. סיכום

הפיצ'ר הזה הופך דפוס פוליטי שקשה לזהות לתובנה נגישה וברורה. ע"י שימוש בשפה ניטרלית, שקיפות אלגוריתמית, ושילוב הדרגתי של שלוש שכבות זיהוי (union → name → AI), המערכת:

1. **נותנת קרדיט הוגן** — מי שהציע ראשון מוצג כמקור
2. **חושפת דפוסים** — ניתוח ברמת ח"כ, סיעה, וקואליציה/אופוזיציה
3. **נשארת אובייקטיבית** — עובדות, לא שיפוטים
4. **שקופה** — המשתמש רואה למה המערכת חושבת שההצעות קשורות
