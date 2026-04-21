# 06 — מקורות מידע: ממשלתיים, אקדמיים ואזרחיים

## סקירה כללית

```
┌─────────────────────────────────────────────────────────────┐
│                    KNESSET INSIGHT                            │
│                    Data Sources Map                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ══════ מקורות קיימים (פעילים) ══════                       │
│  🟢 Knesset OData API                                       │
│  🟢 Open Knesset (Hasadna)                                  │
│  🟢 Open Budget API                                         │
│                                                              │
│  ══════ מקורות מתוכננים (Phase 2-3) ══════                  │
│  🟡 election results, additional knesset endpoints           │
│  🟡 Government resolutions                                  │
│  🟡 Municipal data portals                                  │
│                                                              │
│  ══════ מקורות חזוניים (Phase 4-5) ══════                   │
│  🔵 Democracy Institute (IDI) data                          │
│  🔵 Academic research APIs                                  │
│  🔵 Court decisions (Nevo)                                  │
│  🔵 CBS (Central Bureau of Statistics)                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## מקורות פעילים

### 1. Knesset OData API 🟢

**URL:** `https://knesset.gov.il/Odata/ParliamentInfo.svc/` (מ-appConfig)

**מה מסנכרנים:**

| Endpoint         | Entity      | Job             | תדירות    |
| ---------------- | ----------- | --------------- | --------- |
| `KNS_Person`     | חברי כנסת   | sync-members    | כל 6 שעות |
| `KNS_PlmSession` | הצבעות      | sync-votes      | כל 6 שעות |
| `KNS_Bill`       | הצעות חוק   | sync-bills      | כל 6 שעות |
| `KNS_Committee`  | ועדות       | sync-committees | כל 6 שעות |
| `KNS_Faction`    | סיעות       | sync-members    | כל 6 שעות |
| `Kns_ItemType`   | סוגי פריטים | context         | לפי צורך  |

**אסטרטגיית סנכרון:**

- Incremental: `$filter=LastUpdatedDate gt datetime'...'`
- Batch: 100 records per request
- Retry: 3 retries with exponential backoff
- Scope: כנסות 20–25 (מוגדר ב-appConfig)

**מגבלות ידועות:**

- API לא תומך pagination סטנדרטי (OData v3)
- שדות חסרים לעתים (nullable)
- encoding issues בשמות בערבית
- rate limiting לא מתועד (safe: 10 req/s)

### 2. Open Knesset / Hasadna 🟢

**URL:** `https://oknesset.org/` (CSV feeds)

**מה מסנכרנים:**

| Feed        | Entity               | תדירות       |
| ----------- | -------------------- | ------------ |
| Members CSV | חברי כנסת (enriched) | יומי (03:00) |
| Votes CSV   | פרטי הצבעות          | יומי (03:00) |
| Bills CSV   | מצב חקיקה            | יומי (03:00) |

**יתרון:** נתונים מעובדים ומנוקים, כולל metadata שלא קיים ב-OData.

**אסטרטגיית סנכרון:**

- Hash comparison: checksum של CSV vs. גרסה אחרונה
- Full refresh אם hash שונה
- Merge עם נתוני OData (OData = primary, Hasadna = enrichment)

### 3. Open Budget API 🟢

**URL:** `https://next.obudget.org/api/` (מ-appConfig)

**מה מסנכרנים:**

| Endpoint         | Entity          | תדירות             |
| ---------------- | --------------- | ------------------ |
| `/search/budget` | סעיפי תקציב     | שבועי (שישי 02:00) |
| `/api/query`     | שאילתות מותאמות | לפי צורך           |

**אסטרטגיה:**

- Full refresh שבועי (נתוני תקציב משתנים לעתים נדירות)
- Cache invalidation אחרי sync

---

## מקורות מתוכננים

### 4. ועדת הבחירות המרכזית 🟡

**URL:** `https://votes.gov.il/`

**סוג מידע:**

- תוצאות בחירות רשמיות (כל כנסת)
- תוצאות לפי ישוב / קלפי
- אחוזי הצבעה
- רשימות מועמדים

**אתגרים:**

- אין API רשמי — נדרש scraping או קבצי CSV ידניים
- פורמטים משתנים בין בחירות
- נתונים היסטוריים בפורמטים ישנים

**תכנית:**

- Phase 1: Import ידני של CSVs לתקופה 20–25
- Phase 2: Scraper אוטומטי לתוצאות חדשות
- Phase 3: Historical data (כנסות 1–19)

### 5. החלטות ממשלה 🟡

**URL:** `https://www.gov.il/he/departments/government_decisions/`

**סוג מידע:**

