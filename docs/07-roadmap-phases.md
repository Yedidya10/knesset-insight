# 07 — שלבי ביצוע: מפת דרכים מפורטת

## סיכום שלבים

```
════════════════════════════════════════════════════════════════════
       Phase 1           Phase 2          Phase 3         Phase 4+
     שכבה ציבורית       משתמש רשום       שכבה חברתית      הרחבה
    ═══════════        ═══════════      ═══════════     ══════════
    ✅ ליבה מוכנה       🚧 הבא בתור      📋 מתוכנן       🔮 חזון
════════════════════════════════════════════════════════════════════
```

---

## Phase 1: השלמת השכבה הציבורית

**מטרה:** להביא את כל דפי המידע הציבוריים לרמת production-ready.

### 1.1 — השלמת דפים חסרים

| משימה                        | תלות                   | עדיפות |
| ---------------------------- | ---------------------- | ------ |
| דף ועדות — רשימה + פרטים     | tRPC router + UI       | P0     |
| דף תקציב — treemap בסיסי     | budget data + recharts | P0     |
| דף בחירות — תוצאות היסטוריות | election data import   | P1     |
| דף חיפוש גלובלי              | search tRPC router     | P0     |

**דף ועדות:**

- [ ] tRPC: `committees.list` + `committees.byId`
- [ ] UI: CommitteeCard, CommitteesList, CommitteeDetail
- [ ] i18n: הוספת מפתחות תרגום ל-4 שפות
- [ ] חיבור לנתוני ישיבות (committee_sessions)

**דף תקציב:**

- [ ] Treemap component (recharts TreemapChart)
- [ ] Budget data adapter (כבר יש budget_items בסכמה)
- [ ] השוואה שנתית (line chart)
- [ ] i18n: מפתחות תרגום

**דף בחירות:**

- [ ] Import נתוני בחירות (CSVs ידניים - כנסות 20-25)
- [ ] UI: ElectionResults, KnessetComparison
- [ ] גרף mandatim לפי סיעה (animated bar)

**חיפוש גלובלי:**

- [ ] PostgreSQL full-text search setup
- [ ] tRPC: `search.global`
- [ ] UI: SearchInput (debounced) + SearchResults (grouped)
- [ ] Redis caching לשאילתות נפוצות

### 1.2 — שיפור דפים קיימים

| משימה                                      | עדיפות |
| ------------------------------------------ | ------ |
| דף חה"כ: הוספת tabs (הצבעות, חקיקה, ועדות) | P1     |
| דף הצבעה: זיהוי "שוברי שורות"              | P1     |
| דף חקיקה: timeline סטטוס                   | P1     |
| דף ראשי: "מה חם השבוע"                     | P2     |
| השוואת חה"כ (compare page)                 | P2     |

### 1.3 — SEO ו-Performance

| משימה                                  | עדיפות |
| -------------------------------------- | ------ |
| Structured data (JSON-LD) לכל סוג דף   | P0     |
| Dynamic sitemap.xml                    | P0     |
| OG meta tags דינאמיים                  | P1     |
| Lighthouse score > 90                  | P0     |
| Image optimization (blur placeholders) | P1     |

### 1.4 — Tests

| סוג           | כלי                     | מטרה                            |
| ------------- | ----------------------- | ------------------------------- |
| Unit          | Vitest                  | tRPC routers, transforms, utils |
| Integration   | Vitest + testcontainers | DB queries, sync jobs           |
| E2E           | Playwright              | Critical user flows             |
| Accessibility | axe-core                | WCAG 2.1 AA compliance          |

**Critical User Flows לבדיקה:**

1. דף ראשי → רשימת חברי כנסת → פרופיל חה"כ
2. חיפוש חה"כ → תוצאות → פרופיל
3. רשימת הצבעות → סינון → פרטי הצבעה
4. החלפת שפה → RTL/LTR → תוכן מתורגם
5. Offline → PWA → תוכן מטמון

### Deliverables — Phase 1

- [ ] כל הדפים הציבוריים עובדים עם נתונים אמיתיים
- [ ] חיפוש גלובלי פועל
- [ ] SEO בסיסי (sitemap, structured data, OG)
- [ ] Lighthouse > 90 (performance, accessibility)
- [ ] Test coverage > 60% (unit + integration)
- [ ] 0 critical bugs

---

## Phase 2: רישום משתמשים והתאמה אישית

**מטרה:** להוסיף שכבת משתמשים עם מעקב, דירוג והתראות.

**תנאי מוקדם:** Phase 1.1 (דפים ציבוריים) הושלם.

