# 12 — דשבורד אדמין מקיף

## 1. חזון

דשבורד אדמין מרכזי לניהול שוטף של הפלטפורמה — אישור סיווגי AI, מתן הרשאות, ניטור מערכת, ניהול תוכן וביקורת על נתונים שנוצרו אוטומטית. הדשבורד מיועד לצוות המנהלים בלבד ומוגן באימות + תפקיד `admin`.

---

## 2. תנאי מוקדם: מערכת הרשאות

### 2.1 טבלת תפקידים

```sql
-- הרחבה לטבלת profiles הקיימת
ALTER TABLE profiles ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
-- enum: 'user' | 'moderator' | 'admin' | 'super_admin'
```

### 2.2 הגדרת תפקידים

| תפקיד | הרשאות |
|--------|---------|
| `user` | שכבה 2 — מעקב, דירוג, AI chat |
| `moderator` | כל הנ"ל + אישור תגובות, טיפול בדיווחים |
| `admin` | כל הנ"ל + אישור סיווגי AI, ניהול נתונים, dashboard מלא |
| `super_admin` | כל הנ"ל + ניהול משתמשים, שינוי תפקידים, גישה לכל ההגדרות |

### 2.3 Middleware וגישה

```typescript
// tRPC: הגנת procedures
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!['admin', 'super_admin'].includes(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next({ ctx });
});

export const moderatorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!['moderator', 'admin', 'super_admin'].includes(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next({ ctx });
});
```

```typescript
// proxy.ts — הגנה על route group
// /[locale]/(dashboard)/admin/** → require admin role
```

---

## 3. מבנה ה-Route

```
src/app/[locale]/(dashboard)/admin/
├── page.tsx                          # סקירה כללית (Overview)
├── loading.tsx
├── layout.tsx                        # Admin layout with sidebar nav
│
├── ai-review/                        # === תור אישור סיווגי AI ===
│   ├── page.tsx                      # תור ביקורת ראשי — כל הסיווגים הממתינים
│   ├── loading.tsx
│   ├── clusters/
│   │   ├── page.tsx                  # אשכולות הצעות חוק (קיים — להעביר לכאן)
│   │   └── loading.tsx
│   ├── integrity/
│   │   ├── page.tsx                  # אירועי יושרה שה-AI סיווג
│   │   └── loading.tsx
│   ├── summaries/
│   │   ├── page.tsx                  # סיכומי AI (הצבעות, ישיבות ועדה, הצעות חוק)
│   │   └── loading.tsx
│   └── elections/
│       ├── page.tsx                  # סיווג מועמדים, רשימות, סקרים
│       └── loading.tsx
│
├── content/                          # === ניהול תוכן ===
│   ├── page.tsx                      # סקירת תוכן כללית
│   ├── comments/
│   │   ├── page.tsx                  # מודרציה של תגובות ציבוריות
│   │   └── loading.tsx
│   ├── reports/
│   │   ├── page.tsx                  # דיווחי משתמשים (flags)
│   │   └── loading.tsx
│   └── ratings/
│       ├── page.tsx                  # ביקורת anomalies בדירוגים
│       └── loading.tsx
│
├── data/                             # === ניהול נתונים ===
│   ├── page.tsx                      # סקירת מצב נתונים
│   ├── sync/
│   │   ├── page.tsx                  # סטטוס סנכרון pipelines
│   │   └── loading.tsx
│   ├── members/
│   │   ├── page.tsx                  # עריכת נתוני חברי כנסת (תמונות, שיוכים)
│   │   └── loading.tsx
│   ├── elections/
│   │   ├── page.tsx                  # ניהול נתוני בחירות (רשימות, מועמדים, סקרים)
│   │   └── loading.tsx
│   └── integrity/
│       ├── page.tsx                  # הוספה + עריכת אירועי יושרה ידנית
│       └── loading.tsx
│
├── users/                            # === ניהול משתמשים (super_admin) ===
│   ├── page.tsx                      # רשימת משתמשים + search
│   ├── loading.tsx
│   └── [id]/
│       ├── page.tsx                  # פרופיל משתמש — שינוי תפקיד, ban, היסטוריה
│       └── loading.tsx
│
└── settings/                         # === הגדרות מערכת ===
    ├── page.tsx                      # הגדרות כלליות
    └── loading.tsx
```

---

## 4. דפי הדשבורד — פירוט

### 4.1 סקירה כללית (Overview) — `/admin`

דף נחיתה עם סקירה מהירה של כל מה שדורש תשומת לב:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Admin Dashboard — סקירה כללית                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  🔴 דורש תשומת לב                           📊 סטטוס מערכת        │
│  ┌──────────────────────────────────┐       ┌────────────────────┐  │
│  │ 23 סיווגי AI ממתינים לאישור     │       │ Pipeline: ✅ תקין  │  │
│  │  ├── 12 אשכולות חקיקה           │       │ Last sync: 2h ago  │  │
│  │  ├── 8 אירועי יושרה             │       │ DB size: 4.2 GB    │  │
│  │  └── 3 סיכומי AI                │       │ Cache hit: 94%     │  │
│  │                                  │       │ Errors (24h): 3    │  │
│  │ 5 תגובות ממתינות למודרציה       │       │ AI tokens: 120K/   │  │
│  │ 2 דיווחי משתמשים פתוחים         │       │           500K     │  │
│  │ 1 anomaly בדירוגים              │       └────────────────────┘  │
│  └──────────────────────────────────┘                               │
│                                                                     │
│  📈 סטטיסטיקות שבועיות                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐               │
│  │ משתמשים  │ │ צפיות    │ │ AI chats │ │ חדשים    │               │
│  │   1,247  │ │  34,891  │ │    892   │ │   +89    │               │
│  │  ↗ +12%  │ │  ↗ +8%   │ │  → +2%   │ │  ↗ +15%  │               │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘               │
│                                                                     │
│  📋 פעולות אחרונות (Activity Log)                                  │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 10:32 admin@ki אישר אשכול #452 (3 הצעות חוק)               │   │
│  │ 10:15 AI סיווג 5 אירועי יושרה חדשים (avg confidence: 0.72) │   │
│  │ 09:45 pipeline sync-votes הסתיים (1,240 עודכנו)             │   │
│  │ 09:30 admin@ki דחה תגובה #8921 (spam)                       │   │
│  │ 08:00 pipeline sync-members הסתיים (0 שינויים)               │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

