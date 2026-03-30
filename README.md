# 🏛️ Knesset Insight — כנסת אינסייט

> פלטפורמה להנגשת המידע הפרלמנטרי של כנסת ישראל

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## מה זה?

**Knesset Insight** הוא פרויקט קוד פתוח שמטרתו להנגיש את המידע מאתר הכנסת והגופים הקשורים בצורה אינטואיטיבית וידידותית למשתמש — כדי שאזרחים יוכלו לקבל החלטות מושכלות.

### תכונות עיקריות

- 📊 **ויזואליזציה של הצבעות** — ראו מיד איך כל חבר כנסת או סיעה הצביעו
- 📜 **מעקב חקיקה** — עקבו אחרי הצעות חוק ובדקו את המצב שלהן
- 💰 **ניתוח תקציב** — הבינו איך כספי המדינה מחולקים
- 🤖 **AI מובנה** — שאלו שאלות בשפה פשוטה וקבלו תשובות מבוססות מידע
- 🔔 **התראות מותאמות** — הירשמו וקבלו עדכונים על הנושאים שמעניינים אתכם
- 🔍 **חיפוש חכם** — חיפוש טקסט וסמנטי בהצעות חוק, הצבעות ופרוטוקולים

## מקורות נתונים

| מקור | סוג | קישור |
|------|------|--------|
| ממשקי OData של הכנסת | הצעות חוק, הצבעות, מסמכים | [knesset.gov.il/Odata](https://knesset.gov.il/Odata/ParliamentInfo.svc) |
| כנסת פתוחה (hasadna) | נתונים מעובדים — חברי כנסת, ועדות | [oknesset.org](https://oknesset.org/) |
| מפתח התקציב | תקציב המדינה והוצאות | [next.obudget.org](https://next.obudget.org/) |

## טכנולוגיות

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: tRPC, Supabase (PostgreSQL + Auth), Drizzle ORM
- **AI**: OpenAI GPT-4o, Vercel AI SDK, pgvector
- **Data**: Trigger.dev (scheduled sync), OData client
- **Infra**: Vercel, Upstash Redis, GitHub Actions

## מבנה הפרויקט

```
src/
├── app/          # Next.js App Router pages
├── components/   # React components (UI, charts, features)
├── server/       # tRPC routers & server logic
├── lib/          # Shared libraries (DB, API clients, AI)
├── pipeline/     # Data sync jobs
├── hooks/        # React hooks
├── i18n/         # Translations (he, en)
└── types/        # TypeScript types
```

## התחלה מהירה

```bash
# Clone
git clone https://github.com/Yedidya10/knesset-insight.git
cd knesset-insight

# Install
pnpm install

# Setup env
cp .env.example .env.local
# Fill in your Supabase, OpenAI, Upstash keys

# DB setup
pnpm db:push

# Dev
pnpm dev
```

## תוכנית פיתוח

ראו את [PLAN.md](PLAN.md) לתוכנית מלאה ומפורטת.

## תרומה

תרומות מתקבלות בברכה! פתחו Issue או Pull Request.

## רישיון

[MIT](LICENSE)