### 2.1 — אותנטיקציה

| משימה                           | תלות          | עדיפות |
| ------------------------------- | ------------- | ------ |
| Supabase Auth setup             | —             | P0     |
| Login page (email + magic link) | Supabase Auth | P0     |
| Register page                   | Supabase Auth | P0     |
| Auth middleware (proxy.ts)      | Supabase Auth | P0     |
| Profile creation on signup      | DB migration  | P0     |
| Google OAuth                    | Supabase Auth | P1     |
| Forgot password flow            | Supabase Auth | P1     |
| Email verification              | Supabase Auth | P0     |

**מהלך עבודה:**

```
1. supabase auth.users → auto-create profile row (trigger)
2. proxy.ts → check session for (dashboard) routes
3. tRPC context → inject user from session
4. Auth pages UI (login, register, forgot, verify)
```

### 2.2 — מעקב (Watchlist)

| משימה                                    | עדיפות |
| ---------------------------------------- | ------ |
| DB: user_follows table + migration       | P0     |
| tRPC: watchlist.follow / unfollow / list | P0     |
| UI: FollowButton component               | P0     |
| Dashboard: WatchlistPage                 | P0     |
| i18n: מפתחות תרגום watchlist             | P0     |
| מעקב אחרי חברי כנסת                      | P0     |
| מעקב אחרי חוקים                          | P1     |
| מעקב אחרי ועדות                          | P1     |
| מעקב אחרי נושאים/תגיות                   | P2     |
| הגדרות מעקב (מה להתריע על)               | P1     |

### 2.3 — דשבורד אישי

