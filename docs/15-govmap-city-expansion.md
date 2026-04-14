# GovMap API — City & Settlement Map Expansion Plan

## Goal

Expand the election map from **7 districts** to **city/settlement-level** boundaries using the **GovMap (פורטל המפות הממשלתי)** API, enabling drill-down from district → city → neighborhood.

---

## 1. GovMap API Overview

**Portal**: https://www.govmap.gov.il/  
**API Docs**: https://api.govmap.gov.il/docs/intro

GovMap provides geographic data sharing via three integration methods (ascending complexity):

| Method                   | Description                                                           | Requires API Key |
| ------------------------ | --------------------------------------------------------------------- | ---------------- |
| **URL**                  | Navigate to GovMap with predefined params (coordinates, zoom, layers) | No               |
| **HTML Embed**           | Embed map iframe in external site                                     | No               |
| **JavaScript Functions** | Advanced map manipulation, search, spatial queries                    | **Yes**          |

### Authentication

- Requires an **API key** (apiToken) obtained from GovMap personal area
- Key is bound to a specific **domain** (needs to match request origin)
- All JS function calls must include `apiKey` parameter

---

## 2. Relevant Layers for Election Map

From Appendix A (layer names):

| Layer Name          | Hebrew              | Description                                              |
| ------------------- | ------------------- | -------------------------------------------------------- |
| `LOCALITY`          | ישובים              | **Settlement points** — best for geocoding cities        |
| `LOCALITY_210410`   | גבולות ישובים       | **Settlement boundaries (polygons)** — municipal borders |
| `LOCALITY_VAAD0410` | גבולות וועדי ישובים | Settlement committee boundaries                          |
| `yeshuvim`          | אזורים מוניציפליים  | **Municipal areas** (larger scale)                       |
| `MUNICIPALY`        | מועצות אזוריות      | Regional councils                                        |
| `REGION`            | מחוזות משרד הפנים   | Ministry of Interior districts (matches our 7 districts) |
| `COUNTY`            | נפות משרד הפנים     | Sub-districts (nafot) — intermediate level               |
| `Neighborhood`      | שכונות              | Neighborhoods within cities                              |
| `statistic_areas`   | אזורים סטטיסטיים    | CBS statistical areas                                    |

### Recommended layers for our use case:

