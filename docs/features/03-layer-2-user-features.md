# 03 — שכבה שנייה: רישום משתמש, מעקב, דירוג והתראות

## עקרון מנחה

> משתמש רשום מקבל **חוויה מותאמת אישית** — לעקוב אחרי מה שמעניין אותו,
> לדרג לפי הערכתו, ולקבל התראות בזמן אמת. הכל בתוך מרחב פרטי ואישי.

---

## תנאי מוקדם: מערכת אותנטיקציה

### מצב נוכחי

- `src/lib/auth/` — תיקייה ריקה מוכנה
- tRPC context מוכן לקבל user: `interface Context { /* auth user */ }`
- Route groups מוכנים: `(auth)` לדפי כניסה, `(dashboard)` לדפים מוגנים
- Supabase Auth מוגדר כ-stack

### יישום נדרש

#### שיטות אימות

| שיטה               | עדיפות | הערות                   |
| ------------------ | ------ | ----------------------- |
| Email + Password   | P0     | בסיסי, חובה             |
| Magic Link (Email) | P0     | חוויה חלקה, בלי סיסמאות |
| Google OAuth       | P1     | נוחות                   |
| GitHub OAuth       | P2     | קהילת מפתחים            |
| Apple Sign-In      | P2     | משתמשי iOS              |

#### טבלאות חדשות בסכמה