**קומפוננטות:**
- `AdminOverviewStats.tsx` — כרטיסי סטטיסטיקה
- `PendingReviewSummary.tsx` — סיכום פריטים ממתינים
- `SystemHealthPanel.tsx` — סטטוס pipeline, DB, cache
- `AdminActivityLog.tsx` — לוג פעולות אחרונות

---

### 4.2 תור אישור סיווגי AI — `/admin/ai-review`

#### 4.2a תור ביקורת ראשי

דף מרכזי שמרכז **כל** הסיווגים הממתינים מכל הסוגים:

```
┌─────────────────────────────────────────────────────────────────────┐
│  AI Review Queue                                                    │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ סינון: [הכל ▼] [confidence < 0.6 ▼] [תאריך ▼] [🔍 חיפוש] │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌─ אשכול חקיקה ──────────────────────────────────────────────┐    │
│  │ 🏷️ "תיקון חוק הגיוס" — 3 הצעות                           │    │
│  │ Confidence: 0.45 ████░░░░░░  │  Method: ai                │    │
│  │ AI Reasoning: "הצעות עוסקות בהסדרת גיוס חרדים..."        │    │
│  │ Bills: #1234 (פרטית, אופוזיציה) ← ORIGIN                  │    │
│  │        #1256 (ממשלתית, קואליציה)                           │    │
│  │        #1278 (פרטית, קואליציה)                             │    │
│  │ [✅ אשר] [❌ דחה] [✏️ ערוך] [👁️ פרטים]                   │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌─ אירוע יושרה ──────────────────────────────────────────────┐    │
│  │ ⚖️ "חקירת שחיתות — ח"כ ישראל ישראלי"                      │    │
│  │ Confidence: 0.58 █████░░░░░  │  Category: criminal         │    │
│  │ Severity: serious  │  Source: פרוטוקול ועדת אתיקה          │    │
│  │ AI Summary: "הועלו חשדות לניגוד עניינים..."               │    │
│  │ [✅ אשר] [❌ דחה] [✏️ ערוך] [👁️ מסמך מקור]               │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌─ סיכום AI ─────────────────────────────────────────────────┐    │
│  │ 📝 סיכום הצבעה #5678: "חוק יסוד: הממשלה (תיקון)"        │    │
│  │ Confidence: 0.52 █████░░░░░                                │    │
│  │ Summary: "ההצבעה עסקה בהרחבת סמכויות ראש הממשלה..."       │    │
│  │ [✅ אשר] [❌ דחה] [✏️ ערוך סיכום]                          │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  Showing 1-10 of 23  [◀ הקודם] [הבא ▶]                            │
└─────────────────────────────────────────────────────────────────────┘
```

**סוגי פריטים בתור:**

| סוג | מקור | שדות לביקורת | פעולות |
|-----|------|-------------|--------|
| **אשכול חקיקה** | `bill_clusters` + `bill_cluster_members` | confidence, AI reasoning, bills list, origin | אשר / דחה / ערוך שיוך / שנה origin |
| **אירוע יושרה** | `integrity_cases` | category, severity, AI summary, source | אשר / דחה / ערוך סיווג / שנה חומרה |
| **סיכום AI** | `bills.aiSummary`, `votes.summary`, `committeeSessions.aiSummary` | הטקסט עצמו | אשר / ערוך / מחק |
| **סיווג בחירות** | `electionCandidateLists`, `electionCandidates` | status, position, integrity notes | אשר / ערוך |

#### 4.2b אשכולות חקיקה — `/admin/ai-review/clusters`

הדף שכבר קיים ב-`/admin/clusters` — מועבר לכאן עם שיפורים:
- סטטיסטיקות (total, AI, reviewed, accuracy)
- טופס שיוך ידני
- תור ביקורת ממוין לפי confidence
- Batch actions: אשר/דחה מרובים

#### 4.2c אירועי יושרה — `/admin/ai-review/integrity`

```
┌─────────────────────────────────────────────────────────────────────┐
│  Integrity Cases Review                                             │
│                                                                     │
│  סינון: [category ▼] [severity ▼] [verified: No ▼] [member ▼]     │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ Case #42 — ח"כ yyy                                           │  │
│  │ Category: ethics_complaint → [שנה ▼]                          │  │
│  │ Severity: warning → [שנה ▼]                                   │  │
│  │ Status: reported                                               │  │
│  │                                                                │  │
│  │ AI Summary:                                                    │  │
│  │ "ועדת האתיקה דנה בתלונה בנוגע ל..."                          │  │
│  │ Confidence: 0.48                                               │  │
│  │                                                                │  │
│  │ מקור: פרוטוקול ועדת אתיקה 15.3.2026 [🔗 צפה במקור]          │  │
│  │                                                                │  │
│  │ [✅ אשר (verified)] [❌ דחה (לא רלוונטי)] [✏️ ערוך]          │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  Stats: 45 total │ 37 verified │ 8 pending │ accuracy: 82%         │
└─────────────────────────────────────────────────────────────────────┘
```

