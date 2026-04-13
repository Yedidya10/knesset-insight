# 15 — מפת בוחרים אינטראקטיבית: תוצאות בחירות לפי יישובים

## חזון

מפה אינטראקטיבית של ישראל המציגה נתוני בחירות לפי יישוב — אחוזי הצבעה, התפלגות סיעתית, מגמות בין כנסות — עם UI עשיר, אנימציות וחוויית drill-down מהנה.

---

## 🗺️ חלק א׳: מקור נתוני מפה (GeoJSON)

### גבולות יישובים

ועדת הבחירות המרכזית מפרסמת תוצאות לפי **יישוב** (כ-1,200 יישובים). נדרש GeoJSON/TopoJSON עם polygons לכל יישוב/רשות מקומית.

**מקורות GeoJSON:**

| מקור                                    | תיאור                              | רישיון        |
| --------------------------------------- | ---------------------------------- | ------------- |
| **data.gov.il** — גבולות רשויות מקומיות | Shapefile רשמי מהמרכז למיפוי ישראל | ממשלתי — חינם |
| **geojson.io / mapshaper**              | המרת Shapefile → GeoJSON/TopoJSON  | כלי           |
| **OpenStreetMap** (Overpass API)        | גבולות admin level 8 (מוניציפלי)   | ODbL          |
| **Natural Earth**                       | גבולות ארציים בלבד (לא יישובי)     | Public Domain |

**אסטרטגיה מומלצת:**

1. הורדת Shapefile מ-data.gov.il (גבולות שיפוט רשויות מקומיות)
2. המרה ל-TopoJSON באמצעות `mapshaper` (הקטנת גודל מ-~30MB ל-~3MB)
3. אחסון ב-`public/geo/israel-municipalities.topojson`
4. Simplification להפחתת מורכבות polygons (threshold ~0.01)

### קובץ GeoJSON מופשט

```
public/
  geo/
    israel-outline.json          ← קו מתאר ישראל בלבד (fallback)
    israel-municipalities.topojson ← כל ה-polygons של רשויות מקומיות
    israel-districts.topojson     ← 7 מחוזות (אופציונלי, zoom-out view)
```

**Properties נדרשים בכל polygon:**

```json
{
  "type": "Feature",
  "properties": {
    "name_he": "תל אביב-יפו",
    "name_en": "Tel Aviv-Yafo",
    "name_ar": "تل أبيب-يافا",
    "muni_code": "5000", // קוד יישוב (CBS/למ"ס)
    "district": "תל אביב",
    "type": "city" // city | local_council | regional_council
  }
}
```

---

## 📊 חלק ב׳: מקור נתוני בחירות

### ועדת הבחירות המרכזית

כל כנסת מפרסמת CSV עם תוצאות לפי יישוב:

| כנסת | URL                                              | תאריך      |
| ---- | ------------------------------------------------ | ---------- |
| 25   | `https://media25.bechirot.gov.il/files/expc.csv` | 01/11/2022 |
| 24   | `https://media24.bechirot.gov.il/files/expc.csv` | 23/03/2021 |
| 23   | `https://media23.bechirot.gov.il/files/expc.csv` | 02/03/2020 |
| 22   | `https://media22.bechirot.gov.il/files/expc.csv` | 17/09/2019 |
| 21   | `https://media21.bechirot.gov.il/files/expc.csv` | 09/04/2019 |
| 20   | `https://media20.bechirot.gov.il/files/expc.csv` | 17/03/2015 |

**מבנה CSV (expc — תוצאות לפי יישובים):**

```
שם ישוב, סמל ישוב, בזב (בעלי זכות בחירה), מצביעים, כשרים, פסולים,
אותיות-רשימה1, קולות1, אותיות-רשימה2, קולות2, ...
```

**מבנה CSV (expb — תוצאות לפי קלפיות):**

```
סמל ישוב, שם ישוב, מספר קלפי, בזב, מצביעים, כשרים, פסולים,
אותיות-רשימה1, קולות1, ...
```

### סכמת DB חדשה