```typescript
// profiles — מאחסן מידע נוסף על המשתמש מעבר ל-Supabase auth
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(), // = Supabase auth.users.id
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  locale: text('locale').default('he'),
  emailNotifications: boolean('email_notifications').default(true),
  pushNotifications: boolean('push_notifications').default(false),
  publicProfile: boolean('public_profile').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

#### Middleware

```typescript
// Auth middleware in proxy.ts
// Protected routes: /[locale]/(dashboard)/**
// Auth routes: /[locale]/(auth)/** — redirect if logged in
```

---

## פיצ'רים של משתמש רשום

### 3.1 מעקב (Following / Watchlist)

#### מה אפשר לעקוב אחריו

| ישות           | דוגמה                   | מה המשתמש מקבל                     |
| -------------- | ----------------------- | ---------------------------------- |
| **חבר כנסת**   | "עקוב אחרי יריב לוין"   | כל הצבעה, יוזמת חקיקה, שינוי תפקיד |
| **סיעה/מפלגה** | "עקוב אחרי הליכוד"      | שינויי הרכב, הצבעות סיעתיות        |
| **חוק ספציפי** | "עקוב אחרי חוק הגיוס"   | כל התקדמות: ועדה → קריאה → הצבעה   |
| **ועדה**       | "עקוב אחרי ועדת הכספים" | ישיבות חדשות, נושאים               |
| **נושא/תגית**  | "עקוב אחרי 'חינוך'"     | כל חוק/הצבעה שתוייגו בנושא         |

#### סכמת בסיס נתונים

```typescript
export const userFollows = pgTable(
  'user_follows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    entityType: text('entity_type').notNull(), // 'member' | 'faction' | 'bill' | 'committee' | 'topic'
    entityId: text('entity_id').notNull(), // ID של הישות
    createdAt: timestamp('created_at').defaultNow(),
    // מניעת כפילויות
  },
  (table) => ({
    uniqueFollow: unique().on(table.userId, table.entityType, table.entityId),
    userIdx: index('idx_follows_user').on(table.userId),
    entityIdx: index('idx_follows_entity').on(table.entityType, table.entityId),
  }),
);
```

#### ממשק משתמש

**כפתור מעקב בכל מקום:**

```
┌────────────────────────────────────┐
│ 👤 יריב לוין — הליכוד             │
│ שר המשפטים                         │
│                                    │
│ [★ עוקב ▼]  ← לחץ להסרה/הגדרות  │
│                                    │
│ הגדרות מעקב:                       │
│ ☑ הצבעות         ☑ חקיקה          │
│ ☑ שינוי תפקיד   ☐ ועדות          │
└────────────────────────────────────┘
```

**דשבורד מעקב:**

```
┌──────────────────────────────────────┐
│ 📋 המעקבים שלי                      │
│                                      │
│ חברי כנסת (3)                        │
│ ├── יריב לוין        [הגדרות] [הסר] │
│ ├── יאיר לפיד       [הגדרות] [הסר] │
│ └── אחמד טיבי       [הגדרות] [הסר] │
│                                      │
│ חוקים (2)                            │
│ ├── חוק הגיוס        [הגדרות] [הסר] │
│ └── חוק יסוד: כבוד.. [הגדרות] [הסר] │
│                                      │
│ נושאים (1)                           │
│ └── חינוך            [הגדרות] [הסר] │
└──────────────────────────────────────┘
```

### 3.2 דירוג חברי כנסת (Personal Rating)

#### קונספט

כל משתמש רשום יכול לדרג חברי כנסת **לפי קריטריונים שונים**. הדירוג הוא **אישי** (רק למשתמש עצמו) בשכבה זו — הופך לציבורי בשכבה 3 אם המשתמש מסכים.

#### קריטריוני דירוג

| קריטריון       | תיאור                     | סקאלה  |
| -------------- | ------------------------- | ------ |
| **ביצוע כללי** | הערכה כוללת של חבר הכנסת  | ⭐ 1-5 |
| **אמינות**     | האם עומד בהבטחות?         | ⭐ 1-5 |
| **שקיפות**     | האם פתוח וזמין לציבור?    | ⭐ 1-5 |
| **מקצועיות**   | רמת עבודת הוועדות והחקיקה | ⭐ 1-5 |
| **ייצוג**      | האם מייצג את הבוחרים שלו? | ⭐ 1-5 |

#### סכמה

```typescript
export const userRatings = pgTable(
  'user_ratings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    memberId: integer('member_id')
      .notNull()
      .references(() => members.id),
    overall: smallint('overall'), // 1-5
    reliability: smallint('reliability'),
    transparency: smallint('transparency'),
    professionalism: smallint('professionalism'),
    representation: smallint('representation'),
    comment: text('comment'), // הערה אופציונלית
    isPublic: boolean('is_public').default(false), // שכבה 3
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    uniqueRating: unique().on(table.userId, table.memberId),
    memberIdx: index('idx_ratings_member').on(table.memberId),
  }),
);
```

#### ממשק

```
┌────────────────────────────────────────┐
│ דירוג אישי: יריב לוין                  │
│                                         │
│ ביצוע כללי:   ⭐⭐⭐⭐☆  (4/5)            │
│ אמינות:       ⭐⭐⭐☆☆  (3/5)            │
│ שקיפות:       ⭐⭐☆☆☆  (2/5)            │
│ מקצועיות:     ⭐⭐⭐⭐⭐  (5/5)            │
│ ייצוג:        ⭐⭐⭐☆☆  (3/5)            │
│                                         │
│ הערה: _________________________________│
│                                         │
│ ☐ הפוך לציבורי (שכבה 3)               │
│                                         │
│ [שמור דירוג]                            │
└────────────────────────────────────────┘
```

### 3.3 התראות (Notifications)

#### סוגי התראות

| סוג                     | מה מפעיל                            | ערוצים              |
| ----------------------- | ----------------------------------- | ------------------- |
| **הצבעה חדשה**          | חבר כנסת שעוקבים אחריו הצביע        | In-app, Email, Push |
| **קידום חוק**           | חוק שעוקבים אחריו עבר שלב           | In-app, Email, Push |
| **ישיבת ועדה**          | ועדה שעוקבים אחריה התכנסה           | In-app, Email       |
| **שינוי סיעתי**         | חבר כנסת עבר סיעה                   | In-app, Email, Push |
| **הצבעה "שוברת שורות"** | חבר כנסת הצביע נגד סיעתו            | In-app, Push        |
| **עדכון נושא**          | חוק/הצבעה חדשים בנושא שעוקבים אחריו | In-app, Email       |
| **סיכום שבועי**         | Digest של כל העדכונים של השבוע      | Email               |

#### ארכיטקטורת התראות

```
שינוי בנתונים (sync job)
       │
       ▼
  Event Queue (Supabase Realtime / pg_notify)
       │
       ▼
  Notification Service
       │
       ├── In-App → notifications טבלה → tRPC subscription / polling
       ├── Email → Resend/SendGrid → batch (לא spam)
       └── Push → Web Push API → service worker