**פעולות אדמין:**
- `verify(caseId)` — מסמן כ-verified, שומר verifiedBy + verifiedAt
- `reject(caseId)` — מסמן כ-status: 'closed', שומר reason
- `editCategory(caseId, newCategory)` — שינוי סיווג category/severity
- `editSummary(caseId, newSummary)` — עריכת סיכום AI

#### 4.2d סיכומי AI — `/admin/ai-review/summaries`

ביקורת על סיכומים אוטומטיים שנוצרו ל:
- הצעות חוק (`bills.aiSummary`)
- הצבעות (`votes.summary`)
- ישיבות ועדה (`committeeSessions.aiSummary`)

**פעולות:** אשר / ערוך / מחק / regenerate (שלח מחדש ל-AI)

#### 4.2e סיווגי בחירות — `/admin/ai-review/elections`

ביקורת על נתוני בחירות שנוצרו/עודכנו באופן אוטומטי:
- שיוך מועמדים לרשימות
- סטטוס רשימות (potential → confirmed)
- נתוני סקרים שנטענו
- הערות יושרה למועמדים

---

### 4.3 ניהול תוכן — `/admin/content`

#### 4.3a מודרציה של תגובות — `/admin/content/comments`

```
┌─────────────────────────────────────────────────────────────────────┐
│  Comment Moderation                                                 │
│                                                                     │
│  סינון: [status ▼: flagged] [entityType ▼] [תאריך ▼]              │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ 💬 Comment on Vote #5678 — user: david92                      │  │
│  │ Status: flagged (3 reports)                                    │  │
│  │                                                                │  │
│  │ "הממשלה הזו מושחתת לגמרי ואני מקווה ש..."                    │  │
│  │                                                                │  │
│  │ AI Assessment: borderline (hate speech: 0.35, spam: 0.05)     │  │
│  │                                                                │  │
│  │ Reports:                                                       │  │
│  │  • user_a: "שנאה"                                             │  │
│  │  • user_b: "הסתה"                                             │  │
│  │  • user_c: "לא ענייני"                                        │  │
│  │                                                                │  │
│  │ [✅ אשר (השאר)] [⚠️ הסתר] [❌ הסר] [🔇 השתק משתמש]          │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  Stats: 142 today │ 5 flagged │ 3 removed │ AI auto-approved: 134  │
└─────────────────────────────────────────────────────────────────────┘
```

**Workflow:**
1. תגובה חדשה → AI moderation check
2. אם AI confident שזה OK → auto-publish
3. אם uncertain או flagged → תור ביקורת
4. אם community flags ≥ 3 → אוטומטית לתור
5. Admin מחליט: אשר / הסתר / הסר / השתק משתמש

#### 4.3b דיווחי משתמשים — `/admin/content/reports`

דיווחים כלליים על תוכן בעייתי (תגובות, דירוגים):
- סוג הדיווח (שנאה, spam, fake, harassment)
- תוכן מדווח + הקשר
- היסטוריית דיווחים של אותו משתמש
- פעולות: סגור (לא מוצדק) / הסר תוכן / אזהרה / ban

#### 4.3c ביקורת anomalies בדירוגים — `/admin/content/ratings`

זיהוי דפוסים חריגים בדירוגים ציבוריים:
- **Brigading detection**: spike פתאומי בדירוגים לח"כ ספציפי
- **Bot detection**: חשבונות חדשים שמדרגים באופן מסיבי
- **Statistical outliers**: חשבונות עם דפוסי דירוג חריגים (תמיד 1 או תמיד 5)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Rating Anomalies                                                   │
│                                                                     │
│  🔴 Alert: Spike detected — ח"כ yyy                                │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ 47 new ratings in last 2 hours (normal avg: 3/hour)          │  │
│  │ 89% gave rating ≤ 2 (normal distribution: bell curve)        │  │
│  │                                                                │  │
│  │ Suspected accounts (age < 7 days): 31                         │  │
│  │                                                                │  │
│  │ [🔍 פרטי חשבונות] [⏸️ הקפא דירוגים] [🗑️ מחק חשודים]       │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 4.4 ניהול נתונים — `/admin/data`

#### 4.4a סטטוס סנכרון — `/admin/data/sync`