1. **`LOCALITY_210410`** — settlement boundary polygons for the choropleth
2. **`REGION`** — district boundaries (we already have from GADM, but GovMap's are official)
3. **`COUNTY`** — sub-district (nafa) boundaries for intermediate zoom level

---

## 3. Key API Functions

### 3.1 Search Engine (`govmap.search`)

Search for settlements, addresses, streets etc. with autocomplete.

```javascript
const params = {
  searchText: 'באר שבע',
  language: 'he',
  maxResults: 10,
  isAccurate: true,
  apiKey: 'YOUR_API_TOKEN',
  // Optional: filter by datatypes
  // layers: ['settlement', 'street']
};

govmap.search(params).then((response) => {
  // response.results: SearchData[]
  // response.resultsCount: number
  // response.aggregations: [{key, count}]
});
```

**Supported Datatypes for search:**

| Type           | Description                     |
| -------------- | ------------------------------- |
| `settlement`   | יישוב (settlement)              |
| `neighborhood` | שכונה (neighborhood)            |
| `street`       | רחוב (street)                   |
| `address`      | כתובת (address)                 |
| `statistic`    | אזור סטטיסטי (statistical area) |
| `block`        | גוש (block)                     |
| `parcel`       | חלקה (parcel)                   |

### 3.2 Get Detailed Search Result (`govmap.getSearchResultData`)

After getting a search result, retrieve full details (centroid, geometry polygon).

```javascript
// Pass a SearchData object from search results
govmap.getSearchResultData(searchResult, 'YOUR_API_TOKEN').then((response) => {
  // response.text: display text
  // response.centroid: "POINT (x y)" — Israeli New Grid or WGS84
  // response.type: "settlement" | "address" | ...
  // response.geom: WKT geometry (POLYGON/MULTIPOLYGON for boundaries)
});
```

### 3.3 Spatial Query (`govmap.getLayerFeaturesByLocation`)

Get features from a specific layer by location (point + radius or polygon).

```javascript
const payload = {
  geometry: 'POINT(179614.81 663968.73)', // WKT, Israeli New Grid
  radius: 100, // meters
  layers: [{ name: 'LOCALITY_210410', fields: ['name', 'sug_yishuv'] }],
};

govmap.getLayerFeaturesByLocation(payload, 'apiToken').then((response) => {
  // response.layers.LOCALITY_210410: [{attributes, id, idFieldName}]
});
```

### 3.4 URL-Based Navigation (No API Key)

```
https://www.govmap.gov.il/?c=179449,663927&z=8&b=0&lay=LOCALITY_210410
```

| Param | Description                               |
| ----- | ----------------------------------------- |
| `c`   | Coordinates (Israeli New Grid or WGS84)   |
| `z`   | Zoom level (0-10, 0=country, 10=street)   |
| `b`   | Background (0=streets, 1=aerial, 2=mixed) |
| `lay` | Layer names (comma-separated)             |

---

## 4. Coordinate Systems

GovMap uses **Israeli New Grid (ITM)** / EPSG:2039 by default.  
Also supports **WGS84** (EPSG:4326) for coordinates.

For our React frontend (react-simple-maps with WGS84 GeoJSON), we'd need to:

- Convert ITM polygons → WGS84 using `proj4` library
- Or request data in WGS84 if the API supports it

---

## 5. Implementation Plan

### Phase 1: Obtain Settlement Boundary GeoJSON

**Option A — Pre-processed GeoJSON (Recommended)**

1. Download settlement boundaries from CBS (data.gov.il) or GovMap
2. Convert to TopoJSON (like current GADM district file)
3. Include city code (`סמל_ישוב`) as a property for joining with election data
4. Store as static file in `public/data/`

**Option B — Runtime GovMap API**

1. Register for GovMap API key
2. On district click, fetch settlement boundaries within that district
3. Render as dynamic SVG paths over the map
4. Cache responses in Redis

**Recommendation**: Phase 1 = Option A (faster, no API dependency, works offline/PWA). Option B for future search/geocoding features.

### Phase 2: Three-Level Drill-Down UI

```
District Map (current) → City Map (new) → City Detail Panel (existing)
```

1. **District View (existing)**: 7 districts, choropleth by turnout
2. **City View (new)**: Click district → zoom into city-level boundaries within that district
3. **City Detail (existing)**: Click city → show party breakdown, trends

#### Component Changes:

- `IsraelMap.tsx`: Add zoom state machine (district → city)
- `ElectionMapClient.tsx`: Manage drill-down state, fetch city-level data
- New: `DistrictCityMap.tsx` — renders city boundaries within a district
- `districtResults` tRPC → add city list per district

### Phase 3: Search Integration

Use GovMap search to let users find their city:

```
[Search box: "הקלד שם יישוב..."]
  → govmap.search({searchText: input, layers: ['settlement']})
  → Zoom map to selected city
  → Show city detail panel
```

### Phase 4: GovMap Embed (Optional)

For advanced features (aerial photos, building-level detail), embed GovMap iframe alongside our custom election overlay.

---

## 6. Data Source Strategy

| Level              | Data Source                         | Boundary Source                           |
| ------------------ | ----------------------------------- | ----------------------------------------- |
| District (מחוז)    | Aggregated from city data           | GADM Level 1 (current) or GovMap `REGION` |
| Sub-district (נפה) | Aggregated from city data           | GovMap `COUNTY`                           |
| City (יישוב)       | `expc.csv` from Elections Committee | GovMap `LOCALITY_210410` or CBS           |
| Neighborhood       | Future — ballot-level data          | GovMap `Neighborhood`                     |

### Joining Election Data with Boundaries

The elections CSV has `סמל ישוב` (city code) which matches the CBS settlement code. GovMap layers also use this code. The join key is:

```
election_city_results.cityCode  ←→  GeoJSON properties.סמל_ישוב
```

---

## 7. API Key & Access

To use JS functions:

1. Register at https://www.govmap.gov.il/
2. Go to: אפשרויות משתמש → ניהול API
3. Create new API key for our domain
4. Store in `.env.local` as `GOVMAP_API_KEY`

**Rate limits**: Not explicitly documented; recommended to cache aggressively.

---

## 8. Considerations

- **GeoJSON Size**: 1,200+ settlements = large GeoJSON. Use TopoJSON compression (80%+ size reduction)
- **Performance**: Render only visible settlements at current zoom level
- **Offline/PWA**: Pre-processed TopoJSON files work offline; API calls don't
- **Hebrew text**: GovMap API supports `language: 'he'` for all search/display
- **Coordinate conversion**: Use `proj4` for ITM ↔ WGS84 if needed
- **Error handling**: GovMap recommends wrapping all calls in try-catch

---

## 9. Priority & Timeline

| Priority | Task                                     | Dependencies          |
| -------- | ---------------------------------------- | --------------------- |
| **P0**   | Download CBS settlement boundary GeoJSON | None                  |
| **P0**   | Convert to TopoJSON with city codes      | P0                    |
| **P1**   | District → city drill-down UI            | P0, existing tRPC     |
| **P1**   | City-level choropleth rendering          | P0                    |
| **P2**   | GovMap API key registration              | None                  |
| **P2**   | Settlement search with autocomplete      | GovMap API key        |
| **P3**   | Sub-district (nafa) intermediate level   | GovMap `COUNTY` layer |
| **P3**   | GovMap embed for advanced features       | GovMap API key        |