```

#### סכמה

```typescript
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // enum של סוגי התראות
    title: text('title').notNull(),
    body: text('body'),
    entityType: text('entity_type'), // member | bill | vote | committee
    entityId: text('entity_id'),
    read: boolean('read').default(false),
    emailSent: boolean('email_sent').default(false),
    pushSent: boolean('push_sent').default(false),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    userIdx: index('idx_notifications_user').on(table.userId),
    readIdx: index('idx_notifications_unread').on(table.userId, table.read),
  }),
);

export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // סוג התראה
    inApp: boolean('in_app').default(true),
    email: boolean('email').default(true),
    push: boolean('push').default(false),
    frequency: text('frequency').default('realtime'), // realtime | daily | weekly
  },
  (table) => ({
    uniquePref: unique().on(table.userId, table.type),
  }),
);
```

#### ממשק התראות

**פעמון התראות (Header):**

```
🔔 (3)  ← מספר התראות שלא נקראו

┌──────────────────────────────────────┐
│ התראות                    [סמן נקרא] │
├──────────────────────────────────────┤
│ 🗳️ יריב לוין הצביע בעד             │
│    "חוק הגיוס — קריאה שנייה"       │
│    לפני 2 שעות                  [→]  │
├──────────────────────────────────────┤
│ 📜 חוק הגיוס עבר לוועדה            │
│    הועבר לוועדת חוץ וביטחון         │
│    לפני 5 שעות                  [→]  │
├──────────────────────────────────────┤
│ ⚡ הצבעה שוברת שורות!               │
│    אחמד טיבי הצביע בעד להצעת...    │
│    אתמול                        [→]  │
├──────────────────────────────────────┤
│ [ראה את כל ההתראות →]               │
└──────────────────────────────────────┘
```

### 3.4 דשבורד אישי

#### מבנה הדשבורד

```
/[locale]/(dashboard)/
├── page.tsx                  ← דף ראשי - סקירה
├── watchlist/
│   └── page.tsx              ← ניהול מעקבים
├── ratings/
│   └── page.tsx              ← הדירוגים שלי
├── notifications/
│   └── page.tsx              ← כל ההתראות
├── settings/
│   ├── page.tsx              ← הגדרות חשבון
│   ├── notifications/
│   │   └── page.tsx          ← העדפות התראות
│   └── privacy/
│       └── page.tsx          ← הגדרות פרטיות
└── ai-chat/
    └── page.tsx              ← צ'אט AI (קיים בתכנית)