מעקב בזמן אמת אחרי pipelines:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Pipeline Status                                                    │
│                                                                     │
│  Job                  │ Last Run      │ Status │ Duration │ Items  │
│  ─────────────────────┼───────────────┼────────┼──────────┼─────── │
│  sync-members         │ 08:00 today   │ ✅     │ 45s      │ 0     │
│  sync-votes           │ 09:45 today   │ ✅     │ 3m 12s   │ 1,240 │
│  sync-bills           │ 09:30 today   │ ✅     │ 1m 24s   │ 87    │
│  sync-committees      │ 08:15 today   │ ✅     │ 22s      │ 3     │
│  sync-integrity       │ 04:00 today   │ ✅     │ 8m 45s   │ 12    │
│  gen-bill-embeddings  │ 05:00 today   │ ✅     │ 15m 30s  │ 87    │
│  compute-clusters     │ 05:30 today   │ ✅     │ 2m 10s   │ 5     │
│  ai-cluster-bills     │ 06:00 today   │ ⚠️     │ 45m      │ 3/8   │
│  sync-lobbyists       │ 04:15 today   │ ✅     │ 1m 05s   │ 0     │
│                                                                     │
│  [▶ הרץ ידנית ▼]  [📋 לוגים]  [⚙️ הגדר cron]                     │
│                                                                     │
│  ─── שגיאות אחרונות ───                                            │
│  ⚠️ ai-cluster-bills: Token budget exceeded (450K/500K)             │
│     3 clusters skipped — will retry tomorrow                        │
│  ❌ sync-votes (yesterday 15:00): OData timeout after 30s           │
│     Auto-retried successfully at 15:06                              │
└─────────────────────────────────────────────────────────────────────┘
```

**פעולות:**
- הפעלת sync ידנית (כל job בנפרד או כולם)
- צפייה בלוגים מפורטים
- שינוי cron schedule
- מעקב שימוש ב-AI tokens

#### 4.4b ניהול חברי כנסת — `/admin/data/members`

עריכת נתונים שלא מגיעים אוטומטית מ-API:
- **תמונות**: אישור/החלפת תמונות חברי כנסת
- **שיוכים**: תיקון שיוך לסיעה/מפלגה (כשה-API שגוי)
- **vipId mapping**: תיקון מיפוי זיהויים (כפי שקיים ב-scripts)
- **Merge duplicates**: איחוד רשומות כפולות

#### 4.4c ניהול בחירות — `/admin/data/elections`

ניהול מלא של נתוני בחירות 2026 (ולאחר מכן כלליות):
- הוספה/עריכה של רשימות מועמדים
- עדכון סטטוסים (potential → confirmed → withdrawn)
- הזנת סקרים חדשים (pollster, date, results per list)
- ניהול אירועי Timeline
- עדכון ballot letters

#### 4.4d ניהול אירועי יושרה — `/admin/data/integrity`

הוספה ידנית של אירועי יושרה (כש-AI לא תפס):
- טופס מלא ליצירת `integrity_case` חדש
- חיבור מסמכי מקור
- קישור בין אירועים (integrity_case_links)
- עדכון ציון יושרה ידנית

---

### 4.5 ניהול משתמשים — `/admin/users`

**גישה: super_admin בלבד**

```
┌─────────────────────────────────────────────────────────────────────┐
│  Users Management                                                   │
│                                                                     │
│  [🔍 חיפוש email/שם]  [role ▼: הכל]  [status ▼: הכל]             │
│                                                                     │
│  User              │ Email             │ Role  │ Joined    │ Status │
│  ──────────────────┼───────────────────┼───────┼───────────┼─────── │
│  דוד כהן           │ david@example.com │ user  │ 1.1.2026 │ active │
│  רחל לוי           │ rachel@test.com   │ mod   │ 3.2.2026 │ active │
│  spam_user_42      │ spam@fake.com     │ user  │ 7.4.2026 │ banned │
│                                                                     │
│  Click user → User Detail:                                          │
│  • שינוי תפקיד (user → moderator → admin)                          │
│  • Ban / Unban                                                      │
│  • פעילות: מעקבים, דירוגים, תגובות, AI chats                       │
│  • היסטוריית penalties (אזהרות, השעיות)                             │
│  • מחיקת חשבון (GDPR)                                               │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 4.6 הגדרות מערכת — `/admin/settings`

ממשק UI לשינוי ערכים שמוגדרים ב-`app.config.ts` + env vars (ללא deployment):

| קטגוריה | הגדרות |
|---------|--------|
| **AI** | confidence threshold, daily token budget, provider (Gemini/OpenAI/Anthropic) |
| **Rate Limits** | daily chat limit, rating cooldown, comment rate limit |
| **Sync** | cron schedules, retry count, timeout |
| **Moderation** | auto-publish threshold, min flags for review, min raters for public |
| **Elections** | campaign status toggle, estimated election date |
| **Feature Flags** | enable/disable: AI chat, public ratings, comments, elections page |

> **חשוב:** שינויים ב-settings נשמרים ב-DB (`admin_settings` table) ו-override את app.config defaults. כל שינוי נרשם ב-audit log.

---

## 5. טבלאות DB חדשות

### 5.1 Admin Activity Log

```sql
CREATE TABLE admin_activity_log (
  id            SERIAL PRIMARY KEY,
  admin_id      UUID NOT NULL REFERENCES profiles(id),
  action        TEXT NOT NULL,        -- 'approve_cluster' | 'reject_integrity' | 'ban_user' | ...
  entity_type   TEXT NOT NULL,        -- 'bill_cluster' | 'integrity_case' | 'comment' | 'user' | ...
  entity_id     TEXT NOT NULL,        -- ID of affected entity
  details       JSONB DEFAULT '{}',   -- action-specific data (old value, new value, reason)
  ip_address    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_admin_log_admin ON admin_activity_log(admin_id);
CREATE INDEX idx_admin_log_created ON admin_activity_log(created_at DESC);
CREATE INDEX idx_admin_log_entity ON admin_activity_log(entity_type, entity_id);
```

### 5.2 Admin Settings Override

