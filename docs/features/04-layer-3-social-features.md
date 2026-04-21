# 04 — שכבה שלישית: שיתוף פעולה ודירוגים ציבוריים

## עקרון מנחה

> הפלטפורמה הופכת ממקור מידע **לקהילה פעילה** — משתמשים רואים זה את זה,
> למידים מדעות אחרים, ומייצרים **אינטליגנציה קולקטיבית** על הפוליטיקה הישראלית.

---

## הזהירות הנדרשת

שכבה חברתית בפלטפורמה פוליטית דורשת **תכנון זהיר במיוחד**:

| סיכון                         | מענה                                          |
| ----------------------------- | --------------------------------------------- |
| מניפולציה / בוטים             | Rate limiting + CAPTCHA + זיהוי דפוסים        |
| Brigading (גיוס המוני לדירוג) | אלגוריתם זיהוי anomalies + cooldown           |
| שיח שנאה                      | Content moderation (AI + ידני)                |
| פולריזציה                     | הצגת שני צדדים, ללא sorting דיפולטי לפי דירוג |
| פרטיות                        | כל פעולה ציבורית = Opt-in מפורש               |
| Doxxing                       | איסור פרסום מידע אישי, מנגנון דיווח           |

---

## תכונות ציבוריות

### 4.1 דירוג ציבורי מצרפי של חברי כנסת

#### קונספט

דירוגים אישיים (משכבה 2) שהמשתמש בחר להפוך לציבוריים — מצטרפים למדד ציבורי:

```
┌──────────────────────────────────────────────┐
│ 👤 יריב לוין                                │
│ דירוג ציבורי (342 מדרגים)                    │
│                                              │
│ ביצוע כללי:   ⭐⭐⭐☆☆  3.2/5  ████████░░   │
│ אמינות:       ⭐⭐⭐☆☆  2.8/5  ███████░░░   │
│ שקיפות:       ⭐⭐☆☆☆  2.1/5  █████░░░░░   │
│ מקצועיות:     ⭐⭐⭐⭐☆  3.9/5  █████████░   │
│ ייצוג:        ⭐⭐⭐☆☆  3.0/5  ████████░░   │
│                                              │
│ ציון משוקלל: 3.0/5                           │
│                                              │
│ 📊 התפלגות:  ⭐1: 12% ⭐2: 18% ⭐3: 35%    │
│              ⭐4: 25% ⭐5: 10%              │
│                                              │
│ 📈 מגמה: ↗ +0.3 בחודש האחרון               │
│                                              │
│ [דרג גם אתה →]                               │
└──────────────────────────────────────────────┘
```

#### חישוב דירוג מצרפי

```typescript
// ממוצע משוקלל — חשבונות ותיקים יותר מקבלים משקל גבוה יותר
function calculateAggregateRating(ratings: Rating[]): AggregateRating {
  // משקל לפי "גיל" החשבון
  const weightedRatings = ratings.map((r) => ({
    ...r,
    weight: getAccountWeight(r.userId), // 0.5 לחדש, 1.0 אחרי חודש, 1.5 אחרי שנה
  }));

  // Trim extremes — הסרת 5% עליון ותחתון
  const trimmed = trimExtremes(weightedRatings, 0.05);

  // ממוצע משוקלל
  return weightedAverage(trimmed);
}
```

#### מנגנון נגד מניפולציה

1. **Minimum threshold** — דירוג ציבורי מופיע רק אחרי 20+ מדרגים
2. **Account age** — חשבון חייב להיות פעיל 7+ ימים לפני דירוג ציבורי
3. **Rate limit** — מקסימום 10 דירוגים ליום
4. **Anomaly detection** — spike פתאומי בדירוגים ← דגל אדום ← בדיקה ידנית
5. **Edit cooldown** — חכה שבוע לפני שינוי דירוג
6. **No delete & re-rate** — מחיקה = cooldown כמו עריכה

### 4.2 מונה עוקבים / תומכים

#### תצוגה ציבורית

```
┌──────────────────────────────────┐
│ 👤 יריב לוין                   │
│                                  │
│ 1,247 עוקבים  │  342 מדרגים     │
│                                  │
│ מגמה: ↗ +89 עוקבים חדשים       │
│ (30 ימים אחרונים)               │
└──────────────────────────────────┘
```

**חשוב:** העוקבים הם **מספר בלבד** — לא רשימת שמות. אנונימיות מוחלטת של עוקבים.

#### לוח מובילים (Leaderboard)