```

#### דף ראשי — סקירה

```
┌──────────────────────────────────────────────┐
│ 👋 שלום, ידידיה                               │
│ סקירה יומית — 05.04.2026                      │
├──────────────────────────────────────────────┤
│                                               │
│ 🔔 3 עדכונים חדשים                           │
│ ┌──────────────────────────────────────────┐  │
│ │ • יריב לוין הצביע ב-2 הצבעות          │  │
│ │ • חוק הגיוס עבר לקריאה שנייה           │  │
│ │ • ישיבת ועדת הכספים — מחר 10:00        │  │
│ └──────────────────────────────────────────┘  │
│                                               │
│ 📊 הסיכום שלך                                │
│ ┌──────────┬──────────┬──────────┐            │
│ │ 5 חה"כ   │ 3 חוקים  │ 2 ועדות  │           │
│ │ במעקב    │ במעקב    │ במעקב    │           │
│ └──────────┴──────────┴──────────┘            │
│                                               │
│ 📈 פעילות חברי הכנסת שלך (7 ימים)           │
│ [mini bar chart - כמה הצבעות לכל חה"כ במעקב]│
│                                               │
│ 🗳️ הצבעות בולטות השבוע                       │
│ [רשימת הצבעות קונטרוברסיאליות אחרונות]      │
└──────────────────────────────────────────────┘
```

### 3.5 AI Chat (למשתמשים רשומים)

#### תכולה

צ'אט AI שמאפשר לשאול שאלות בשפה טבעית על נתוני הכנסת:

**דוגמאות שאלות:**

- "איך הצביע יריב לוין בנושאי חינוך בשנה האחרונה?"
- "אילו חוקים יזמה מירב מיכאלי?"
- "השווה את אחוזי הנוכחות של חברי ועדת הכספים"
- "מה המגמה בתקציב הביטחון ב-5 השנים האחרונות?"

#### ארכיטקטורה

```
שאלת משתמש
    │
    ▼
Intent Classification (מה המשתמש רוצה?)
    │
    ├── DB Query → tRPC → תשובה מבוססת נתונים
    ├── RAG → Vector Search → תשובה עם הקשר
    └── General → LLM → תשובה כללית עם disclaimer
    │
    ▼
Response + Sources (תמיד עם מקורות)
```

#### מגבלות (כבר מוגדרות ב-appConfig)

- `dailyChatLimit`: 20 הודעות ליום (ברירת מחדל)
- Rate limiting: 200 בקשות/דקה למשתמשים רשומים
- AI provider: Gemini (ברירת מחדל), OpenAI (fallback)

---

## אבטחה ופרטיות

### Row Level Security (RLS)

```sql
-- משתמש רואה רק את הנתונים שלו
CREATE POLICY "users_own_data" ON user_follows
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_ratings" ON user_ratings
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_notifications" ON notifications
  FOR ALL USING (auth.uid() = user_id);
```

### הגנה מפני ניצול לרעה

| איום                 | הגנה                                    |
| -------------------- | --------------------------------------- |
| Spam ratings         | Rate limit: 10 דירוגים/דקה              |
| Mass following       | מקסימום 100 מעקבים                      |
| Notification bombing | Batching + frequency controls           |
| Data scraping        | Rate limit + CAPTCHA אם צריך            |
| Abusive comments     | Content moderation (AI + manual review) |

### GDPR / פרטיות

- **Right to Export** — ייצוא כל הנתונים האישיים (JSON/CSV)
- **Right to Delete** — מחיקת חשבון מלאה (cascade delete)
- **Consent** — הסכמה ברורה לכל ערוץ התראות
- **Transparency** — דף "מה אנחנו שומרים עליך"
- **Cookie Policy** — מינימום cookies, רק הכרחיים

---

## תעדוף פיתוח (שכבה שנייה)

### קריטי (P0)

1. Supabase Auth — Email + Magic Link
2. טבלת profiles
3. דשבורד בסיסי
4. מעקב אחרי חברי כנסת (follow/unfollow)
5. הגדרות חשבון בסיסיות

### חשוב (P1)

6. מעקב אחרי חוקים וועדות
7. דירוג אישי
8. התראות in-app
9. AI Chat בסיסי
10. סיכום שבועי (email)

### רצוי (P2)

11. Google OAuth
12. Web Push notifications
13. מעקב אחרי נושאים/תגיות
14. AI Chat מתקדם (RAG)
15. ייצוא נתונים אישיים

---

## UX Flows

### Flow: רישום למעקב

```
[דף חבר כנסת] → לחץ "עקוב" → [Modal: הירשם/התחבר]
    ↓ (רישום)
[טופס רישום] → [אימות email] → [חזרה לדף + מעקב מופעל]
    ↓
[ברוכים הבאים! הוספת 1 מעקב. רוצה להוסיף עוד?]
```

### Flow: התראה → פעולה

```
[Push notification: "חוק הגיוס עבר לקריאה שנייה"]
    ↓ (לחיצה)
[דף החוק → כרטיסיית "מצב חקיקה"]
    ↓ (scroll)
[הצבעות קשורות] → [דף הצבעה] → [איך חה"כ שלי הצביע?]
```

### Flow: דירוג ראשון

```
[דף חבר כנסת] → [כרטיסיית "דירוג"]
    ↓
[5 מחוונים ⭐ + הערה אופציונלית]
    ↓
[שמור] → [Toast: "הדירוג נשמר! רוצה להפוך לציבורי?"]
    ↓ (אם כן)
[הופך לציבורי → שכבה 3]
```