- החלטות ממשלה (רנ"ג)
- תאריך, נושא, משרד אחראי
- סטטוס ביצוע

**ערך מוסף:** קישור בין חקיקה להחלטות ביצוע — "החוק עבר, האם הממשלה מבצעת?"

### 6. data.gov.il — פורטל נתונים פתוחים 🟡

**URL:** `https://data.gov.il/`

**מקורות רלוונטיים:**

| Dataset              | ערך                |
| -------------------- | ------------------ |
| תקציב המדינה (מפורט) | ניתוח תקציב מעמיק  |
| נתוני כוח אדם ממשלתי | גודל ועלות ממשלה   |
| רשומות רגולציה       | מעקב אחרי תקנות    |
| נתוני חינוך          | הקשר לחקיקת חינוך  |
| נתוני בריאות         | הקשר לחקיקת בריאות |

**פורמט:** JSON/CSV via CKAN API

**תכנית:** בניית adapters ל-CKAN API

---

## מקורות חזוניים — מכוני מחקר ואקדמיה

### 7. המכון הישראלי לדמוקרטיה (IDI) 🔵

**URL:** `https://www.idi.org.il/`

**סוגי מידע:**

| מחקר                   | ערך לפלטפורמה     | סוג שילוב          |
| ---------------------- | ----------------- | ------------------ |
| מדד הדמוקרטיה הישראלית | ציון שנתי + מגמות | Data import (שנתי) |
| סקר אמון ציבור במוסדות | הקשר לפעילות כנסת | Visualization      |
| ניתוחי חקיקה           | העמקה לדפי חוקים  | Links + excerpts   |
| דו"חות ועדות חקירה     | רקע היסטורי       | Archive            |

**סוג שיתוף פעולה:**

- רמה 1: קישורים למחקרים רלוונטיים (ללא רשות מיוחדת)
- רמה 2: שילוב נתונים כמותיים (דורש הסכם)
- רמה 3: API הדדי (שאיפה)

### 8. דמוקרטיה 3.0 🔵

**URL:** `https://democracy30.org/`

**סוגי מידע:**

| נושא                             | ערך               |
| -------------------------------- | ----------------- |
| מודלים של השתתפות אזרחית         | השראה ל-features  |
| מדדי פתיחות ממשלתית              | מדד שקיפות        |
| Best practices בטכנולוגיה אזרחית | כלים ומתודולוגיות |

**תכנית:** שיתוף פעולה על מדד שקיפות פרלמנטרית

### 9. הסדנא לידע ציבורי (Public Knowledge Workshop) 🔵

**URL:** `https://www.hasadna.org.il/`

כבר משתמשים ב-Open Knesset שלהם. הרחבה אפשרית:

- Anyway (תשתיות ציבוריות)
- Open Train (שירותים ציבוריים)
- Migdar (ייצוג מגדרי)

### 10. מרכז טאוב 🔵

**URL:** `https://www.taubcenter.org.il/`

| מחקר            | ערך                   |
| --------------- | --------------------- |
| דו"ח מצב המדינה | הקשר מאקרו לחקיקה     |
| נתוני חינוך     | הצלבה עם תקציב חינוך  |
| נתוני בריאות    | הצלבה עם תקציב בריאות |
| שוק העבודה      | הקשר לחקיקת עבודה     |

### 11. מרכז אדוה 🔵

**URL:** `https://adva.org/`

| מחקר             | ערך                  |
| ---------------- | -------------------- |
| פערים חברתיים    | הקשר לחקיקה חברתית   |
| תקציב ואי-שוויון | הצלבה עם ניתוח תקציב |
| חינוך ואי-שוויון | הקשר לחקיקת חינוך    |

### 12. בתי משפט (חזון ארוך טווח) 🔵

**מקורות:**

- נבו — פסקי דין
- באין — החלטות בג"ץ

**ערך:** לקשר בין חקיקה → ביקורת שיפוטית → פסיקה

**אתגרים:**

- אין API ציבורי
- דורש הסכמי גישה
- בעיות זכויות יוצרים

---

## ארכיטקטורת Data Pipeline

### מבנה כללי

```
External Sources
    │
    ▼
┌────────────────┐
│   Extractors    │ — source-specific connectors
│  (per-source)   │ — OData, CSV, REST, scraper
└───────┬────────┘
        │ Raw Data
        ▼
┌────────────────┐
│  Transformers   │ — normalization
│                 │ — deduplication
│                 │ — enrichment
│                 │ — entity resolution
└───────┬────────┘
        │ Clean Data
        ▼
┌────────────────┐
│    Loaders      │ — Drizzle ORM upsert
│                 │ — sync_log tracking
│                 │ — cache invalidation
│                 │ — event emission
└───────┬────────┘
        │ Events
        ▼
┌────────────────┐
│  Post-Process   │ — notification dispatch
│                 │ — aggregation update
│                 │ — search index update
└────────────────┘
```

### הגדרת מקור חדש (Template)

```typescript
// src/pipeline/sources/{source-name}.ts
interface DataSource {
  name: string;
  type: 'odata' | 'csv' | 'rest' | 'scraper';
  baseUrl: string;
  schedule: string; // cron expression
  entities: EntityConfig[];
}

interface EntityConfig {
  name: string;
  endpoint: string;
  targetTable: string;
  transform: (raw: unknown) => Record<string, unknown>;
  incrementalKey?: string; // for incremental sync
  deduplicateKey?: string; // for dedup
}
```

### Entity Resolution

כשמחברים מקורות שונים, צריך לזהות אותה ישות:

```
Knesset OData: { PersonID: 1234, FirstName: "יריב", LastName: "לוין" }
Open Knesset:  { id: "YL-001", name: "יריב לוין" }
Budget API:    { minister: "לוין, יריב", ministry: "משפטים" }
IDI:           { mk_name: "Yariv Levin", knesset: 25 }
```

**אסטרטגיית Resolution:**

1. Primary key = Knesset OData PersonID (authority)
2. Fuzzy name matching (Levenshtein distance)
3. Manual mapping table for edge cases
4. VIP ID field (כבר קיים בסכמה)

---

## נתוני בסיס כמותי (Estimations)

### Volume

| Entity                    | Records (est.)    | Growth/Month | Storage |
| ------------------------- | ----------------- | ------------ | ------- |
| Members                   | ~800 (historical) | +5           | ~1 MB   |
| Votes                     | ~50,000           | +200         | ~50 MB  |
| Member_votes              | ~2,000,000        | +10,000      | ~500 MB |
| Bills                     | ~20,000           | +100         | ~20 MB  |
| Committees                | ~200              | +5           | ~0.5 MB |
| Committee_sessions        | ~10,000           | +50          | ~10 MB  |
| Budget_items              | ~50,000           | +0 (annual)  | ~20 MB  |
| **User data (projected)** |                   |              |         |
| Profiles                  | +1,000/month      |              | ~1 MB   |
| User_follows              | +5,000/month      |              | ~5 MB   |
| User_ratings              | +2,000/month      |              | ~2 MB   |
| Notifications             | +50,000/month     |              | ~50 MB  |

**Total estimated DB size at 1 year: ~1 GB** — well within Supabase Pro limits

### API Call Volume

| Source               | Calls/Day   | Rate Limit       |
| -------------------- | ----------- | ---------------- |
| Knesset OData        | ~200        | ~10 req/s (safe) |
| Open Knesset CSV     | ~10         | N/A              |
| Budget API           | ~5 (weekly) | N/A              |
| data.gov.il (future) | ~50         | ~5 req/s         |

---

## תכנית הרחבת מקורות

### Phase 2 (מיידי)

1. ✅ השלמת pipeline קיים (כל 9 jobs עובדים אמין)
2. הוספת election results (בחירות CSV)
3. הוספת Government decisions API
4. חיפוש full-text index

### Phase 3 (3–6 חודשים)

5. data.gov.il CKAN adapter
6. קישורים למחקרי IDI
7. Municipal data — עיריות גדולות (תל אביב, ירושלים, חיפה)

### Phase 4 (6–12 חודשים)

8. IDI data integration (הסכם)
9. Court decisions (אם יש API)
10. CBS statistical data
11. Taub Center data

### Phase 5 (שנה+)

12. Real-time Knesset feed (Supabase Realtime)
13. Open Parliament data (cross-country comparison)
14. Automated research paper ingestion

---

## Data Quality Framework

### עקרונות

1. **Source of Truth** — Knesset OData הוא ה-authority, מקורות אחרים = enrichment
2. **Audit Trail** — sync_log מתעד כל import
3. **Validation** — Zod schemas על כל נתון נכנס
4. **Staleness Detection** — alert אם מקור לא עודכן מעבר ל-threshold
5. **Conflict Resolution** — כשמקורות חולקים, OData גובר

### Data Freshness SLA

| Entity    | Max Staleness      | Alert After |
| --------- | ------------------ | ----------- |
| Members   | 12 hours           | 24 hours    |
| Votes     | 6 hours            | 12 hours    |
| Bills     | 12 hours           | 24 hours    |
| Budget    | 7 days             | 14 days     |
| Elections | N/A (event-driven) | N/A         |

### Monitoring Dashboard (עתידי)

```
┌─────────────────────────────────────────┐
│ 📊 Data Health Dashboard                │
├─────────────────────────────────────────┤
│ Members:    ✅ Updated 2h ago (800 rec) │
│ Votes:      ✅ Updated 4h ago (49,823)  │
│ Bills:      ⚠️ Updated 20h ago (19,456) │
│ Budget:     ✅ Updated 3d ago (48,210)  │
│ Committees: ❌ FAILED — last sync error │
│                                          │
│ [View Sync Logs] [Force Sync] [Config]  │
└─────────────────────────────────────────┘
```