```
┌──────────────────────────────────────────────┐
│ 📊 חברי הכנסת עם הכי הרבה עוקבים           │
│                                               │
│  # │ חה"כ              │ עוקבים │ מגמה │ דירוג │
│ ───┼───────────────────┼────────┼──────┼───── │
│  1 │ ישראל כץ          │ 2,341  │  ↗   │ 3.8  │
│  2 │ יאיר לפיד        │ 2,187  │  →   │ 3.5  │
│  3 │ בצלאל סמוטריץ'   │ 1,984  │  ↗   │ 2.1  │
│  4 │ מירב מיכאלי      │ 1,756  │  ↘   │ 3.9  │
│  5 │ ...              │        │      │      │
│                                               │
│ 📌 ניתן למיין לפי: עוקבים | דירוג | מגמה    │
│                                               │
│ ⚠️ המספרים משקפים פופולריות בפלטפורמה       │
│    ולא סקר דעת קהל מייצג                     │
└──────────────────────────────────────────────┘
```

**Disclaimer חובה:** תמיד מוצג ליד כל Leaderboard:

> "המספרים משקפים את פעילות המשתמשים בפלטפורמה בלבד ואינם מהווים סקר מייצג של דעת הקהל הישראלית."

### 4.3 תגובות ציבוריות (גרסה מבוקרת)

#### עקרון

לא Forum חופשי, אלא **תגובות ממוקדות** על ישויות ספציפיות:

**איפה אפשר להגיב:**

- דף הצבעה — "מה דעתך על ההצבעה?"
- דף חוק — "מה דעתך על החוק?"
- דירוג ציבורי — הערה שמלווה את הדירוג

**איפה לא:**

- לא על חברי כנסת ספציפים (למנוע bullying)
- לא על משתמשים אחרים (לא רשת חברתית)

#### סכמה

```typescript
export const publicComments = pgTable(
  'public_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    entityType: text('entity_type').notNull(), // 'vote' | 'bill'
    entityId: text('entity_id').notNull(),
    content: text('content').notNull(), // מקסימום 500 תווים
    status: text('status').default('active'), // active | hidden | flagged | removed
    upvotes: integer('upvotes').default(0),
    downvotes: integer('downvotes').default(0),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    entityIdx: index('idx_comments_entity').on(
      table.entityType,
      table.entityId,
    ),
    userIdx: index('idx_comments_user').on(table.userId),
  }),
);

export const commentVotes = pgTable(
  'comment_votes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    commentId: uuid('comment_id')
      .notNull()
      .references(() => publicComments.id, { onDelete: 'cascade' }),
    vote: smallint('vote').notNull(), // 1 = upvote, -1 = downvote
  },
  (table) => ({
    uniqueVote: unique().on(table.userId, table.commentId),
  }),
);
```

#### Content Moderation Pipeline

```
תגובה חדשה
    │
    ▼
Automated Check (AI)
    ├── OK → פורסם
    ├── Uncertain → תור ביקורת ידנית
    └── Violation → נחסם + הודעה למשתמש
    │
    ▼
Community Flags (דיווח משתמשים)
    │ (≥ 3 דיווחים)
    ▼
Manual Review → אישור / הסרה / אזהרה
```

**כללי תוכן:**

- ✅ דעות על חקיקה והצבעות
- ✅ ביקורת מנומקת
- ✅ שאלות ודיון ענייני
- ❌ שיח שנאה, גזענות, הסתה
- ❌ התקפות אישיות
- ❌ מידע כוזב מכוון
- ❌ פרסום / spam
- ❌ מידע אישי של אחרים

### 4.4 סטטיסטיקות קהילתיות

#### מדד עניין ציבורי

כל ישות מקבלת "מדד עניין" מבוסס פעילות הקהילה:

```typescript
interface PublicInterestScore {
  followers: number; // כמה עוקבים
  ratings: number; // כמה מדרגים
  comments: number; // כמה תגובות
  views: number; // צפיות (גם אנונימיות)
  trend: 'rising' | 'stable' | 'declining';
  score: number; // ציון מנורמל 0-100
}
```

**שימוש:**

- בדף הבית: "חוקים שמעניינים את הקהילה"
- בחיפוש: סידור לפי רלוונטיות + עניין ציבורי
- באייקון: 🔥 (hot) ליד ישויות עם עניין גבוה

#### מפת חום גיאוגרפית (עתיד — שכבה 4)

אם המשתמש מאשר מיקום כללי (עיר/אזור):

- מפת ישראל עם density map של עוקבים
- "חה"כ הכי פופולרי בתל אביב / בנגב / בצפון"
- הצלבה עם נתוני בחירות אמיתיים

### 4.5 שיתוף חברתי

#### שיתוף מדף

כל דף ציבורי כולל כפתורי שיתוף:

```
[🔗 העתק קישור] [📱 WhatsApp] [🐦 Twitter/X] [📘 Facebook]
```

#### כרטיסי שיתוף (OG Cards)

כל שיתוף מייצר תצוגה מקדימה עשירה:

```
┌──────────────────────────────────┐
│ 📊 Knesset Insight               │
│                                  │
│ הצבעה: חוק הגיוס — קריאה שנייה │
│ 67 בעד | 53 נגד                  │
│                                  │
│ [תמונת ויזואליזציה בזעיר]       │
│                                  │
│ knesset-insight.org/votes/12345  │
└──────────────────────────────────┘
```