```sql
CREATE TABLE admin_settings (
  id            SERIAL PRIMARY KEY,
  key           TEXT UNIQUE NOT NULL,      -- 'ai.confidenceThreshold' | 'moderation.minFlags' | ...
  value         JSONB NOT NULL,            -- the value (typed in application)
  updated_by    UUID REFERENCES profiles(id),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.3 Content Reports (community flags)

```sql
CREATE TABLE content_reports (
  id              SERIAL PRIMARY KEY,
  reporter_id     UUID NOT NULL REFERENCES profiles(id),
  entity_type     TEXT NOT NULL,          -- 'comment' | 'rating'
  entity_id       TEXT NOT NULL,
  reason          TEXT NOT NULL,          -- 'hate_speech' | 'spam' | 'misinformation' | 'harassment' | 'other'
  description     TEXT,                   -- הסבר חופשי
  status          TEXT DEFAULT 'open',    -- 'open' | 'reviewed' | 'actioned' | 'dismissed'
  reviewed_by     UUID REFERENCES profiles(id),
  reviewed_at     TIMESTAMPTZ,
  action_taken    TEXT,                   -- 'removed' | 'hidden' | 'warned' | 'banned' | 'none'
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reports_status ON content_reports(status);
CREATE INDEX idx_reports_entity ON content_reports(entity_type, entity_id);
```

### 5.4 User Penalties

```sql
CREATE TABLE user_penalties (
  id              SERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES profiles(id),
  penalty_type    TEXT NOT NULL,          -- 'warning' | 'mute_24h' | 'mute_7d' | 'ban'
  reason          TEXT NOT NULL,
  issued_by       UUID NOT NULL REFERENCES profiles(id),
  expires_at      TIMESTAMPTZ,            -- NULL = permanent
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_penalties_user ON user_penalties(user_id);
```

---

## 6. tRPC Routers חדשים

### 6.1 Admin Router — `src/server/routers/admin.ts`

```typescript
// === AI Review ===
admin.aiReview.pendingCount       // → { clusters: 12, integrity: 8, summaries: 3, elections: 0 }
admin.aiReview.listPending        // → paginated list of all pending items (union type)

// === Clusters (migrate from bill-clusters mutations) ===
admin.clusters.approve            // → mark verified, set confidence 1.0
admin.clusters.reject             // → remove AI links
admin.clusters.editOrigin         // → change is_origin flag
admin.clusters.manualLink         // → add bill to cluster manually
admin.clusters.stats              // → dashboard stats

// === Integrity ===
admin.integrity.listUnverified    // → unverified integrity cases, sorted by confidence
admin.integrity.verify            // → set verified=true, verifiedBy, verifiedAt
admin.integrity.reject            // → set status='closed'
admin.integrity.editCategory      // → change category/severity
admin.integrity.editSummary       // → edit AI summary text
admin.integrity.create            // → create manual integrity case
admin.integrity.stats             // → review stats

// === AI Summaries ===  
admin.summaries.listPending       // → summaries that haven't been reviewed
admin.summaries.approve           // → mark as reviewed
admin.summaries.edit              // → update summary text
admin.summaries.regenerate        // → trigger new AI summary
admin.summaries.delete            // → remove summary

// === Content Moderation ===
admin.comments.listFlagged        // → comments with status=flagged or reports≥3
admin.comments.approve            // → set status=active (dismiss flags)
admin.comments.hide               // → set status=hidden
admin.comments.remove             // → set status=removed
admin.comments.muteUser           // → create penalty for comment author

admin.reports.listOpen            // → open content reports
admin.reports.review              // → mark reviewed + action taken
admin.reports.dismiss             // → status='dismissed'

admin.ratings.anomalies           // → detected rating anomalies
admin.ratings.freezeEntity        // → temporarily freeze ratings for entity
admin.ratings.removeSuspect       // → delete suspected bot/brigade ratings

// === Data Management ===
admin.sync.status                 // → pipeline status for all jobs  
admin.sync.triggerJob             // → trigger specific sync job manually
admin.sync.logs                   // → recent sync logs

admin.members.list                // → admin view with editable fields
admin.members.edit                // → update member data (image, faction, etc.)

admin.elections.editList          // → update election candidate list
admin.elections.addPoll           // → add new poll with results
admin.elections.editTimeline      // → add/edit timeline events
admin.elections.editCandidate     // → edit candidate details

// === User Management (super_admin) ===
admin.users.list                  // → paginated user list with search
admin.users.byId                  // → user detail + activity summary
admin.users.changeRole            // → update user role
admin.users.ban                   // → ban user
admin.users.unban                 // → unban user
admin.users.issuePenalty          // → create warning/mute/ban
admin.users.deleteAccount         // → GDPR delete

// === Settings ===
admin.settings.getAll             // → all settings (with defaults from appConfig)
admin.settings.update             // → update setting value

// === Activity Log ===
admin.activityLog.list            // → paginated admin activity log
```

---

## 7. קומפוננטות UI חדשות

```
src/components/admin/
├── AdminLayout.tsx                 # Layout עם sidebar navigation
├── AdminSidebar.tsx                # תפריט צד עם סעיפים + badge counts
├── AdminOverviewStats.tsx          # כרטיסי סטטיסטיקה בדף הראשי
├── PendingReviewSummary.tsx        # סיכום פריטים ממתינים
├── SystemHealthPanel.tsx           # סטטוס pipeline + system metrics
├── AdminActivityLog.tsx            # לוג פעולות (table + filters)
├── AdminActionButtons.tsx          # כפתורי approve/reject/edit גנריים
├── AdminBadge.tsx                  # Badge עם ספירה בתפריט
│
├── ai-review/
│   ├── AIReviewQueue.tsx           # תור ביקורת ראשי (unified)
│   ├── AIReviewCard.tsx            # כרטיס פריט בודד (polymorphic)
│   ├── ClusterReviewCard.tsx       # כרטיס ביקורת אשכול
│   ├── IntegrityReviewCard.tsx     # כרטיס ביקורת אירוע יושרה
│   ├── SummaryReviewCard.tsx       # כרטיס ביקורת סיכום
│   ├── ConfidenceBar.tsx           # מד confidence ויזואלי
│   └── BatchActions.tsx            # אישור/דחייה מרובים
│
├── content/
│   ├── CommentModerationCard.tsx   # כרטיס מודרציה של תגובה
│   ├── ReportCard.tsx              # כרטיס דיווח משתמש
│   ├── RatingAnomalyCard.tsx       # כרטיס anomaly
│   └── ModerationFilters.tsx       # סינון (status, type, date)
│
├── data/
│   ├── PipelineStatusTable.tsx     # טבלת סטטוס pipelines
│   ├── SyncLogViewer.tsx           # צפייה בלוגים
│   ├── MemberEditForm.tsx          # טופס עריכת חבר כנסת
│   ├── ElectionDataManager.tsx     # ניהול נתוני בחירות
│   ├── IntegrityCaseForm.tsx       # טופס יצירת/עריכת אירוע יושרה
│   └── PollInputForm.tsx           # טופס הזנת סקר חדש
│
├── users/
│   ├── UserTable.tsx               # טבלת משתמשים
│   ├── UserDetail.tsx              # פרופיל משתמש מפורט
│   ├── RoleSelector.tsx            # בחירת תפקיד (dropdown)
│   └── PenaltyDialog.tsx           # הטלת penalty (modal)
│
└── settings/
    ├── SettingsForm.tsx            # טופס הגדרות (dynamic from config)
    ├── SettingField.tsx            # שדה הגדרה בודד (number, toggle, select)
    └── FeatureFlagsPanel.tsx       # panel של feature flags
```

---

## 8. i18n — namespace: `admin`

הרחבת ה-namespace הקיים `admin` ב-4 שפות:

```json
{
  "admin": {
    "title": "דשבורד ניהול",
    "overview": {
      "title": "סקירה כללית",
      "pendingReview": "ממתינים לביקורת",
      "systemHealth": "סטטוס מערכת",
      "weeklyStats": "סטטיסטיקות שבועיות",
      "activityLog": "לוג פעולות"
    },
    "aiReview": {
      "title": "תור אישור AI",
      "clusters": "אשכולות חקיקה",
      "integrity": "אירועי יושרה",
      "summaries": "סיכומי AI",
      "elections": "סיווגי בחירות",
      "confidence": "רמת ודאות",
      "aiReasoning": "נימוק AI",
      "approve": "אשר",
      "reject": "דחה",
      "edit": "ערוך",
      "viewSource": "צפה במקור",
      "batchApprove": "אשר מסומנים",
      "batchReject": "דחה מסומנים"
    },
    "content": {
      "title": "ניהול תוכן",
      "comments": "מודרציה — תגובות",
      "reports": "דיווחי משתמשים",
      "ratings": "ביקורת דירוגים",
      "hide": "הסתר",
      "remove": "הסר",
      "muteUser": "השתק משתמש",
      "flagged": "מדווח",
      "autoApproved": "אושר אוטומטית"
    },
    "data": {
      "title": "ניהול נתונים",
      "sync": "סטטוס סנכרון",
      "members": "חברי כנסת",
      "elections": "בחירות",
      "integrityManual": "אירועי יושרה (ידני)",
      "triggerSync": "הרץ סנכרון",
      "lastRun": "ריצה אחרונה",
      "duration": "משך",
      "itemsUpdated": "עודכנו"
    },
    "users": {
      "title": "ניהול משתמשים",
      "search": "חיפוש משתמש",
      "role": "תפקיד",
      "changeRole": "שנה תפקיד",
      "ban": "חסום",
      "unban": "שחרר חסימה",
      "issuePenalty": "הטל עונש",
      "deleteAccount": "מחק חשבון",
      "activity": "פעילות"
    },
    "settings": {
      "title": "הגדרות מערכת",
      "ai": "הגדרות AI",
      "rateLimits": "מגבלות קצב",
      "sync": "סנכרון",
      "moderation": "מודרציה",
      "elections": "בחירות",
      "featureFlags": "Feature Flags",
      "saved": "הגדרות נשמרו"
    }
  }
}
```

---

## 9. שלבי יישום

### Phase A: תשתית + הגנה (תנאי מוקדם: auth קיים)

| # | משימה | תלות |
|---|-------|------|
| A1 | הוספת `role` ל-profiles + migration | — |
| A2 | יצירת `adminProcedure` + `moderatorProcedure` ב-tRPC | A1 |
| A3 | הגנת route `/admin/**` ב-proxy.ts | A1 |
| A4 | העברת mutations קיימות (`approve`, `reject`, `manualLink`) ל-`adminProcedure` | A2 |
| A5 | DB: `admin_activity_log` + `admin_settings` + `content_reports` + `user_penalties` | — |
| A6 | Admin layout + sidebar component | — |

### Phase B: תור AI Review

| # | משימה | תלות |
|---|-------|------|
| B1 | Admin overview page (stats + pending summary) | A6 |
| B2 | העברת `/admin/clusters` → `/admin/ai-review/clusters` (refactor existing) | A4, A6 |
| B3 | Integrity review page (`/admin/ai-review/integrity`) | A6 |
| B4 | AI summaries review page | A6 |
| B5 | Unified review queue (`/admin/ai-review`) | B2, B3, B4 |
| B6 | Elections review page | A6 |

### Phase C: ניהול תוכן (תנאי: שכבה 3 קיימת)

| # | משימה | תלות |
|---|-------|------|
| C1 | Comment moderation page | שכבה 3 comments |
| C2 | Content reports page + tRPC | C1 |
| C3 | Rating anomaly detection + page | שכבה 3 public ratings |
| C4 | Moderation AI pipeline integration | C1 |

### Phase D: ניהול נתונים

| # | משימה | תלות |
|---|-------|------|
| D1 | Pipeline status page | A6 |
| D2 | Sync trigger + logs viewer | D1 |
| D3 | Member edit page | A6 |
| D4 | Elections data management page | A6, elections feature |
| D5 | Integrity manual creation page | A6 |

### Phase E: ניהול משתמשים (תנאי: auth מלא)

| # | משימה | תלות |
|---|-------|------|
| E1 | Users list + search page | A1 |
| E2 | User detail + role management | E1 |
| E3 | Ban / penalty system | E2 |
| E4 | GDPR account deletion | E2 |

### Phase F: הגדרות מערכת

| # | משימה | תלות |
|---|-------|------|
| F1 | Settings page + form | A5, A6 |
| F2 | Override mechanism (DB overrides appConfig) | F1 |
| F3 | Feature flags toggle | F1 |

---

## 10. תלויות

```
Phase A (תשתית) ──────→ Phase B (AI review)
       │                        │
       │                        ├──→ Phase D (data management)
       │                        │
       ├──→ Phase E (users)     ├──→ Phase F (settings)
       │
       └── Phase C (content) ←── שכבה 3 חברתית
```

**מה אפשר להתחיל עכשיו (גם ללא auth):**
- Phase B2: refactor `/admin/clusters` to new location
- Phase D1: pipeline status page (read-only)
- Phase A5: DB migrations (טבלאות חדשות)
- Phase A6: Admin layout + sidebar

**מה דורש auth:**
- Phase A1-A4: roles + procedure protection
- Phase C: content moderation (needs social layer)
- Phase E: user management

---

## 11. אבטחה

| סיכון | מיטיגציה |
|-------|----------|
| גישה לא מורשית ל-admin | `adminProcedure` + route middleware + RLS |
| CSRF על mutations | tRPC default CSRF protection |
| Privilege escalation | רק `super_admin` יכול לשנות roles |
| Data tampering דרך admin | Audit log לכל פעולה |
| Admin takeover | 2FA ל-admin accounts (Phase 2) |
| Over-privileged admin | Minimal role model (user → mod → admin → super_admin) |

---

## 12. עריכת נתונים אינליין (Inline Admin Editing)

### 12.1 הרעיון

מנהל עם הרשאות מתאימות לא צריך להגיע תמיד לדשבורד כדי לערוך נתונים — הוא יכול לעשות זאת ישירות מהדפים הציבוריים. כשאדמין גולש באתר, הוא רואה כפתורי עריכה צפים ליד כל אלמנט שניתן לערוך.

### 12.2 למה זה קריטי

מערכת הקישורים בין הצבעות לחקיקות מורכבת מאוד:
- הצבעה יכולה להיות מקושרת לחוק שגוי (API מחזיר billId לא מדויק)
- חוק יכול להיות בשלב שגוי (statusId לא מעודכן ב-API)
- אשכולות חקיקה יכולים לכלול הצעות שלא קשורות או לחסר הצעות רלוונטיות
- אירועי יושרה מסווגים שגוי ע"י ה-AI

כש-admin רואה שגיאה בדף ציבורי, הוא צריך לתקן אותה **במקום** — לא לחפש את הרשומה בדשבורד.

### 12.3 מבנה טכני

```
┌─────────────────────────────────────────────────────────────────────┐
│  AdminEditProvider (context)                                        │
│  ├── מספק isAdmin flag דרך React Context                            │
│  ├── נטען ב-root layout, בודק session + role                       │
│  └── כל קומפוננטת inline-edit מתנה את הצגתה ב-isAdmin              │
│                                                                     │
│  InlineEditWrapper (generic)                                        │
│  ├── עוטף כל אלמנט שניתן לערוך                                     │
│  ├── מציג אייקון עריכה (🖊) בפינה כש-isAdmin=true                  │
│  ├── לחיצה פותחת modal/popover עם טופס עריכה                       │
│  └── שומר דרך tRPC mutation → admin.inline.*                       │
└─────────────────────────────────────────────────────────────────────┘
```

### 12.4 סוגי עריכה אינליין

#### א. עריכת שיוך הצבעה-חקיקה (Vote ↔ Bill linking)

**איפה:** דף פרטי הצבעה (`/votes/[id]`), דף פרטי חקיקה (`/legislation/[id]`)

```
┌─────────────────────────────────────────────────┐
│  הצבעה: חוק הגיוס — קריאה שנייה                │
│  מקושרת ל: [חוק הגיוס #1234]  [🖊]             │
│                                                  │
│  לחיצה על 🖊 →                                  │
│  ┌────────────────────────────────────────┐      │
│  │ שנה שיוך הצבעה                        │      │
│  │                                        │      │
│  │ חקיקה נוכחית: חוק הגיוס #1234         │      │
│  │ [🔍 חיפוש חקיקה אחרת...]              │      │
│  │                                        │      │
│  │ אשכול:  [חוק הגיוס (אשכול #56)]      │      │
│  │ [🔍 חיפוש אשכול אחר...]              │      │
│  │                                        │      │
│  │ נימוק: [________________]              │      │
│  │ [💾 שמור] [❌ בטל]                     │      │
│  └────────────────────────────────────────┘      │
└─────────────────────────────────────────────────┘
```

**Mutations:**
- `admin.inline.relinkVote({ voteId, newBillId, reason })` — שינוי שיוך הצבעה לחוק אחר
- `admin.inline.unlinkVote({ voteId, reason })` — ניתוק הצבעה מחוק

#### ב. עריכת שלב חקיקה (Bill Stage Override)

**איפה:** דף פרטי חקיקה (`/legislation/[id]`), ברכיב ה-stage pipeline

```
┌─────────────────────────────────────────────────┐
│  חוק הגיוס — שלבי חקיקה                        │
│                                                  │
│  [הגשה]──[טרומי]──[ועדה]──[קריאה 1]──[ועדה]──│
│     ✓       ✓        ✓       ✓       ● ← [🖊] │
│                                                  │
│  לחיצה על 🖊 →                                  │
│  ┌────────────────────────────────────────┐      │
│  │ שנה שלב חקיקה                         │      │
│  │                                        │      │
│  │ שלב נוכחי: 4 (ועדה — קריאה 2+3)      │      │
│  │ StatusID: 113                          │      │
│  │                                        │      │
│  │ שנה ל: [שלב ▼]                        │      │
│  │   0 — הגשה                            │      │
│  │   1 — דיון מוקדם                      │      │
│  │   2 — ועדה (קריאה ראשונה)             │      │
│  │   3 — קריאה ראשונה                    │      │
│  │ ● 4 — ועדה (קריאה 2+3)  ← נוכחי      │      │
│  │   5 — קריאה 2+3                       │      │
│  │   6 — התקבלה                          │      │
│  │                                        │      │
│  │ StatusID חדש: [▼ בחר]                  │      │
│  │ נימוק: [________________]              │      │
│  │ [💾 שמור] [❌ בטל]                     │      │
│  └────────────────────────────────────────┘      │
└─────────────────────────────────────────────────┘
```

**Mutations:**
- `admin.inline.overrideBillStage({ billId, newStatusId, reason })` — שינוי שלב חקיקה

#### ג. עריכת שיוך בין חקיקות (Bill ↔ Cluster)

**איפה:** דף פרטי חקיקה, באזור "הצעות קשורות" / "אשכול חקיקה"

```
┌─────────────────────────────────────────────────┐
│  אשכול: חוק הגיוס (4 הצעות)   [🖊]            │
│  ├── #1234 חוק הגיוס (ממשלתית) ← מקור  [🖊]   │
│  ├── #1256 חוק שירות לאומי (פרטית)      [🖊]   │
│  ├── #1278 חוק גיוס שוויוני (פרטית)     [🖊]   │
│  └── #1290 הוכנה לקריאה בועדה (פרטית)   [🖊]   │
│                                                  │
│  [🖊] על אשכול → שנה שם/תיאור, מחק אשכול      │
│  [🖊] על הצעה → הסר מאשכול, העבר לאשכול אחר,   │
│                 שנה origin, שנה confidence        │
│  [+ הוסף הצעה לאשכול]                           │
└─────────────────────────────────────────────────┘
```

**Mutations:**
- `admin.inline.moveBillToCluster({ billId, fromClusterId, toClusterId, reason })`
- `admin.inline.removeBillFromCluster({ billId, clusterId, reason })`
- `admin.inline.setClusterOrigin({ clusterId, billId, reason })`
- `admin.inline.editClusterMeta({ clusterId, name?, description?, category? })`

#### ד. עריכת סיווג יושרה (Integrity Case)

**איפה:** דף פרופיל חבר כנסת, בחלק של "כרטיס יושרה"

**פעולות:**
- שינוי category / severity
- אישור (verified)
- עריכת סיכום / תיאור
- הסרת אירוע שגוי

#### ה. עריכת נתוני חבר כנסת (Member Override)

**איפה:** דף פרופיל חבר כנסת

**פעולות:**
- תיקון שם (typos)
- שינוי תמונה
- תיקון שיוך סיעתי
- הוספת/עריכת metadata

### 12.5 קומפוננטות UI

```
src/components/admin/
├── AdminEditProvider.tsx          # React Context — isAdmin flag
├── InlineEditWrapper.tsx          # Generic wrapper — shows 🖊 icon for admins
├── InlineEditPopover.tsx          # Popover container for edit forms
├── inline/
│   ├── VoteBillLinker.tsx         # שיוך הצבעה ↔ חקיקה
│   ├── BillStageOverride.tsx      # שינוי שלב חקיקה
│   ├── ClusterMemberEditor.tsx    # עריכת שיוך הצעה ↔ אשכול
│   ├── IntegrityCaseEditor.tsx    # עריכת סיווג יושרה
│   ├── MemberFieldEditor.tsx      # עריכת שדה בפרופיל חה"כ
│   └── EntitySearchInput.tsx      # חיפוש ישויות (bills, clusters, members)
```

### 12.6 Audit Trail

כל עריכה אינליין נרשמת ב-`admin_activity_log`:

```json
{
  "action": "inline_relink_vote",
  "entity_type": "vote",
  "entity_id": "5678",
  "details": {
    "old_bill_id": 1234,
    "new_bill_id": 1256,
    "reason": "ההצבעה שייכת לחוק שירות לאומי, לא לחוק הגיוס"
  }
}
```

### 12.7 חוויית משתמש

- אייקון **🖊** מופיע רק לאדמינים (hidden לחלוטין ממשתמשים רגילים)
- עריכות נשמרות מיידית (optimistic update + revalidation)
- Toast notification לאחר שינוי מוצלח
- שינויים מופיעים ב-activity log בדשבורד
- כל שינוי כולל שדה "נימוק" חובה (accountability)

---

## 13. Relevant Files

### קיימים (לשנות)
- `src/lib/db/schema.ts` — הוספת טבלאות חדשות + role to profiles
- `src/server/routers/index.ts` — רישום admin router
- `src/server/routers/bill-clusters.ts` — העברת mutations ל-adminProcedure
- `src/server/trpc.ts` — הוספת adminProcedure, moderatorProcedure
- `src/server/context.ts` — הזרקת user + role
- `src/proxy.ts` — הגנת /admin routes
- `src/app/[locale]/(dashboard)/admin/clusters/page.tsx` — refactor/move
- `src/i18n/messages/{he,en,ar,ru}.json` — הרחבת admin namespace
- `app.config.ts` — admin-specific config

### חדשים (ליצור)
- `drizzle/XXXX_admin_tables.sql` — migration
- `src/server/routers/admin.ts` — admin tRPC router
- `src/app/[locale]/(dashboard)/admin/page.tsx` — overview
- `src/app/[locale]/(dashboard)/admin/layout.tsx` — admin layout
- `src/app/[locale]/(dashboard)/admin/ai-review/**` — AI review pages
- `src/app/[locale]/(dashboard)/admin/content/**` — content moderation pages
- `src/app/[locale]/(dashboard)/admin/data/**` — data management pages
- `src/app/[locale]/(dashboard)/admin/users/**` — user management pages
- `src/app/[locale]/(dashboard)/admin/settings/**` — settings page
- `src/components/admin/**` — all admin components
