# 17 — הסתייגויות (Reservations) and Policy Stance Accuracy

> **Status: Analysis & Planning**
>
> מחקר מקיף על תפקיד ההסתייגויות בהליך החקיקה הישראלי,
> והשפעתן על דיוק האלגוריתם להפקת עמדות מדיניות של חברי כנסת וסיעות.

---

## תוכן עניינים

1. [מבוא — מה זו הסתייגות?](#1-מבוא)
2. [המצב הנוכחי במערכת](#2-מצב-נוכחי)
3. [הבעיה — למה הסתייגויות מורכבות?](#3-הבעיה)
4. [סוגי הסתייגויות — טיפולוגיה](#4-סוגי-הסתייגויות)
5. [ניתוח הארכיטקטורה הנוכחית וחסרונותיה](#5-ניתוח-ארכיטקטורה)
6. [קייס ייצוגי — הצעת חוק חדלות פירעון (תיקון מס' 5)](#6-קייס-ייצוגי)
7. [הצעת פתרון — ארכיטקטורה משופרת](#7-הצעת-פתרון)
8. [Pipeline: קריאת פרוטוקולים עם AI](#8-protocol-pipeline)
9. [תקציר הסתייגות — "שתי ציפורים במכה"](#9-תקציר-הסתייגות)
10. [מחוון התקדמות ניתוח עמדות (UI)](#10-מחוון-התקדמות)
11. [שינויים נדרשים בסכמה](#11-שינויים-בסכמה)
12. [שלבי מימוש](#12-שלבי-מימוש)

---

## 1. מבוא

### מה זו הסתייגות?

**הסתייגות** (reservation / objection) היא הצעת תיקון לסעיף בהצעת חוק,
המוגשת על ידי חבר כנסת שאינו מסכים עם הנוסח שאושר בוועדה.

**מקור חוקי:** סעיף 90 לתקנון הכנסת.

### ההליך המלא:

```
שלב 1: דיון בוועדה (אחרי קריאה ראשונה)
   ├── חברי ועדה + ח"כים אחרים מגישים הסתייגויות
   ├── הוועדה מצביעה על ההסתייגויות
   ├── הסתייגויות שהתקבלו → מוטמעות בנוסח החוק
   └── הסתייגויות שנדחו → עולות למליאה בקריאה שנייה

שלב 2: קריאה שנייה במליאה
   ├── יו"ר הוועדה מציג את נוסח החוק
   ├── מגישי ההסתייגויות שנדחו מנמקים (5 דק' לכל הסתייגות)
   ├── הצבעה על כל הסתייגות בנפרד
   └── הצבעה על כל סעיף (מי שאין עליו הסתייגות — מצביעים בקבוצה)

שלב 3: קריאה שלישית
   ├── הצבעה על נוסח החוק כולו (כמקשה אחת)
   └── כולל הסתייגויות שהתקבלו בקריאה שנייה
```

### כללים חשובים:

- **5 דקות** לנימוק כל הסתייגות (סעיף 90 לתקנון)
- **פיליבסטר**: כשמוגשות הסתייגויות רבות מאוד, ח"כ שרוצה לעכב חוק מנצל את כל
  הזמן המוקצב. ועדת הכנסת רשאית לקבוע סדרי דיון מיוחדים (סעיף 90) שמקצרים
  את הנימוקים.
- **אין הצבעה על הסתייגות של ח"כ שלא נוכח** בישיבת המליאה
- **אם התקבלה הסתייגות** — הממשלה/יו"ר הוועדה רשאים לדחות את הקריאה
  השלישית בשבוע (סעיף 92(ב) לתקנון)

---

## 2. מצב נוכחי

### איך הסתייגויות מיוצגות היום במערכת?

**הזיהוי** — 3 נקודות זיהוי ברמות שונות:

| שכבה       | קובץ                          | Pattern                           | שימוש                                     |
| ---------- | ----------------------------- | --------------------------------- | ----------------------------------------- |
| UI         | `StageVotePanel.tsx`          | `/הסתייגו/`                       | הפרדה ויזואלית בין הצבעות חוק להסתייגויות |
| Pipeline   | `link-votes-to-bills.ts` L285 | `title ~* 'הסתייגות\|הסתייגויות'` | שיוך שלב `SECOND_THIRD_READING`           |
| Enrichment | `enrich-vote-titles.ts`       | `'הסתייגות'` ב-`GENERIC_TITLES`   | העשרת כותרות גנריות מ-`sess_item_dscr`    |

**מה קורה עם ההסתייגויות ב-Policy Stances?**

כרגע — **שום דבר מיוחד.** הסתייגויות מסווגות בדיוק כמו כל הצבעה רגילה:

1. `classify-vote-stances.ts` מוצא את ההצבעה
2. שולח ל-Claude את כותרת ההצבעה + סיכום הצעת החוק
3. Claude מחזיר `proPosition` + `alignment` + `confidence`
4. הציון נספר ב-8 הרמות

**הבעיה:** Claude לא מקבל מידע על:

- **מה ההסתייגות מציעה לשנות** (תוכן ההסתייגות עצמה)
- **מי הגיש אותה ולמה** (הקונטקסט הפוליטי)
- **האם זו הסתייגות עניינית או "התשה"** (filibuster)
- **הזיקה לחוק המקורי** — האם ההסתייגות "בעד" או "נגד" מהות החוק?

---

## 3. הבעיה

### למה הסתייגויות מורכבות לניתוח עמדות?

#### 3.1 — כיוון ההצבעה לא מספיק

בהצבעה רגילה על חוק:

- **בעד** = תומך בחוק
- **נגד** = מתנגד לחוק

בהסתייגות הכיוון **מורכב יותר**:

| סוג הסתייגות                   | מי מצביע בעד       | מי מצביע נגד | משמעות "בעד"          |
| ------------------------------ | ------------------ | ------------ | --------------------- |
| הסתייגות **מרככת** (מקלה)      | אופוזיציה + מתונים | קואליציה     | רוצים להקל על החוק    |
| הסתייגות **מחמירה**            | שמאל/ימין קיצוני   | רוב          | רוצים להחמיר את החוק  |
| הסתייגות **התשה** (filibuster) | אופוזיציה          | קואליציה     | מטרה לעכב, לא לשנות   |
| הסתייגות **עניינית-טכנית**     | הכל                | —            | תיקון טעות/עיגון מונח |

#### 3.2 — אותו ח"כ, עמדות "הפוכות"

**תרחיש:**
ח"כ X מצביע **בעד** חוק Y בקריאה שלישית (= תומך בחוק),
אבל גם מצביע **בעד** 5 הסתייגויות לאותו חוק (= רוצה לשנות את החוק).

**ללא ניתוח ההסתייגויות** — המערכת סופרת:

- 1 הצבעה "בעד" על העמדה
- 5 הצבעות "בעד" על... מה? אם Claude מסווג את כל ההסתייגויות כ-`alignment: supports`
  לאותה עמדה — הח"כ מקבל 6 הצבעות "תואמות" מתוך 6 = 100%.
  אבל אם Claude מסווג חלק כ-`alignment: opposes` — הציון ירד.

**האמת:** הח"כ תומך בחוק ורוצה להחמיר/לשפר אותו. ההסתייגויות שלו הן
**בכיוון החוק**, לא נגדו.

#### 3.3 — הסתייגויות "התשה" (Filibuster)

כאשר אופוזיציה מגישה עשרות/מאות הסתייגויות **במטרה לעכב** את אישור החוק,
ולא מתוך רצון אמיתי לשנות את הנוסח:

- **הסתייגויות אלה לא משקפות עמדה מדינית** — הן כלי טקטי
- אם נספור אותן כמו הצבעות רגילות, **הן מעוותות את תמונת העמדות**
- לדוגמה: 3 הצבעות עניינו + 50 הסתייגויות התשה = הציון משוקלל לטובת 50 ולא 3

#### 3.4 — הקונטקסט חסר

כותרת OData טיפוסית להסתייגות:

```
"הסתייגות" → (אחרי enrichment) → "הצעת חוק חדלות פירעון ושיקום כלכלי (תיקון מס' 5) — הסתייגות"
```

**חסר:**

- מה ההסתייגות מציעה?
- מי הגיש אותה?
- לאיזה סעיף היא מתייחסת?
- האם היא הסתייגות עניינית או התשה?

המידע הזה **קיים** — בפרוטוקול ועדת הכנסת שהכינה את החוק לקריאה שנייה ושלישית.

---

## 4. סוגי הסתייגויות — טיפולוגיה

### 4.1 — הסתייגות עניינית-מהותית

**מאפיינים:**

- מציעה שינוי ספציפי בסעיף מסוים של החוק
- יש לה נוסח חלופי מפורש
- בדרך כלל מוגשת על ידי 1–3 ח"כים
- עוברת דיון מהותי בוועדה
- **עניינית לעמדות מדיניות**

**דוגמה:**

> הסתייגות לסעיף 5 — הגדרת "חייב" תכלול גם עוסק מורשה
> (מרחיבה את תחולת חוק חדלות פירעון)

### 4.2 — הסתייגות "מרככת"

**מאפיינים:**

- מנסה להפחית את חומרת החוק
- בדרך כלל מוגשת על ידי ח"כים שתומכים ברוח החוק אבל חושבים שהוא קיצוני
- **עניינית מאוד** — מגלה ניואנס בעמדה

**דוגמה:**

> הסתייגות: להחליף "מאסר 3 שנים" ב-"מאסר שנה אחת"

### 4.3 — הסתייגות "מחמירה"

**מאפיינים:**

- מנסה להחמיר/להרחיב את החוק
- מוגשת על ידי ח"כים שרוצים חוק חזק יותר
- **עניינית מאוד** — מגלה שהח"כ תומך ברוח החוק אבל רוצה יותר

### 4.4 — הסתייגות התשה (Filibuster)

**מאפיינים:**

- עשרות/מאות הסתייגויות מאותה סיעה/גוש
- לעתים נוסח חוזר עם וריאציות קטנות
- כל ההסתייגויות נדחות ברוב דומה
- זמני הצבעה צפופים (כל 1–2 דקות)
- **לא משקפת עמדה ספציפית** — מטרתה עיכוב

**אינדיקטורים כמותיים לזיהוי:**

- `>15` הסתייגויות באותה ישיבה על אותו חוק
- כולן נדחו (`is_accepted = false`)
- פערי זמן `<3 דק'` בין הצבעות
- כולן מאותו/ם מגיש/ים

### 4.5 — הסתייגות "לטובת החוק"

**מפתיע אבל קיים:** חברי קואליציה או ח"כים שתומכים בחוק מגישים הסתייגויות
**כדי לשפר** את הנוסח. הסתייגויות אלה לפעמים **מתקבלות** ואז נכללות בנוסח
הסופי. הן מגלות **תמיכה עמוקה** בחוק.

---

## 5. ניתוח הארכיטקטורה הנוכחית

### מה עובד טוב

1. **שיוך שלב** — הסתייגויות מזוהות נכון כ-`SECOND_THIRD_READING` (Layer 5)
2. **הפרדה ויזואלית** — `StageVotePanel` מפריד הסתייגויות מהצבעות חוק
3. **העשרת כותרות** — `enrich-vote-titles.ts` מוסיף את שם החוק לכותרת גנרית

### מה חסר / שבור

| בעיה                         | השפעה                        | חומרה     |
| ---------------------------- | ---------------------------- | --------- |
| **אין סיווג סוג הסתייגות**   | כל ההסתייגויות נספרות שווה   | 🔴 קריטי  |
| **אין תוכן ההסתייגות**       | Claude מסווג "בעיוורון"      | 🔴 קריטי  |
| **אין זיהוי filibuster**     | התשה מעוותת ציונים           | 🔴 קריטי  |
| **אין חיבור לפרוטוקולים**    | הקשר מלא לא זמין             | 🟠 גבוה   |
| **אין זיהוי מגיש ההסתייגות** | לא יודעים מי הגיש            | 🟠 גבוה   |
| **אין שקלול דיפרנציאלי**     | הסתייגות = הצבעה רגילה במשקל | 🟡 בינוני |
| **אין UI לתוכן ההסתייגות**   | האזרח לא רואה מה הוצע        | 🟡 בינוני |

### חישוב ציון עמדה נוכחי — הבעיה

```
score = (matchCount / totalCount) × 100
```

**הבעיה:** `totalCount` כולל כל הצבעה שהח"כ השתתף בה — כולל 50 הסתייגויות
התשה שנספרות כ-50 הצבעות נפרדות. אם הח"כ הצביע "בעד" כל ההסתייגויות
ו-"בעד" החוק עצמו — הציון מושפע ב-98% מההסתייגויות ו-2% מההצבעה המהותית.

---

## 6. קייס ייצוגי — הצעת חוק חדלות פירעון ושיקום כלכלי (תיקון מס' 5)

### נתוני אמת מ-OData

**הצבעות הסתייגויות** (מתוך Votes.svc, כנסת 24, 13 ביולי 2021):

```json
[
  {
    "vote_id": 34516,
    "vote_item_dscr": "הסתייגויות",
    "sess_item_dscr": "הצעת חוק חדלות פירעון ושיקום כלכלי (תיקון מס' 5), התשפ\"א-2021",
    "vote_date": "2021-07-13T00:00:00",
    "vote_time": "03:34",
    "is_accepted": 0,
    "total_for": 8,
    "total_against": 2,
    "total_abstain": 2
  },

  {
    "vote_id": 34517,
    "vote_time": "03:35",
    "is_accepted": 0,
    "total_for": 8,
    "total_against": 29,
    "total_abstain": 2
  },

  {
    "vote_id": 34519,
    "vote_time": "03:36",
    "is_accepted": 0,
    "total_for": 9,
    "total_against": 30,
    "total_abstain": 2
  },

  {
    "vote_id": 34521,
    "vote_time": "03:37",
    "is_accepted": 0,
    "total_for": 9,
    "total_against": 30,
    "total_abstain": 2
  },

  {
    "vote_id": 34522,
    "vote_time": "03:38",
    "is_accepted": 0,
    "total_for": 9,
    "total_against": 30,
    "total_abstain": 2
  }
]
```

### ניתוח הקייס

**מאפייני Filibuster ברורים:**

- ✅ 5 הסתייגויות ברצף מהיר (דקה אחת בין כל הצבעה)
- ✅ כולן נדחו (`is_accepted: 0`)
- ✅ תוצאות דומות מאוד (8–9 בעד, 29–30 נגד)
- ✅ ההצבעות בשעה 03:34 בלילה (!) — סימן קלאסי לדחיפת חוקים

**מה יש במערכת היום:**

- כותרת: `"הסתייגות"` → אחרי enrichment: `"הצעת חוק חדלות פירעון... — הסתייגות"`
- `bill_stage`: `SECOND_THIRD_READING` (5) ✅
- `bill_id`: מחובר לחוק (אם Layer 1–4 עבד) ✅

**מה חסר:**

- ❌ לא יודעים שזו **סדרת filibuster**
- ❌ לא יודעים **מה כל הסתייגות מציעה**
- ❌ לא יודעים **מי הגיש** כל הסתייגות
- ❌ Claude מסווג כל הסתייגות בנפרד כאילו היא עניינית
- ❌ 5 הצבעות "רפאים" נכנסות לחישוב הציון

### איך זה נראה עם הפתרון המוצע

```
הסתייגות 1 (vote_id: 34516)
├── סוג: filibuster (confidence: 0.92)
├── מגיש: ח"כ X (אופוזיציה)
├── מקור: פרוטוקול ועדת חוק ומשפט, 8.7.2021
├── תוכן: "לשנות את הגדרת 'חייב' בסעיף 2..."
├── כיוון ביחס לחוק: הרחבה (מחמירה)
├── weight_in_score: 0.1 (כי filibuster)
└── stance_alignment: null (לא נכלל בחישוב עמדות)

הצבעה ראשית (קריאה 2+3)
├── סוג: main_vote
├── weight_in_score: 1.0
├── stance_alignment: supports "הקלת תנאי חדלות פירעון"
└── confidence: 0.91
```

---

## 7. הצעת פתרון — ארכיטקטורה משופרת

### 7.1 — שלב 1: זיהוי וסיווג הסתייגויות (Heuristic)

**לפני** שליחה ל-AI, נריץ אלגוריתם יוריסטי שמסווג הסתייגויות:

```typescript
interface ReservationClassification {
  voteId: number;
  reservationType: 'substantive' | 'filibuster' | 'supportive' | 'unknown';
  confidence: number;
  clusterGroupId: string | null; // קבוצת הסתייגויות מאותה ישיבה
  filibusterScore: number; // 0-1
}

function classifyReservation(
  vote: Vote,
  sessionVotes: Vote[], // כל ההצבעות מאותה ישיבה על אותו חוק
): ReservationClassification {
  const reservationsInSession = sessionVotes.filter((v) =>
    /הסתייגו/.test(v.title),
  );

  // אינדיקטורים ל-filibuster
  let filibusterScore = 0;

  // 1. מספר הסתייגויות גבוה (>15 = חשוד מאוד)
  if (reservationsInSession.length > 15) filibusterScore += 0.3;
  else if (reservationsInSession.length > 8) filibusterScore += 0.15;

  // 2. כולן נדחו
  const allRejected = reservationsInSession.every(
    (v) => v.isAccepted === false,
  );
  if (allRejected) filibusterScore += 0.2;

  // 3. פערי זמן קטנים בין הצבעות (<3 דקות)
  const avgGapMinutes = computeAvgVoteGap(reservationsInSession);
  if (avgGapMinutes < 3) filibusterScore += 0.2;
  else if (avgGapMinutes < 5) filibusterScore += 0.1;

  // 4. תוצאות הצבעה דומות מאוד
  const resultVariance = computeResultVariance(reservationsInSession);
  if (resultVariance < 0.05) filibusterScore += 0.15;

  // 5. שעת לילה (אחרי 23:00 או לפני 06:00)
  const hour = new Date(vote.voteDate).getHours();
  if (hour >= 23 || hour < 6) filibusterScore += 0.15;

  filibusterScore = Math.min(1, filibusterScore);

  return {
    voteId: vote.id,
    reservationType:
      filibusterScore >= 0.6
        ? 'filibuster'
        : filibusterScore >= 0.3
          ? 'unknown'
          : 'substantive',
    confidence: filibusterScore >= 0.6 ? filibusterScore : 1 - filibusterScore,
    clusterGroupId: `${vote.billId}-${vote.sessionId}`,
    filibusterScore,
  };
}
```

### 7.2 — שלב 2: העשרת תוכן הסתייגות מפרוטוקולים

```
פרוטוקול ועדה
   ├── מכיל: "הסתייגות מס' 3 של ח"כ X לסעיף 5:
   │         'להחליף את המילים ... ב-...'"
   ├── AI extraction → {
   │     reservationNumber: 3,
   │     submitter: "ח"כ X",
   │     targetSection: 5,
   │     proposedChange: "להחליף ...",
   │     rationale: "..." (מדברי ח"כ X בוועדה)
   │   }
   └── חיבור ל-vote_id דרך sess_item_id + reservation number
```

### 7.3 — שלב 3: שקלול דיפרנציאלי בחישוב ציון

**הנוסחה המשופרת:**

```
weighted_score = Σ(weight_i × match_i) / Σ(weight_i)
```

| סוג הצבעה                            | weight   | הסבר                            |
| ------------------------------------ | -------- | ------------------------------- |
| הצבעה ראשית (קריאה 1/2/3)            | **1.0**  | ההצבעה המהותית ביותר            |
| הסתייגות עניינית                     | **0.5**  | מגלה ניואנס בעמדה               |
| הסתייגות "תומכת" (מחמירה לטובת החוק) | **0.3**  | מחזקת את הכיוון הכללי           |
| הסתייגות filibuster                  | **0.05** | כמעט לא נספרת — טקטיקה, לא עמדה |
| הסתייגות unknown                     | **0.2**  | ברירת מחדל — לבדיקה             |

### 7.4 — שלב 4: AI Prompt משופר

הוספה ל-`VOTE_STANCE_SKILL`:

```
RESERVATION (הסתייגות) RULES:
1. If the vote is a reservation (title contains הסתייגות/הסתייגויות),
   treat it differently from a regular bill vote:

   a. CONTEXT CHECK: Look for reservation content in the provided context.
      If content is available, classify based on WHAT THE RESERVATION PROPOSES,
      not just the parent bill.

   b. DIRECTION RELATIVE TO BILL: Determine if the reservation:
      - STRENGTHENS the bill's direction (supportive reservation)
      - WEAKENS/SOFTENS the bill (moderating reservation)
      - PROPOSES AN ALTERNATIVE (substantive opposition)
      - IS PROCEDURAL/FILIBUSTER (ignore for stance classification)

   c. FILIBUSTER DETECTION: If the vote metadata includes filibuster indicators
      (filibusterScore > 0.5), respond with:
      {"proPosition": null, "matches": [], "newStances": [],
       "reservationType": "filibuster"}

   d. ALIGNMENT FOR RESERVATIONS:
      - A FOR vote on a reservation means you SUPPORT the proposed change
      - This is NOT the same as supporting or opposing the parent bill
      - Example: Voting FOR a softening reservation ≠ opposing the bill;
        it may mean wanting a milder version of the same policy direction

2. When classifying reservation votes, also provide:
   "reservationContext": {
     "directionRelativeToBill": "strengthens" | "weakens" | "alternative" | "procedural",
     "isPolicyRelevant": true | false
   }
```

---

## 8. Pipeline: קריאת פרוטוקולים עם AI

### מקור הפרוטוקולים

פרוטוקולי ועדות זמינים דרך OData:

- `KNS_DocumentCommitteeSession` — מסמכי ישיבות ועדה
- כולל קישור ל-PDF של הפרוטוקול

בנוסף, שדה `protocolUrl` ב-`committee_sessions` כבר קיים בסכמה (אבל לא מוצג בUI).

### Pipeline מוצע

```
1. זיהוי חוקים עם הסתייגויות
   ├── שאילתה: votes WHERE title ~* 'הסתייגות' GROUP BY bill_id
   └── תוצאה: רשימת bill_ids עם מספר הסתייגויות

2. מציאת ישיבות ועדה רלוונטיות
   ├── bills → committee_id → committee_sessions
   ├── סינון: session_date BETWEEN (first_reading_date, second_reading_date)
   └── תוצאה: רשימת protocol URLs

3. הורדה וקריאת פרוטוקולים
   ├── PDF download → Gemini Flash (עדיף לעברית ארוכה)
   ├── Prompt: "Extract all reservations from this committee protocol.
   │    For each, return: {number, submitter, targetSection,
   │    proposedChange, rationale, wasAcceptedInCommittee}"
   └── תוצאה: structured reservation data

4. חיבור הסתייגויות להצבעות
   ├── Match by: bill_id + session + reservation_number/order
   ├── Fallback: chronological order within session
   └── Store in reservation_details table

5. סיווג AI מעודכן
   ├── Input: vote + bill context + reservation content
   ├── Output: proPosition + alignment + reservationType + directionRelativeToBill
   └── שקלול לפי טיפולוגיה
```

### עלות משוערת

| שלב              | כמות                   | מודל          | עלות        |
| ---------------- | ---------------------- | ------------- | ----------- |
| קריאת פרוטוקולים | ~500 PDFs × 20 עמ'     | Gemini Flash  | ~$1.00      |
| חילוץ הסתייגויות | ~500 protocols         | Gemini Flash  | ~$0.50      |
| סיווג מחדש       | ~5,000 הצבעות הסתייגות | Claude Sonnet | ~$15.00     |
| **סה"כ**         |                        |               | **~$16.50** |

---

## 9. תקציר הסתייגות — "שתי ציפורים במכה"

### הרעיון

מכיוון שה-AI כבר מנתח כל הצבעת הסתייגות כדי לסווג אותה (filibuster / עניינית / וכו'),
נוכל **באותה קריאת AI** גם לייצר **תקציר קצר** של ההסתייגות שיוצג למשתמש.

זה חוסך קריאת AI נפרדת לייצור תקציר — ה-AI ממילא צריך להבין את תוכן ההסתייגות
כדי לסווג אותה, אז "בדרך" הוא מייצר גם תקציר אנושי-קריא.

### מה מוסיפים ל-AI Output

נרחיב את ה-JSON שה-AI מחזיר לכלול שדה חדש `reservationSummary`:

```json
{
  "proPosition": {"he": "...", "en": "...", "ar": "...", "ru": "..."},
  "matches": [...],
  "reservationType": "substantive",
  "reservationContext": {
    "directionRelativeToBill": "weakens",
    "isPolicyRelevant": true
  },
  "reservationSummary": {
    "he": "הסתייגות לסעיף 5 – מציעה להפחית את תקופת ההתיישנות מ-7 שנים ל-3 שנים",
    "en": "Reservation to section 5 – proposes reducing the limitation period from 7 to 3 years",
    "ar": "تحفظ على المادة 5 – يقترح تقليص فترة التقادم من 7 سنوات إلى 3 سنوات",
    "ru": "Оговорка к статье 5 – предлагает сократить срок давности с 7 до 3 лет"
  }
}
```

### כשיש תוכן מפרוטוקול (Phase 2) — התקציר מדויק יותר

אם חילצנו את תוכן ההסתייגות מפרוטוקול הוועדה (Phase 2), ה-AI מקבל אותו
כקונטקסט ומייצר תקציר **מדויק** שמתאר בדיוק מה הוצע.

### כשאין תוכן מפרוטוקול (Phase 1) — התקציר מוסק

גם בלי פרוטוקול, ה-AI יכול להסיק מכותרת ההצבעה + סיכום הצעת החוק
תקציר כללי יותר. לדוגמה:

```
כותרת: "הצעת חוק חדלות פירעון (תיקון 5) — הסתייגות"
סיכום חוק: "תיקון שמקל על חייבים לפתוח הליך חדלות פירעון..."
→ תקציר: "הסתייגות לחוק חדלות פירעון – לא ידוע תוכנה המדויק (לא חולץ מפרוטוקול)"
```

אם אין מספיק מידע, השדה יהיה `null` — עדיף ללא תקציר מתקציר שגוי.

### הצגה ב-UI

התקציר יוצג ב-`StageVotePanel` מתחת לכל הצבעת הסתייגות:

```
┌─────────────────────────────────────────────────────┐
│ ❌ נדחה (9 בעד, 30 נגד)                           │
│ הסתייגות – חוק חדלות פירעון (תיקון 5)             │
│ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ │
│ 📝 הסתייגות לסעיף 5 – הפחתת תקופת ההתיישנות      │
│    מ-7 שנים ל-3 שנים                              │
│ 🏷️ [עניינית · מרככת]                              │
│ 👤 מגיש: ח"כ יצחק לוי                             │
└─────────────────────────────────────────────────────┘
```

### Prompt Addition לייצור תקציר

נוסיף ל-`VOTE_STANCE_SKILL`:

```
RESERVATION SUMMARY:
When classifying a reservation vote (הסתייגות), also produce a brief
human-readable summary of what this reservation proposes, in the
"reservationSummary" field (all 4 languages: he, en, ar, ru).

Guidelines:
- 1–2 sentences maximum, plain language a citizen can understand
- Focus on: which section, what change is proposed, what direction
  (stricter, softer, technical fix, etc.)
- If reservation content was provided from the committee protocol,
  use it for an accurate summary
- If only the vote title + bill summary are available, provide a
  best-effort summary and note if the exact content is unknown
- If you cannot determine what the reservation proposes at all,
  set "reservationSummary" to null
```

### שדה בסכמה

ב-`reservation_details`:

```sql
  reservation_summary JSONB,  -- {he, en, ar, ru} — תקציר שנוצר בזמן הסיווג
```

ב-`vote_stance_alignment`:

```sql
  reservation_summary JSONB,  -- {he, en, ar, ru} — מוטמע גם כאן לגישה מהירה
```

### עלות נוספת

**אפס.** ה-AI ממילא מנתח את ההסתייגות — התקציר מופק באותה קריאה.
התוספת ב-tokens: ~50–100 tokens/הסתייגות (זניח).

---

## 10. מחוון התקדמות ניתוח עמדות (UI)

### הצורך

תהליך ניתוח העמדות הוא **הדרגתי** — לא כל ההצבעות מסווגות ביום אחד.
המשתמש צריך לדעת:

- **כמה מהעבודה כבר בוצעה** (פר כנסת)
- **מה הכיסוי** — ישיר (direct) לעומת נגזר (derived)
- **האם העמדות שהוא רואה מייצגות תמונה מלאה**

### עיצוב — Progress Banner בראש דף העמדות

המחוון יופיע **בראש דף `/policies`**, מתחת ל-beta banner הקיים:

```
┌─────────────────────────────────────────────────────────────┐
│  📊 התקדמות ניתוח עמדות                                     │
│  ──────────────────────                                     │
│  [כנסת 25 ▼]                                                │
│                                                             │
│  ┌─ הצבעות מסווגות ──────────────────────────────────────┐  │
│  │  ████████████████████░░░░░░░░░░  68% (1,247 / 1,834)  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─ עמדות ישירות (direct) ───────────────────────────────┐  │
│  │  🎯 32 עמדות  ·  847 הצבעות מקושרות                    │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─ עמדות נגזרות (derived) ──────────────────────────────┐  │
│  │  🔍 18 עמדות  ·  400 הצבעות מקושרות                    │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ⓘ העמדות מופקות בהדרגה ע"י ניתוח AI של הצבעות במליאה.    │
│    ככל שהניתוח מתקדם, התמונה מדויקת יותר.                  │
└─────────────────────────────────────────────────────────────┘
```

### מבנה הנתונים

שאילתת SQL (server-side, ב-`policies.ts` router או page):

```sql
-- Total votes linked to bills with AI summaries (= eligible for classification)
SELECT
  v.knesset_num,
  COUNT(DISTINCT v.id) AS total_eligible,
  COUNT(DISTINCT vsa.vote_id) AS classified,
  COUNT(DISTINCT ps.id) FILTER (WHERE ps.stance_type = 'direct') AS direct_stances,
  COUNT(DISTINCT ps.id) FILTER (WHERE ps.stance_type = 'derived') AS derived_stances,
  COUNT(DISTINCT vsa.vote_id) FILTER (WHERE ps.stance_type = 'direct') AS direct_votes,
  COUNT(DISTINCT vsa.vote_id) FILTER (WHERE ps.stance_type = 'derived') AS derived_votes
FROM votes v
JOIN bills b ON b.id = v.bill_id
LEFT JOIN vote_stance_alignment vsa ON vsa.vote_id = v.id
LEFT JOIN policy_stances ps ON ps.id = vsa.stance_id
WHERE b.ai_summary IS NOT NULL
GROUP BY v.knesset_num
ORDER BY v.knesset_num DESC;
```

### Interface

```typescript
interface StanceAnalysisProgress {
  knessetNum: number;
  totalEligible: number; // הצבעות שמחוברות לחוק עם סיכום AI
  classified: number; // הצבעות שכבר סווגו
  coveragePercent: number; // classified / totalEligible × 100
  directStances: number; // מספר עמדות ישירות
  derivedStances: number; // מספר עמדות נגזרות
  directVotes: number; // הצבעות מקושרות לעמדות ישירות
  derivedVotes: number; // הצבעות מקושרות לעמדות נגזרות
}
```

### קומפוננטה — `StanceProgressBanner`

```tsx
// src/components/policies/StanceProgressBanner.tsx
'use client';

import { useTranslations } from 'next-intl';
import { BarChart3, Target, Search, Info } from 'lucide-react';
import {
  Progress,
  ProgressTrack,
  ProgressIndicator,
  ProgressLabel,
  ProgressValue,
} from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import KnessetSelect from '@/components/shared/KnessetSelect';

interface StanceProgressBannerProps {
  progress: StanceAnalysisProgress;
  availableKnessets: number[];
  activeKnesset: number;
}

export default function StanceProgressBanner({
  progress,
  availableKnessets,
  activeKnesset,
}: StanceProgressBannerProps) {
  const t = useTranslations('policies.progress');

  return (
    <Card className="mb-6 border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-semibold">{t('title')}</span>
          </div>
          <KnessetSelect
            availableKnessets={availableKnessets}
            activeKnesset={activeKnesset}
          />
        </div>

        {/* Main progress bar — votes classified */}
        <Progress value={progress.coveragePercent}>
          <ProgressLabel>{t('votesClassified')}</ProgressLabel>
          <ProgressValue>
            {progress.coveragePercent}% ({progress.classified} /{' '}
            {progress.totalEligible})
          </ProgressValue>
        </Progress>

        {/* Direct vs Derived breakdown */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <Target className="text-primary h-3.5 w-3.5" />
            <span className="text-xs">
              {t('directStances', {
                count: progress.directStances,
                votes: progress.directVotes,
              })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Search className="text-muted-foreground h-3.5 w-3.5" />
            <span className="text-xs">
              {t('derivedStances', {
                count: progress.derivedStances,
                votes: progress.derivedVotes,
              })}
            </span>
          </div>
        </div>

        {/* Info tooltip */}
        <div className="text-muted-foreground mt-2 flex items-center gap-1 text-xs">
          <Info className="h-3 w-3" />
          <span>{t('disclaimer')}</span>
        </div>
      </CardContent>
    </Card>
  );
}
```

### i18n Keys

```json
"policies": {
  "progress": {
    "title": "התקדמות ניתוח עמדות",
    "votesClassified": "הצבעות מסווגות",
    "directStances": "🎯 {count} עמדות ישירות · {votes} הצבעות",
    "derivedStances": "🔍 {count} עמדות נגזרות · {votes} הצבעות",
    "disclaimer": "העמדות מופקות בהדרגה ע\"י ניתוח AI — ככל שהניתוח מתקדם, התמונה מדויקת יותר."
  }
}
```

### Endpoint (tRPC)

נוסיף endpoint חדש ב-`policies.ts` router:

```typescript
stanceProgress: publicProcedure
  .input(z.object({ knessetNum: z.number().optional() }))
  .query(async ({ input }) => {
    const result = await db.execute(sql`
      SELECT
        v.knesset_num,
        COUNT(DISTINCT v.id)::int AS total_eligible,
        COUNT(DISTINCT vsa.vote_id)::int AS classified,
        COUNT(DISTINCT ps.id) FILTER
          (WHERE ps.stance_type = 'direct')::int AS direct_stances,
        COUNT(DISTINCT ps.id) FILTER
          (WHERE ps.stance_type = 'derived')::int AS derived_stances,
        COUNT(DISTINCT vsa.vote_id) FILTER
          (WHERE ps.stance_type = 'direct')::int AS direct_votes,
        COUNT(DISTINCT vsa.vote_id) FILTER
          (WHERE ps.stance_type = 'derived')::int AS derived_votes
      FROM votes v
      JOIN bills b ON b.id = v.bill_id
      LEFT JOIN vote_stance_alignment vsa ON vsa.vote_id = v.id
      LEFT JOIN policy_stances ps ON ps.id = vsa.stance_id
      WHERE b.ai_summary IS NOT NULL
      ${input.knessetNum
        ? sql`AND v.knesset_num = ${input.knessetNum}`
        : sql``}
      GROUP BY v.knesset_num
      ORDER BY v.knesset_num DESC
    `);

    return result.map(row => ({
      knessetNum: row.knesset_num as number,
      totalEligible: row.total_eligible as number,
      classified: row.classified as number,
      coveragePercent: row.total_eligible
        ? Math.round(((row.classified as number) /
            (row.total_eligible as number)) * 100)
        : 0,
      directStances: row.direct_stances as number,
      derivedStances: row.derived_stances as number,
      directVotes: row.direct_votes as number,
      derivedVotes: row.derived_votes as number,
    }));
  }),
```

### שילוב בדף `/policies`

ב-`src/app/[locale]/(public)/policies/page.tsx`, נוסיף מעל הפילטרים:

```tsx
{/* Progress banner */}
<StanceProgressBanner
  progress={progressData}
  availableKnessets={knessetList}
  activeKnesset={selectedKnesset}
/>

{/* Filters */}
<PoliciesFilter ... />
```

---

## 11. שינויים נדרשים בסכמה

### טבלה חדשה: `reservation_details`

```sql
CREATE TABLE reservation_details (
  id SERIAL PRIMARY KEY,
  vote_id INTEGER REFERENCES votes(id) NOT NULL,
  bill_id INTEGER REFERENCES bills(id) NOT NULL,

  -- Classification
  reservation_type TEXT NOT NULL DEFAULT 'unknown',
    -- 'substantive', 'filibuster', 'supportive', 'moderating', 'unknown'
  filibuster_score REAL DEFAULT 0,     -- 0.0–1.0 heuristic score
  direction_relative_to_bill TEXT,
    -- 'strengthens', 'weakens', 'alternative', 'procedural', null

  -- Content (from protocol extraction)
  reservation_number INTEGER,           -- מספר ההסתייגות
  submitter_names TEXT[],               -- שמות מגישי ההסתייגות
  submitter_member_ids INTEGER[],       -- member IDs if resolved
  target_section TEXT,                  -- סעיף מושא ההסתייגות
  proposed_change JSONB,                -- {he, en, ar, ru}
  rationale JSONB,                      -- {he, en, ar, ru}
  reservation_summary JSONB,            -- {he, en, ar, ru} — תקציר שנוצר ע"י AI בזמן הסיווג
  accepted_in_committee BOOLEAN,        -- האם התקבלה בוועדה

  -- Grouping
  cluster_group_id TEXT,                -- bill_id-session_id for filibuster detection
  protocol_session_id INTEGER REFERENCES committee_sessions(id),

  -- Meta
  source TEXT DEFAULT 'heuristic',      -- 'heuristic', 'protocol_ai', 'manual'
  needs_review BOOLEAN DEFAULT false,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reservation_vote ON reservation_details(vote_id);
CREATE INDEX idx_reservation_bill ON reservation_details(bill_id);
CREATE INDEX idx_reservation_type ON reservation_details(reservation_type);
CREATE INDEX idx_reservation_cluster ON reservation_details(cluster_group_id);
```

### שינוי ב-`vote_stance_alignment`

```sql
ALTER TABLE vote_stance_alignment
  ADD COLUMN vote_weight REAL DEFAULT 1.0,
    -- 1.0 for main votes, 0.05-0.5 for reservations
  ADD COLUMN reservation_type TEXT,
    -- null for non-reservations, else 'substantive'/'filibuster'/etc.
  ADD COLUMN direction_relative_to_bill TEXT,
    -- null for non-reservations
  ADD COLUMN reservation_summary JSONB;
    -- {he, en, ar, ru} — תקציר הסתייגות שנוצר "במכה" יחד עם הסיווג
```

### שינוי ב-`votes`

```sql
ALTER TABLE votes
  ADD COLUMN is_reservation BOOLEAN DEFAULT false,
  ADD COLUMN reservation_cluster_id TEXT;
    -- grouping key for filibuster detection
```

---

## 12. שלבי מימוש

### Phase 1: Heuristic Classification + תקציר AI (ללא AI נוסף לתקציר)

**Effort: 3–4 ימים | Impact: גבוה | Cost: $0 (תקציר מופק באותה קריאת AI)**

1. ✏️ הוסף `is_reservation` ו-`reservation_cluster_id` לטבלת `votes`
2. ✏️ כתוב migration שמסמנת הצבעות קיימות כ-`is_reservation=true` לפי regex
3. ✏️ כתוב את פונקציית `classifyReservation()` (heuristic)
4. ✏️ הוסף `vote_weight` + `reservation_summary` ל-`vote_stance_alignment`
5. ✏️ עדכן `VOTE_STANCE_SKILL` prompt — הוסף כלל לייצר `reservationSummary` בתגובת AI
6. ✏️ עדכן `classify-vote-stances.ts` לשמור `reservation_summary` מתגובת AI
7. ✏️ עדכן את חישוב הציון ב-`policies.ts` router לשקלול דיפרנציאלי
8. ✏️ עדכן `StageVotePanel` להציג badge סוג + תקציר הסתייגות

### Phase 1.5: מחוון התקדמות ניתוח (UI)

**Effort: 1–2 ימים | Impact: בינוני | Cost: $0**

1. ✏️ הוסף `stanceProgress` endpoint ל-`policies.ts` router
2. ✏️ צור `StanceProgressBanner` component
3. ✏️ שלב במחוון בראש דף `/policies` (מעל הפילטרים)
4. ✏️ הוסף i18n keys ב-4 שפות
5. ✏️ עדכן `loading.tsx` skeleton

### Phase 2: Protocol AI Pipeline

**Effort: 5–7 ימים | Impact: גבוה מאוד | Cost: ~$16.50**

1. ✏️ צור `reservation_details` table + migration
2. ✏️ כתוב pipeline job: `extract-reservations-from-protocols.ts`
3. ✏️ כתוב Gemini Flash prompt לחילוץ הסתייגויות מפרוטוקולים
4. ✏️ כתוב matching logic: reservation → vote
5. ✏️ עדכן `classify-vote-stances.ts` לכלול reservation context
6. ✏️ עדכן `reservationSummary` — כשיש תוכן מפרוטוקול, ה-AI מייצר תקציר מדויק יותר

### Phase 3: Enhanced AI Classification

**Effort: 2–3 ימים | Impact: בינוני | Cost: ~$15**

1. ✏️ הרחב את `VOTE_STANCE_SKILL` prompt עם reservation rules מורחבים
2. ✏️ הרץ re-classification על כל הצבעות הסתייגות (כולל תקצירים מחדש)
3. ✏️ עדכן Admin dashboard עם reservation review queue

### Phase 4: UI Enhancements

**Effort: 3–4 ימים | Impact: בינוני**

1. ✏️ הצג תקציר הסתייגות ב-`StageVotePanel` (כבר מ-Phase 1)
2. ✏️ הצג מגיש ההסתייגות (מ-Phase 2 — פרוטוקול)
3. ✏️ הוסף badge "filibuster" / "עניינית" / "תומכת"
4. ✏️ קישור לפרוטוקול הוועדה
5. ✏️ tooltip שמסביר מה המשקל של הסתייגות בציון העמדות
6. ✏️ הצג תקציר הסתייגות גם בדף פרטי עמדה (`PolicyDetailClient`)

---

## סיכום ביניים

### מה שיש היום:

```
Vote → [regex: is reservation?] → same pipeline as regular vote → score
```

### מה שצריך:

```
Vote → [regex: is reservation?]
  ├── NO  → regular pipeline → weight 1.0 → score
  └── YES → [heuristic: filibuster?]
              ├── YES (score ≥ 0.6) → weight 0.05, tag "filibuster" → minimal impact
              └── NO/MAYBE → [protocol extraction: what does it propose?]
                              ├── content found → AI classify with context → weight 0.3-0.5
                              │                  + generate reservationSummary (accurate)
                              └── no content → AI classify title only → weight 0.2 → needs_review
                                               + generate reservationSummary (inferred)
```

**תקציר = "שתי ציפורים במכה":** בכל נתיב שבו AI מסווג הסתייגות,
הוא גם מייצר תקציר קצר — ללא קריאת AI נפרדת.

### תועלת צפויה:

| מדד                               | לפני                  | אחרי                        |
| --------------------------------- | --------------------- | --------------------------- |
| דיוק עמדות על חוקים עם הסתייגויות | ~60%                  | ~85%+                       |
| הטיה מ-filibuster                 | גבוהה                 | אפסית                       |
| שקיפות לאזרח                      | "הסתייגות" (מילה אחת) | תקציר + מגיש + סוג          |
| תקציר הסתייגות                    | אין                   | תקציר AI ב-4 שפות           |
| מחוון כיסוי ניתוח                 | אין                   | progress bar פר כנסת        |
| כיסוי פרוטוקולים                  | 0%                    | ~70% של חוקים עם הסתייגויות |