**יישום טכני:**

- Dynamic OG images via `@vercel/og` (Edge Runtime)
- מותאם לכל ישות (חה"כ, הצבעה, חוק)
- תמיכה ב-RTL בתמונות

#### "Embed Card" — לאתרים חיצוניים

אפשרות להטמיע widget של Knesset Insight באתרים אחרים:

```html
<iframe
  src="https://knesset-insight.org/embed/vote/12345"
  width="400"
  height="300"
  frameborder="0"
>
</iframe>
```

**סוגי Embed:**

- כרטיס חבר כנסת (תמונה + דירוג + סטטיסטיקות)
- תוצאת הצבעה (גרף בעד/נגד)
- סטטוס חוק (timeline)

---

## ניהול קהילה

### תפקידים

| תפקיד                | יכולות                                   |
| -------------------- | ---------------------------------------- |
| **משתמש**            | דירוג, תגובה, מעקב, דיווח                |
| **מנחה (Moderator)** | ביקורת תגובות, הסתרה, אזהרות             |
| **אדמין**            | ניהול מנחים, חסימת משתמשים, הגדרות מערכת |

### מערכת דיווח (Report)

```typescript
export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  reporterId: uuid('reporter_id')
    .notNull()
    .references(() => profiles.id),
  targetType: text('target_type').notNull(), // comment | rating | user
  targetId: text('target_id').notNull(),
  reason: text('reason').notNull(), // spam | hate | misinformation | harassment | other
  details: text('details'), // פירוט אופציונלי
  status: text('status').default('pending'), // pending | reviewed | resolved | dismissed
  reviewedBy: uuid('reviewed_by').references(() => profiles.id),
  resolution: text('resolution'),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### מדיניות חסימה

| הפרה                | תגובה             |
| ------------------- | ----------------- |
| הפרה ראשונה         | אזהרה + הסרת תוכן |
| הפרה שנייה          | השעיה 7 ימים      |
| הפרה שלישית         | השעיה 30 ימים     |
| הפרה רביעית / חמורה | חסימה לצמיתות     |

---

## סכמת נתונים מצרפית (Aggregation)

לביצועים — שמירת נתונים מצרפיים בטבלה נפרדת:

```typescript
export const entityStats = pgTable(
  'entity_stats',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    followersCount: integer('followers_count').default(0),
    ratingsCount: integer('ratings_count').default(0),
    averageRating: real('average_rating'),
    commentsCount: integer('comments_count').default(0),
    viewsCount: integer('views_count').default(0),
    interestScore: real('interest_score').default(0),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    uniqueEntity: unique().on(table.entityType, table.entityId),
    scoreIdx: index('idx_entity_stats_score').on(
      table.entityType,
      table.interestScore,
    ),
  }),
);
```

**עדכון:** Job מתוזמן כל 15 דקות שמחשב מחדש את ה-aggregates.

---

## תעדוף פיתוח (שכבה שלישית)

### קריטי (P0) — לפני השקת שכבה 3

1. Content moderation pipeline (AI + ידני)
2. Anti-manipulation mechanisms
3. Disclaimers ותנאי שימוש
4. דירוג ציבורי מצרפי
5. מונה עוקבים

### חשוב (P1)

6. תגובות ציבוריות (עם moderation)
7. Leaderboard
8. כפתורי שיתוף + OG cards
9. מדד עניין ציבורי
10. מערכת דיווח

### רצוי (P2)

11. Embed cards
12. סטטיסטיקות קהילתיות מתקדמות
13. מנגנון מנחים (Moderators)
14. API ציבורי לנתונים מצרפיים

---

## שיקולים אתיים

### 1. ניטרליות אלגוריתמית

- **Default sort = כרונולוגי**, לא לפי "פופלריות"
- אין "המלצות" שמבוססות על editing מגמתי
- אלגוריתם rating שקוף ומפורסם (open source)

### 2. מניעת Echo Chamber

- הצגת **כל** הדירוגים — לא רק מי שמסכים עם המשתמש
- "תגובות מהצד השני" — הצגה מכוונת של דעות מנוגדות
- אין personalized feed שמסנן דעות

### 3. שקיפות

- מתודולוגיית חישוב הדירוג — פתוחה ומתועדת
- מספר מדרגים תמיד מוצג
- disclaimer בכל מקום שיש נתונים קהילתיים
- הבחנה ברורה בין "נתון רשמי" ל"דירוג משתמשים"

### 4. הגנה על חברי כנסת

למרות שחברי כנסת הם דמויות ציבוריות:

- אין אפשרות לתגובות ישירות על חה"כ (רק על הצבעות/חוקים)
- אין "wall of shame"
- דירוג הוא מנומק (קריטריונים) ולא "אהבתי/לא אהבתי"
- אין מידע אישי מעבר למה שפומבי
