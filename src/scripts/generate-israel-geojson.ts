/**
 * Generate Israel district boundary TopoJSON from GADM data.
 *
 * Downloads GADM Level 1 (districts/mehozot) GeoJSON for Israel,
 * enriches with standardized district codes matching the CBS classification,
 * and converts to simplified TopoJSON.
 *
 * Usage:
 *   pnpm tsx src/scripts/generate-israel-geojson.ts
 *
 * Output:
 *   public/geo/israel-municipalities.topojson
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const GADM_URL =
  'https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_ISR_1.json';
const OUTPUT_DIR = join(process.cwd(), 'public', 'geo');
const OUTPUT_FILE = join(OUTPUT_DIR, 'israel-municipalities.topojson');

/**
 * GADM NAME_1 → CBS district code mapping.
 * CBS district codes (מחוז):
 *   1 = Jerusalem, 2 = HaZafon (North), 3 = Haifa,
 *   4 = HaMerkaz (Center), 5 = Tel Aviv, 6 = HaDarom (South)
 * Golan is mapped to HaZafon (2) as it's administered under the Northern District.
 */
const DISTRICT_MAP: Record<
  string,
  { code: string; name_he: string; name_en: string; name_ar: string }
> = {
  Jerusalem: {
    code: '1',
    name_he: 'ירושלים',
    name_en: 'Jerusalem',
    name_ar: 'القدس',
  },
  HaZafon: {
    code: '2',
    name_he: 'הצפון',
    name_en: 'Northern',
    name_ar: 'الشمال',
  },
  Haifa: {
    code: '3',
    name_he: 'חיפה',
    name_en: 'Haifa',
    name_ar: 'حيفا',
  },
  HaMerkaz: {
    code: '4',
    name_he: 'המרכז',
    name_en: 'Central',
    name_ar: 'المركز',
  },
  TelAviv: {
    code: '5',
    name_he: 'תל אביב',
    name_en: 'Tel Aviv',
    name_ar: 'تل أبيب',
  },
  HaDarom: {
    code: '6',
    name_he: 'הדרום',
    name_en: 'Southern',
    name_ar: 'الجنوب',
  },
  Golan: {
    code: '2',
    name_he: 'הגולן',
    name_en: 'Golan',
    name_ar: 'الجولان',
  },
};

async function fetchGADMData(): Promise<GeoJSON.FeatureCollection> {
  console.log(`📡 Downloading GADM Israel Level 1 from ${GADM_URL}...`);

  const response = await fetch(GADM_URL);
  if (!response.ok) {
    throw new Error(
      `GADM download failed: ${response.status} ${response.statusText}`,
    );
  }

  const geojson = (await response.json()) as GeoJSON.FeatureCollection;
  console.log(`   ✅ Downloaded ${geojson.features.length} district features`);
  return geojson;
}

function enrichFeatures(
  geojson: GeoJSON.FeatureCollection,
): GeoJSON.FeatureCollection {
  console.log('🏷️  Enriching features with district codes...');

  // Since Golan maps to the same district code as HaZafon,
  // we merge the Golan polygon into HaZafon.
  const mergedFeatures: GeoJSON.Feature[] = [];
  let golanFeature: GeoJSON.Feature | null = null;
  let hazafonFeature: GeoJSON.Feature | null = null;

  for (const feature of geojson.features) {
    const gadmName = (feature.properties?.NAME_1 as string) || '';
    const mapping = DISTRICT_MAP[gadmName];

    if (!mapping) {
      console.log(`   ⚠️ Skipping unknown district: ${gadmName}`);
      continue;
    }

    feature.properties = {
      muni_code: mapping.code,
      name_he: mapping.name_he,
      name_en: mapping.name_en,
      name_ar: mapping.name_ar,
      gadm_name: gadmName,
    };

    if (gadmName === 'Golan') {
      golanFeature = feature;
      console.log(`   🔗 ${gadmName} → will merge into HaZafon (2)`);
    } else if (gadmName === 'HaZafon') {
      hazafonFeature = feature;
      console.log(
        `   ✅ ${gadmName} → district ${mapping.code} (${mapping.name_he})`,
      );
    } else {
      mergedFeatures.push(feature);
      console.log(
        `   ✅ ${gadmName} → district ${mapping.code} (${mapping.name_he})`,
      );
    }
  }

  // Merge Golan into HaZafon as a MultiPolygon
  if (hazafonFeature) {
    if (golanFeature) {
      const hazCoords =
        hazafonFeature.geometry.type === 'MultiPolygon'
          ? (hazafonFeature.geometry as GeoJSON.MultiPolygon).coordinates
          : [(hazafonFeature.geometry as GeoJSON.Polygon).coordinates];

      const golanCoords =
        golanFeature.geometry.type === 'MultiPolygon'
          ? (golanFeature.geometry as GeoJSON.MultiPolygon).coordinates
          : [(golanFeature.geometry as GeoJSON.Polygon).coordinates];

      hazafonFeature.geometry = {
        type: 'MultiPolygon',
        coordinates: [...hazCoords, ...golanCoords],
      };
      console.log('   ✅ Merged Golan geometry into HaZafon');
    }
    mergedFeatures.push(hazafonFeature);
  }

  return {
    type: 'FeatureCollection',
    features: mergedFeatures,
  };
}

function convertToTopoJSON(geojson: GeoJSON.FeatureCollection) {
  const { topology } = require('topojson-server');
  const { presimplify, simplify, quantile } = require('topojson-simplify');

  console.log('🔄 Converting to TopoJSON...');

  let topo = topology({ municipalities: geojson });

  topo = presimplify(topo);
  const minWeight = quantile(topo, 0.05);
  topo = simplify(topo, minWeight);

  const topoStr = JSON.stringify(topo);
  const sizeMB = (Buffer.byteLength(topoStr) / 1024 / 1024).toFixed(2);
  console.log(`   ✅ TopoJSON size: ${sizeMB} MB`);

  return topo;
}

async function main() {
  try {
    // 1. Download GADM data
    const rawGeoJSON = await fetchGADMData();

    // 2. Enrich with CBS district codes & merge Golan into HaZafon
    const enrichedGeoJSON = enrichFeatures(rawGeoJSON);

    if (enrichedGeoJSON.features.length === 0) {
      console.error('❌ No features found.');
      process.exit(1);
    }

    // 3. Convert to TopoJSON
    const topoJSON = convertToTopoJSON(enrichedGeoJSON);

    // 4. Write to file
    if (!existsSync(OUTPUT_DIR)) {
      mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    writeFileSync(OUTPUT_FILE, JSON.stringify(topoJSON));
    console.log(`\n✅ Saved to ${OUTPUT_FILE}`);
    console.log(`   ${enrichedGeoJSON.features.length} districts`);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