```sql
-- תוצאות בחירות לפי יישוב
CREATE TABLE election_city_results (
  id SERIAL PRIMARY KEY,
  knesset_num INTEGER NOT NULL,             -- 20-25+
  city_code TEXT NOT NULL,                  -- סמל יישוב (CBS)
  city_name TEXT NOT NULL,                  -- שם יישוב
  eligible_voters INTEGER NOT NULL,         -- בעלי זכות בחירה
  actual_voters INTEGER NOT NULL,           -- מצביעים בפועל
  valid_votes INTEGER NOT NULL,             -- קולות כשרים
  invalid_votes INTEGER NOT NULL,           -- קולות פסולים
  turnout_percent NUMERIC(5,2),             -- אחוז הצבעה
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(knesset_num, city_code)
);

-- תוצאות לפי סיעה בכל יישוב
CREATE TABLE election_city_party_results (
  id SERIAL PRIMARY KEY,
  city_result_id INTEGER REFERENCES election_city_results(id) ON DELETE CASCADE,
  ballot_letters TEXT NOT NULL,             -- אותיות מצביע (מחל, פה, ט...)
  party_name TEXT NOT NULL,                 -- שם הרשימה
  votes INTEGER NOT NULL,                   -- כמות קולות
  vote_percent NUMERIC(5,2),               -- אחוז מתוך הכשרים ביישוב
  UNIQUE(city_result_id, ballot_letters)
);

-- מטא-דאטא של כנסות היסטוריות (אם לא קיים)
CREATE TABLE election_metadata (
  knesset_num INTEGER PRIMARY KEY,
  election_date DATE NOT NULL,
  total_eligible INTEGER,
  total_voters INTEGER,
  total_valid INTEGER,
  turnout_percent NUMERIC(5,2)
);
```

### סקריפט Import

```
src/scripts/import-election-results.ts
```

- טוען CSVs מוועדת הבחירות (כנסות 20–25)
- Parsing עברית (encoding: windows-1255 / UTF-8)
- Mapping סמל יישוב ↔ GeoJSON `muni_code`
- Batch insert ל-DB

---

## 🎨 חלק ג׳: ספריית ויזואליזציה

### השוואת גישות

| ספרייה                         | יתרונות                                                                             | חסרונות                                                | Bundle Size    |
| ------------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------ | -------------- |
| **react-simple-maps** + d3-geo | SVG-based, declarative React, קל לצביעה/hover/click, מותאם shadow DOM, SSR-friendly | לא WebGL, פחות מתאים ל-100K+ polygons                  | ~30KB gzip     |
| **Leaflet** (react-leaflet)    | Tile-based, zoom מובנה, plugins עשירים                                              | רינדור DOM כבד, פחות React-idiomatic                   | ~45KB gzip     |
| **Mapbox GL** (react-map-gl)   | WebGL, ביצועים גבוהים, styles מרהיבים                                               | דורש API key (חינם עד 50K loads), license requirements | ~210KB gzip    |
| **@visx/geo**                  | Low-level, TypeScript-first, Airbnb בפרודקשן                                        | יותר boilerplate, פחות out-of-the-box interactions     | ~15KB gzip     |
| **D3 ישיר**                    | שליטה מלאה                                                                          | אין React bindings, ניהול DOM ידני                     | ~20KB (d3-geo) |

### ✅ המלצה: `react-simple-maps`

**סיבות:**

1. **SVG = React natural** — כל polygon הוא `<path>` → קל לצביעה, hover, click, tooltip
2. **TopoJSON built-in** — טוען ישירות topojson
3. **קליל** — 30KB, תואם tree-shaking
4. **533K weekly downloads** — קהילה חיה ותחזוקה
5. **אנימציות** — משתלב עם `framer-motion` / `react-spring`
6. **RTL-friendly** — SVG לא תלוי בכיוון כתיבה
7. **SSR-compatible** — חשוב ל-Next.js App Router

**חבילות נדרשות:**

```bash
pnpm add react-simple-maps d3-scale d3-interpolate
pnpm add -D @types/react-simple-maps
```

---