| משימה                         | עדיפות |
| ----------------------------- | ------ |
| Dashboard layout              | P0     |
| דף סקירה (overview)           | P0     |
| רשימת מעקבים                  | P0     |
| עדכונים אחרונים ממעקבים       | P1     |
| mini-charts (פעילות חה"כ שלי) | P2     |

### 2.4 — דירוג אישי

| משימה                                      | עדיפות |
| ------------------------------------------ | ------ |
| DB: user_ratings table + migration         | P1     |
| tRPC: ratings.rate / update / myRatings    | P1     |
| UI: RatingWidget (5 קריטריונים × 5 כוכבים) | P1     |
| Dashboard: MyRatingsPage                   | P1     |
| דף חה"כ: tab "הדירוג שלי"                  | P1     |

### 2.5 — התראות

| משימה                                             | עדיפות |
| ------------------------------------------------- | ------ |
| DB: notifications + preferences tables            | P1     |
| tRPC: notifications.list / markRead / preferences | P1     |
| UI: NotificationBell (header) + NotificationsPage | P1     |
| Notification dispatcher (on sync)                 | P1     |
| Email notifications (Resend)                      | P2     |
| Web Push notifications                            | P2     |
| Weekly digest email                               | P2     |

### 2.6 — AI Chat

| משימה                                   | עדיפות |
| --------------------------------------- | ------ |
| API: /api/ai/chat endpoint              | P1     |
| Auth guard + daily limit                | P1     |
| Basic chat UI                           | P1     |
| RAG: vector embeddings for knesset data | P2     |
| Smart intent classification             | P2     |
| Chat history persistence                | P2     |

### 2.7 — הגדרות חשבון

| משימה                               | עדיפות |
| ----------------------------------- | ------ |
| Settings page layout                | P0     |
| Profile edit (name, avatar, locale) | P0     |
| Notification preferences            | P1     |
| Privacy settings (public profile)   | P1     |
| Delete account                      | P0     |
| Export my data                      | P2     |

### Deliverables — Phase 2

- [ ] משתמשים יכולים להירשם ולהתחבר
- [ ] מעקב אחרי חברי כנסת וחוקים
- [ ] דשבורד אישי עם סקירה
- [ ] דירוג אישי של חברי כנסת
- [ ] התראות in-app
- [ ] AI Chat בסיסי (20 הודעות/יום)
- [ ] הגדרות חשבון + מחיקה
- [ ] RLS policies פעילים

---

## Phase 3: שכבה חברתית

**מטרה:** לפתוח את הנתונים הקהילתיים לציבור ולאפשר שיתוף פעולה.

**תנאי מוקדם:** Phase 2.1–2.4 הושלמו (auth + follows + ratings).

### 3.1 — תשתית Moderation

| משימה                             | עדיפות |
| --------------------------------- | ------ |
| Content moderation AI pipeline    | P0     |
| Reports table + tRPC              | P0     |
| Moderation dashboard (admin)      | P0     |
| Community guidelines page         | P0     |
| Terms of service + privacy policy | P0     |

### 3.2 — דירוג ציבורי

| משימה                                | עדיפות |
| ------------------------------------ | ------ |
| DB: entity_stats table + migration   | P0     |
| Aggregation job (every 15 min)       | P0     |
| "הפוך לציבורי" toggle in ratings     | P0     |
| Public rating display on member page | P0     |
| Anti-manipulation mechanisms         | P0     |
| Leaderboard page                     | P1     |
| Disclaimers on all public data       | P0     |

### 3.3 — מונים ציבוריים

| משימה                                  | עדיפות |
| -------------------------------------- | ------ |
| Followers count (anonymous aggregated) | P0     |
| Rating count display                   | P0     |
| "Trending" interest score algorithm    | P1     |
| 🔥 Hot badge on high-interest entities | P1     |

### 3.4 — תגובות ציבוריות

| משימה                                        | עדיפות |
| -------------------------------------------- | ------ |
| DB: public_comments + comment_votes tables   | P1     |
| tRPC: comments.create / list / vote / report | P1     |
| UI: CommentSection component                 | P1     |
| Auto-moderation (AI check before publish)    | P1     |
| Upvote/downvote mechanism                    | P1     |
| Comment pagination + sorting                 | P2     |

### 3.5 — שיתוף חברתי

| משימה                                             | עדיפות |
| ------------------------------------------------- | ------ |
| Share buttons (link, WhatsApp, Twitter, Facebook) | P1     |
| Dynamic OG images (@vercel/og)                    | P1     |
| Embed cards (iframe widget)                       | P2     |

### Deliverables — Phase 3

- [ ] Content moderation פעיל (AI + ידני)
- [ ] דירוג ציבורי מצרפי עם anti-manipulation
- [ ] מוני עוקבים ציבוריים
- [ ] תגובות ציבוריות (עם moderation)
- [ ] כפתורי שיתוף + OG cards
- [ ] Leaderboard
- [ ] תנאי שימוש ומדיניות פרטיות

---

## Phase 4: הרחבת מקורות מידע

**מטרה:** לצאת מגבולות נתוני הכנסת לפלטפורמת דמוקרטיה רחבה.

### 4.1 — מקורות ממשלתיים נוספים

| משימה                            | מקור          |
| -------------------------------- | ------------- |
| Government decisions adapter     | gov.il        |
| data.gov.il CKAN connector       | data.gov.il   |
| Election results import          | votes.gov.il  |
| CBS statistical data integration | CBS open data |

### 4.2 — שלטון מקומי

| משימה                              | סטטוס       |
| ---------------------------------- | ----------- |
| מחקר: אילו רשויות חושפות נתונים    | Research    |
| Pilot: עיריית תל אביב data adapter | Development |
| Pilot: עיריית ירושלים data adapter | Development |
| מודל נתונים אוניברסלי לרשויות      | Design      |
| Dashboard: השוואת רשויות           | Development |

### 4.3 — שילוב מכוני מחקר

| משימה                                 | שותף         |
| ------------------------------------- | ------------ |
| יצירת קשר עם IDI                      | Business dev |
| הסכם שילוב נתונים IDI                 | Legal        |
| Links to relevant research per entity | Development  |
| Democracy Index visualization         | Development  |
| Public trust survey integration       | Development  |

### Deliverables — Phase 4

- [ ] 3+ מקורות מידע חדשים משולבים
- [ ] דף השוואת רשויות מקומיות (pilot)
- [ ] קישורים למחקרי IDI בדפים רלוונטיים
- [ ] Data quality dashboard

---

## Phase 5: פלטפורמת דמוקרטיה מקיפה

**מטרה:** Knesset Insight → Israel Democracy Insight

### 5.1 — תכונות מתקדמות

| תכונה                       | תיאור                            |
| --------------------------- | -------------------------------- |
| Legislation impact tracker  | מעקב אחרי השפעת חקיקה על החברה   |
| Cross-entity analysis       | קשרים בין תקציב ↔ חקיקה ↔ פעילות |
| AI-powered insights         | ניתוחים אוטומטיים של מגמות       |
| Public API                  | פתיחת API לפיתוח חיצוני          |
| Municipal deep-dive         | שכבת שלטון מקומי מלאה            |
| Court decisions integration | קישור חקיקה ↔ פסיקה              |

### 5.2 — בינלאומי

- השוואה עם פרלמנטים אחרים (OpenParliament standard)
- תרגום ל-5+ שפות
- Open data standard compliance

### 5.3 — קהילה

- Contributor program (open source)
- Research partnerships
- Educational partnerships (בתי ספר, אוניברסיטאות)
- Civic hackathons

---

## תלויות בין Phases

```
Phase 1 ──────────────────────────────────────→ Phase 4
  │ (public pages)                                │
  │                                               │ (new data sources)
  ▼                                               │
Phase 2 ──────────────────────→ Phase 3           │
  │ (auth, follows, ratings)    │ (social)        │
  │                              │                 │
  │                              ▼                 ▼
  │                           Phase 5 ←────────────┘
  │                           (full platform)
  │
  └── Can start in parallel:
      • Auth (2.1) doesn't block public pages (1.1)
      • AI Chat (2.6) can start with basic DB (no RAG)
      • Notifications (2.5) needs follows (2.2) first
```

### מה אפשר לעשות במקביל

| Track A (Public)   | Track B (Auth) | Track C (Data)       |
| ------------------ | -------------- | -------------------- |
| 1.1 Complete pages | 2.1 Auth setup | Election data import |
| 1.2 Improve pages  | 2.2 Watchlist  | Government decisions |
| 1.3 SEO            | 2.3 Dashboard  | data.gov.il adapter  |
| 1.4 Tests          | 2.4 Ratings    |                      |

---

## Risk Register

| סיכון                          | הסתברות | השפעה   | מיטיגציה                                |
| ------------------------------ | ------- | ------- | --------------------------------------- |
| Knesset API שינויי schema      | בינונית | גבוהה   | Adapter pattern, version detection      |
| Rate limiting ממקורות חיצוניים | נמוכה   | בינונית | Cache aggressive, backoff               |
| בעיות פרטיות (GDPR)            | נמוכה   | גבוהה   | Privacy-by-design, legal review         |
| Manipulation/bot attacks       | בינונית | גבוהה   | Rate limit, CAPTCHA, anomaly detection  |
| Scale issues (100K+ users)     | נמוכה   | בינונית | Caching, CDN, read replicas             |
| AI costs (Gemini/OpenAI)       | בינונית | בינונית | Daily limits, cache responses, fallback |
| Legal challenges (data use)    | נמוכה   | גבוהה   | Legal review, clear ToS, attribution    |
| Open source burnout            | בינונית | גבוהה   | Community building, documentation       |

---

## Definition of Done (לכל Phase)

### Phase 1 — Done When:

- [ ] כל דפי המידע הציבוריים פועלים עם נתונים אמיתיים
- [ ] חיפוש גלובלי פועל
- [ ] Lighthouse > 90
- [ ] 0 critical/major bugs
- [ ] 4 שפות עובדות (RTL+LTR)
- [ ] PWA installable + basic offline

### Phase 2 — Done When:

- [ ] רישום והתחברות עובדים
- [ ] מעקב אחרי 3+ סוגי ישויות
- [ ] דירוג אישי עובד
- [ ] התראות in-app עובדות
- [ ] AI Chat עובד (בסיסי)
- [ ] מחיקת חשבון אפשרית

### Phase 3 — Done When:

- [ ] Moderation pipeline פעיל
- [ ] דירוגים ציבוריים מוצגים
- [ ] מוני עוקבים ציבוריים
- [ ] תגובות עם moderation
- [ ] שיתוף חברתי עובד
- [ ] Terms of Service + Privacy Policy live

### Phase 4 — Done When:

- [ ] 3+ מקורות חדשים פעילים
- [ ] Data pipeline מפקח על כל המקורות
- [ ] לפחות רשות מקומית אחת משולבת
- [ ] קישור למחקרי IDI

---

## KPIs לפי Phase

| Phase | KPI                  | Target    |
| ----- | -------------------- | --------- |
| 1     | Lighthouse score     | > 90      |
| 1     | Pages with real data | 100%      |
| 1     | i18n coverage        | 100%      |
| 2     | Registered users     | 500       |
| 2     | Active follows       | 1,000     |
| 2     | AI chat sessions     | 200/week  |
| 3     | Public ratings       | 5,000     |
| 3     | Public comments      | 1,000     |
| 3     | Social shares        | 500/month |
| 4     | Data sources         | 6+        |
| 4     | MAU                  | 10,000    |

---

> **מסמך זה הוא מפת דרכים חיה.** עדיפויות משתנות בהתאם למשוב משתמשים,
> זמינות משאבים, ושינויים בסביבה. סדר הפיצ'רים בתוך כל Phase גמיש,
> אך ה-Phases עצמם תלויים אחד בשני כמתואר בתרשים התלויות.
