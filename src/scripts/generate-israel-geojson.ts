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

import type {
  FeatureCollection,
  Feature,
  MultiPolygon,
  Polygon,
} from 'geojson';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const GADM_ISR_URL =
  'https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_ISR_1.json';
const GADM_PSE_URL =
  'https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_PSE_1.json';
const OUTPUT_DIR = join(process.cwd(), 'public', 'geo');
const OUTPUT_FILE = join(OUTPUT_DIR, 'israel-municipalities.topojson');

/**
 * GADM NAME_1 ג†’ CBS district code mapping.
 * CBS district codes (׳׳—׳•׳–):
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
    name_he: '׳™׳¨׳•׳©׳׳™׳',
    name_en: 'Jerusalem',
    name_ar: '״§„‚״¯״³',
  },
  HaZafon: {
    code: '2',
    name_he: '׳”׳¦׳₪׳•׳',
    name_en: 'Northern',
    name_ar: '״§„״´…״§„',
  },
  Haifa: {
    code: '3',
    name_he: '׳—׳™׳₪׳”',
    name_en: 'Haifa',
    name_ar: '״­״§',
  },
  HaMerkaz: {
    code: '4',
    name_he: '׳”׳׳¨׳›׳–',
    name_en: 'Central',
    name_ar: '״§„…״±ƒ״²',
  },
  TelAviv: {
    code: '5',
    name_he: '׳×׳ ׳׳‘׳™׳‘',
    name_en: 'Tel Aviv',
    name_ar: '״×„ ״£״¨״¨',
  },
  HaDarom: {
    code: '6',
    name_he: '׳”׳“׳¨׳•׳',
    name_en: 'Southern',
    name_ar: '״§„״¬†ˆ״¨',
  },
  Golan: {
    code: '2',
    name_he: '׳”׳’׳•׳׳',
    name_en: 'Golan',
    name_ar: '״§„״¬ˆ„״§†',
  },
  // PSE GADM district ג€” Judea & Samaria
  WestBank: {
    code: '7',
    name_he: '׳™׳”׳•׳“׳” ׳•׳©׳•׳׳¨׳•׳',
    name_en: 'Judea & Samaria',
    name_ar: '‡ˆ״¯״§ ˆ״§„״³״§…״±״©',
  },
};

async function fetchGADMData(): Promise<FeatureCollection> {
  console.log(`נ“¡ Downloading GADM Israel Level 1 from ${GADM_ISR_URL}...`);
  const isrResponse = await fetch(GADM_ISR_URL);
  if (!isrResponse.ok) {
    throw new Error(
      `GADM ISR download failed: ${isrResponse.status} ${isrResponse.statusText}`,
    );
  }
  const isrGeo = (await isrResponse.json()) as FeatureCollection;
  console.log(
    `   ג… Downloaded ${isrGeo.features.length} ISR district features`,
  );

  console.log(`נ“¡ Downloading GADM PSE Level 1 from ${GADM_PSE_URL}...`);
  const pseResponse = await fetch(GADM_PSE_URL);
  if (!pseResponse.ok) {
    throw new Error(
      `GADM PSE download failed: ${pseResponse.status} ${pseResponse.statusText}`,
    );
  }
  const pseGeo = (await pseResponse.json()) as FeatureCollection;
  console.log(`   ג… Downloaded ${pseGeo.features.length} PSE features`);

  // Extract only WestBank from PSE, skip Gaza
  const westBank = pseGeo.features.find(
    (f) => f.properties?.NAME_1 === 'WestBank',
  );
  const combined: FeatureCollection = {
    type: 'FeatureCollection',
    features: [...isrGeo.features, ...(westBank ? [westBank] : [])],
  };
  console.log(`   ג… Combined: ${combined.features.length} total features`);
  return combined;
}

function enrichFeatures(geojson: FeatureCollection): FeatureCollection {
  console.log('נ·ן¸  Enriching features with district codes...');

  // Since Golan maps to the same district code as HaZafon,
  // we merge the Golan polygon into HaZafon.
  const mergedFeatures: Feature[] = [];
  let golanFeature: Feature | null = null;
  let hazafonFeature: Feature | null = null;

  for (const feature of geojson.features) {
    const gadmName = (feature.properties?.NAME_1 as string) || '';
    const mapping = DISTRICT_MAP[gadmName];

    if (!mapping) {
      console.log(`   ג ן¸ Skipping unknown district: ${gadmName}`);
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
      console.log(`   נ”— ${gadmName} ג†’ will merge into HaZafon (2)`);
    } else if (gadmName === 'HaZafon') {
      hazafonFeature = feature;
      console.log(
        `   ג… ${gadmName} ג†’ district ${mapping.code} (${mapping.name_he})`,
      );
    } else {
      mergedFeatures.push(feature);
      console.log(
        `   ג… ${gadmName} ג†’ district ${mapping.code} (${mapping.name_he})`,
      );
    }
  }

  // Merge Golan into HaZafon as a MultiPolygon
  if (hazafonFeature) {
    if (golanFeature) {
      const hazCoords =
        hazafonFeature.geometry.type === 'MultiPolygon'
          ? (hazafonFeature.geometry as MultiPolygon).coordinates
          : [(hazafonFeature.geometry as Polygon).coordinates];

      const golanCoords =
        golanFeature.geometry.type === 'MultiPolygon'
          ? (golanFeature.geometry as MultiPolygon).coordinates
          : [(golanFeature.geometry as Polygon).coordinates];

      hazafonFeature.geometry = {
        type: 'MultiPolygon',
        coordinates: [...hazCoords, ...golanCoords],
      };
      console.log('   ג… Merged Golan geometry into HaZafon');
    }
    mergedFeatures.push(hazafonFeature);
  }

  return {
    type: 'FeatureCollection',
    features: mergedFeatures,
  };
}

function convertToTopoJSON(geojson: FeatureCollection) {
  const { topology } = require('topojson-server');
  const { presimplify, simplify, quantile } = require('topojson-simplify');

  console.log('נ”„ Converting to TopoJSON...');

  let topo = topology({ municipalities: geojson });

  topo = presimplify(topo);
  const minWeight = quantile(topo, 0.05);
  topo = simplify(topo, minWeight);

  const topoStr = JSON.stringify(topo);
  const sizeMB = (Buffer.byteLength(topoStr) / 1024 / 1024).toFixed(2);
  console.log(`   ג… TopoJSON size: ${sizeMB} MB`);

  return topo;
}

async function main() {
  try {
    // 1. Download GADM data
    const rawGeoJSON = await fetchGADMData();

    // 2. Enrich with CBS district codes & merge Golan into HaZafon
    const enrichedGeoJSON = enrichFeatures(rawGeoJSON);

    if (enrichedGeoJSON.features.length === 0) {
      console.error('ג No features found.');
      process.exit(1);
    }

    // 3. Convert to TopoJSON
    const topoJSON = convertToTopoJSON(enrichedGeoJSON);

    // 4. Write to file
    if (!existsSync(OUTPUT_DIR)) {
      mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    writeFileSync(OUTPUT_FILE, JSON.stringify(topoJSON));
    console.log(`\nג… Saved to ${OUTPUT_FILE}`);
    console.log(`   ${enrichedGeoJSON.features.length} districts`);
  } catch (error) {
    console.error('ג Error:', error);
    process.exit(1);
  }
}

main();