## 🖥️ חלק ד׳: ארכיטקטורת UI ו-Interaction Design

### הדף הראשי: `/[locale]/elections/map`

```
┌──────────────────────────────────────────────────────────────┐
│  🗳️ מפת בחירות ישראל                     [כנסת 25 ▼] 🔄    │
│                                                              │
│  ┌─────────────────────────┐  ┌────────────────────────────┐ │
│  │                         │  │  📊 סיכום ארצי              │ │
│  │                         │  │  ━━━━━━━━━━━━━━━━━━━━━━━━  │ │
│  │                         │  │  בעלי זכות: 6,788,804      │ │
│  │      מפת ישראל          │  │  מצביעים:   4,794,593      │ │
│  │      (Choropleth)       │  │  אחוז:      70.63%         │ │
│  │                         │  │                            │ │
│  │   צבע = אחוז הצבעה      │  │  📈 טופ 5 סיעות:           │ │
│  │   hover = שם יישוב      │  │  ■ הליכוד     23.4%        │ │
│  │   click = drill-down    │  │  ■ יש עתיד    17.8%        │ │
│  │                         │  │  ■ הציונות הד. 10.8%       │ │
│  │                         │  │  ■ המחנה ממל.  9.1%        │ │
│  │                         │  │  ■ ש"ס         8.3%        │ │
│  └─────────────────────────┘  └────────────────────────────┘ │
│                                                              │
│  ┌─ מצב צפייה ──────────────────────────────────────────────┐│
│  │  [🗳️ אחוז הצבעה]  [🏛️ מפלגה מובילה]  [📊 השוואת כנסות] ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

### מצבי צפייה (View Modes)

#### 1. 🗳️ Choropleth — אחוז הצבעה (Turnout)

- **צביעה:** גוון primary-color מבהיר (turnout נמוך) לכהה (turnout גבוה)
- **Scale:** `d3.scaleSequential(d3.interpolateBlues).domain([30, 90])`
- **Hover:** tooltip עם שם יישוב + אחוז הצבעה + מספר בוחרים
- **Legend:** gradient bar עם label-ים (30%–90%)

#### 2. 🏛️ Winning Party Map

- **צביעה:** כל יישוב בצבע המפלגה שקיבלה הכי הרבה קולות
- **Hover:** שם יישוב + מפלגה מובילה + אחוז
- **Legend:** רשימת מפלגות עם צבעים
- **אנימציה:** fade-in of party colors כש-mode משתנה

#### 3. 📊 Migration Map — השוואת כנסות

- **בחירה:** כנסת מ → כנסת ל (למשל 24→25)
- **צביעה:** ירוק = עלייה באחוז הצבעה, אדום = ירידה
- **Scale:** diverging (`d3.scaleDiverging(d3.interpolateRdYlGn)`)
- **Hover:** "+5.2% מכנסת 24"

---

### Drill-Down: לחיצה על יישוב

כשלוחצים על יישוב, נפתח **Side Panel** (slide-in) עם:

```
┌─────────── פאנל יישוב ──────────────┐
│  ✕                                   │
│  🏙️ תל אביב-יפו                     │
│  מחוז: תל אביב                       │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                       │
│  📊 כנסת 25 (01/11/2022)              │
│  ┌─────────────────────────────────┐  │
│  │  בעלי זכות:  342,100           │  │
│  │  הצביעו:     231,400           │  │
│  │  אחוז:       67.6%             │  │
│  │  ■■■■■■■■■■■■■■░░░░░░ 67.6%   │  │
│  └─────────────────────────────────┘  │
│                                       │
│  🍩 התפלגות סיעתית (Donut Chart)      │
│  ┌─────────────────────────────────┐  │
│  │        ╭───╮                    │  │
│  │     ╭──╯   ╰──╮                │  │
│  │    ╭╯⬜ 23.4%  ╰╮   ■ הליכוד   │  │
│  │    │ ⬛ 28.1%   │   ■ יש עתיד  │  │
│  │    ╰╮          ╭╯   ■ מחנה ממל. │  │
│  │     ╰──╮   ╭──╯    ■ אחרים     │  │
│  │        ╰───╯                    │  │
│  └─────────────────────────────────┘  │
│                                       │
│  📈 מגמות בין כנסות (Line Chart)      │
│  ┌─────────────────────────────────┐  │
│  │      ╱─────                     │  │
│  │  ───╱                           │  │
│  │ ────────────                    │  │
│  │  K21  K22  K23  K24  K25        │  │
│  │  —■ הצבעה%  —■ הליכוד%          │  │
│  └─────────────────────────────────┘  │
│                                       │
│  🏆 טופ 5 סיעות                       │
│  ┌─────────────────────────────────┐  │
│  │  1. יש עתיד    ████████ 28.1%  │  │
│  │  2. הליכוד     ██████   23.4%  │  │
│  │  3. המחנה ממל. ████     15.2%  │  │
│  │  4. העבודה     ███       9.8%  │  │
│  │  5. מרצ        ██        7.1%  │  │
│  └─────────────────────────────────┘  │
│                                       │
│  [🔗 ראה תוצאות מלאות]                │
└───────────────────────────────────────┘
```

---

### אנימציות ואינטראקציות

| אינטראקציה                 | אפקט                                                | ספרייה                            |
| -------------------------- | --------------------------------------------------- | --------------------------------- |
| **Hover על יישוב**         | גבול מודגש (stroke-width ↑), tooltip עם שם + מספרים | CSS + shadcn Tooltip              |
| **Click על יישוב**         | Side panel slide-in, היישוב "מהבהב" בגבול זוהר      | `framer-motion` AnimatePresence   |
| **החלפת כנסת**             | כל ה-polygons animateם מצבע ישן → חדש (morphing)    | `framer-motion` layout animation  |
| **החלפת View Mode**        | Fade-crossover בין color schemes                    | CSS transition 300ms              |
| **Zoom (גלגלת עכבר)**      | SVG viewBox zoom + pan                              | `react-simple-maps` ZoomableGroup |
| **Pinch-to-zoom (mobile)** | Touch events                                        | built-in ZoomableGroup            |
| **ESC / click outside**    | סגירת side panel                                    | Event listener                    |
| **Scroll legend**          | Highlight יישובים בטווח ה-legend                    | d3-brush on legend bar            |

### אנימציות מהנות (Delight)

1. **First Load:** מפת ישראל "מצטיירת" מלמעלה למטה (staggered path draw animation)
2. **Data Loaded:** ה-polygons "מתמלאים" בצבע אחד-אחד (staggered fill animation, 1.5s total)
3. **Hover ripple:** גלי hover קלים שמתפשטים מהעכבר
4. **Number counter:** מספרים ב-panel עולים ב-count-up animation
5. **Confetti micro-animation:** כשלוחצים על העיר עם אחוז ההצבעה הגבוה ביותר 🎉

---

## 🗂️ חלק ה׳: מבנה קבצים

```
src/
  app/[locale]/(public)/elections/
    map/
      page.tsx                    ← Server Component: טוען data, renders Map
      loading.tsx                 ← Skeleton (מפה אפורה + shimmer)

  components/elections/
    map/
      IsraelMap.tsx              ← Client Component ראשי (react-simple-maps)
      MapControls.tsx            ← בחירת כנסת + view mode
      MapLegend.tsx              ← Legend דינאמי (gradient / categorical)
      MapTooltip.tsx             ← Hover tooltip
      CityDetailPanel.tsx        ← Side panel לאחר לחיצה
      CityDonutChart.tsx         ← Donut chart (recharts PieChart)
      CityTrendChart.tsx         ← Line chart מגמות (recharts LineChart)
      CityPartyBars.tsx          ← Horizontal bar chart סיעות
      VoterStatsCard.tsx         ← כרטיסיית סטטיסטיקה (eligible/actual/turnout)
      NationalSummary.tsx        ← סיכום ארצי בצד המפה
      MapSkeleton.tsx            ← Loading skeleton

  server/routers/
    election-map.ts              ← tRPC router עם procedures:
                                    - nationalSummary(knessetNum)
                                    - cityResults(knessetNum)
                                    - cityDetail(knessetNum, cityCode)
                                    - cityTrends(cityCode)  // כל הכנסות
                                    - availableKnessets()

  lib/db/schema.ts               ← הוספת election_city_results + city_party_results

  scripts/
    import-election-results.ts   ← Seed script: CSV → DB
    convert-geo.ts               ← Shapefile → TopoJSON conversion helper

  i18n/messages/
    he.json → electionMap.*
    en.json → electionMap.*
    ar.json → electionMap.*
    ru.json → electionMap.*
```

---

## 🌍 חלק ו׳: i18n Keys

```json
{
  "electionMap": {
    "title": "מפת בחירות ישראל",
    "description": "תוצאות בחירות לפי יישוב — אחוזי הצבעה, סיעות, ומגמות",
    "selectKnesset": "בחר כנסת",
    "knesset": "כנסת {num}",
    "viewMode": {
      "turnout": "אחוז הצבעה",
      "winningParty": "מפלגה מובילה",
      "comparison": "השוואת כנסות"
    },
    "national": {
      "title": "סיכום ארצי",
      "eligible": "בעלי זכות בחירה",
      "voters": "מצביעים בפועל",
      "turnout": "אחוז הצבעה",
      "validVotes": "קולות כשרים",
      "invalidVotes": "קולות פסולים",
      "topParties": "טופ {count} סיעות"
    },
    "city": {
      "detail": "פרטי יישוב",
      "district": "מחוז",
      "partyBreakdown": "התפלגות סיעתית",
      "trends": "מגמות בין כנסות",
      "topParties": "סיעות מובילות",
      "fullResults": "ראה תוצאות מלאות",
      "noData": "אין נתונים ליישוב זה"
    },
    "legend": {
      "low": "נמוך",
      "high": "גבוה",
      "increase": "עלייה",
      "decrease": "ירידה",
      "noChange": "ללא שינוי"
    },
    "comparison": {
      "from": "מכנסת",
      "to": "לכנסת",
      "change": "שינוי"
    },
    "tooltip": {
      "eligible": "בעלי זכות: {count}",
      "voted": "הצביעו: {count}",
      "turnout": "אחוז: {percent}%"
    }
  }
}
```

---

## ⚡ חלק ז׳: ביצועים ואופטימיזציה

### Map Performance

| אתגר                      | פתרון                                                  |
| ------------------------- | ------------------------------------------------------ |
| קובץ TopoJSON גדול (~3MB) | TopoJSON simplification + gzip (→ ~500KB), lazy load   |
| ~1,200 polygons ב-SVG     | `React.memo` + `useMemo` לצביעה, virtualize off-screen |
| Hover latency             | CSS `:hover` for stroke, JS only for tooltip data      |
| ראנדור בכניסה             | SSR skeleton + client-side hydration עם `"use client"` |
| Mobile touch              | `ZoomableGroup` built-in touch support                 |

### Data Loading Strategy

```
1. Page load → SSR skeleton (MapSkeleton)
2. Client hydrate → fetch nationalSummary + cityResults (parallel)
3. TopoJSON → loaded via dynamic import / lazy <Suspense>
4. User clicks city → fetch cityDetail (on-demand, cached in React Query)
5. User changes knesset → refetch cityResults (prefetch next/prev)
```

### Caching

```typescript
// tRPC cache hints
cityResults: {
  staleTime: Infinity,  // election data doesn't change
  cacheTime: 24 * 60 * 60 * 1000,  // 24h in React Query cache
}
```

Redis cache with infinite TTL (election results are immutable).

---

## 📱 חלק ח׳: Responsive Design

### Desktop (≥1024px)

- מפה 60% רוחב | Panel 40% רוחב
- Side panel slides from end (RTL: left, LTR: right)

### Tablet (768–1023px)

- מפה 100% רוחב
- Panel = bottom sheet (50vh)

### Mobile (< 768px)

- מפה full-width, controls above
- Panel = full-screen bottom sheet (swipe down to dismiss)
- Simplified tooltip (tap = select, no hover)
- Legend collapsed by default

---

## 🔒 חלק ט׳: Accessibility

| דרישה           | מימוש                                              |
| --------------- | -------------------------------------------------- |
| WCAG 2.1 AA     | ניגודיות צבע ≥ 4.5:1 בכל view mode                 |
| Screen reader   | כל polygon עם `aria-label` = שם יישוב + נתון מספרי |
| Keyboard nav    | Tab בין יישובים (ordered א-ב), Enter = select      |
| Focus indicator | Ring around focused polygon                        |
| Color blindness | אפשרות palette חלופי (viridis, מגנטה-ירוק)         |
| Reduced motion  | `prefers-reduced-motion` → ביטול אנימציות          |

---

## 🚀 חלק י׳: שלבי מימוש

### Phase A — Foundation (MVP)

- [ ] הורדת GeoJSON ישראל + המרה ל-TopoJSON
- [ ] DB migration: `election_city_results` + `election_city_party_results`
- [ ] Import script: CSV → DB (כנסות 20-25)
- [ ] tRPC router: `electionMap.*`
- [ ] `IsraelMap` component (react-simple-maps) — Choropleth אחוז הצבעה
- [ ] `MapTooltip` — hover עם שם + אחוז
- [ ] `MapLegend` — gradient legend
- [ ] `MapControls` — בחירת כנסת
- [ ] Page + loading skeleton
- [ ] i18n (4 שפות)

### Phase B — Drill-Down

- [ ] `CityDetailPanel` — side panel עם נתונים
- [ ] `CityDonutChart` — pie chart סיעתי
- [ ] `CityPartyBars` — horizontal bars
- [ ] `VoterStatsCard` — מספרים עם count-up
- [ ] Responsive bottom sheet (mobile)

### Phase C — Advanced Views

- [ ] Winning Party Map mode
- [ ] Comparison Map mode (כנסת-כנסת)
- [ ] `CityTrendChart` — line chart בין כנסות
- [ ] `NationalSummary` — panel צד ארצי

### Phase D — Polish & Delight

- [ ] Entry animations (staggered fill)
- [ ] Hover ripple effects
- [ ] Confetti micro-interaction
- [ ] Keyboard navigation
- [ ] Color-blind palette option
- [ ] Performance optimization (memo, virtualization)
- [ ] PWA: cache TopoJSON + data in service worker

---

## 🔧 חלק י״א: Configuration

```typescript
// app.config.ts additions
electionMap: {
  /** Available knesset numbers for historical data */
  availableKnessets: [20, 21, 22, 23, 24, 25],
  /** Default knesset to show on page load */
  defaultKnesset: 25,
  /** TopoJSON file path */
  topoJsonPath: '/geo/israel-municipalities.topojson',
  /** Color scales */
  turnoutColorRange: ['#e0f2fe', '#0c4a6e'],  // sky-100 → sky-900
  /** Minimum polygon area to render label */
  minLabelArea: 0.001,
  /** Data sources */
  csvBaseUrl: 'https://media{N}.bechirot.gov.il/files/expc.csv',
}
```

---

## 📌 סיכום טכנולוגי

| רכיב                | טכנולוגיה                                          |
| ------------------- | -------------------------------------------------- |
| Map rendering       | `react-simple-maps` + d3-geo (SVG)                 |
| Map data            | TopoJSON (converted from data.gov.il Shapefile)    |
| Election data       | CSV from bechirot.gov.il → DB                      |
| Charts (city panel) | `recharts` (PieChart, LineChart, BarChart)         |
| Animations          | `framer-motion` + CSS transitions                  |
| State management    | React Query (tRPC) + `useState` for UI             |
| Color scales        | `d3-scale` + `d3-interpolate`                      |
| Tooltip             | shadcn/ui Tooltip or custom positioned div         |
| i18n                | `next-intl` (4 שפות)                               |
| DB                  | Drizzle ORM → Supabase PostgreSQL                  |
| Cache               | Redis (Upstash) — infinite TTL for historical data |
