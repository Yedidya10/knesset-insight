/**
 * Fetch MK portrait images from Wikidata / Wikimedia Commons.
 * For each current MK without an image, queries Wikidata by Hebrew name
 * and extracts the P18 (image) property. Respects Wikimedia licensing.
 */
import { eq, isNull, and, sql } from 'drizzle-orm';
import { db } from '../../lib/db';
import { members } from '../../lib/db/schema';
import { appConfig } from '../../../app.config';

const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql';
const COMMONS_THUMB = 'https://commons.wikimedia.org/wiki/Special:FilePath';

/**
 * SPARQL query to find all Knesset members (P39 = Q4047513 "Knesset member")
 * and their image (P18), matching by Hebrew label.
 */
const SPARQL_QUERY = `
SELECT ?person ?personLabel ?image WHERE {
  ?person wdt:P39 wd:Q4047513 .
  ?person wdt:P18 ?image .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "he,en" . }
}
`;

interface WikidataMK {
  name: string;
  imageUrl: string;
}

async function fetchWikidataImages(): Promise<WikidataMK[]> {
  const url = `${WIKIDATA_SPARQL}?query=${encodeURIComponent(SPARQL_QUERY)}&format=json`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'KnessetInsight/1.0 (civic-tech; https://github.com/knesset-insight)',
      Accept: 'application/sparql-results+json',
    },
  });

  if (!res.ok) {
    throw new Error(`Wikidata query failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const results: WikidataMK[] = [];

  for (const binding of data.results.bindings) {
    const name = binding.personLabel?.value;
    const imageUri = binding.image?.value;
    if (!name || !imageUri) continue;

    // Convert to 300px thumbnail
    const filename = decodeURIComponent(imageUri.split('/').pop()!);
    const thumbUrl = `${COMMONS_THUMB}/${encodeURIComponent(filename)}?width=300`;

    results.push({ name, imageUrl: thumbUrl });
  }

  return results;
}

/**
 * Match Wikidata names to our DB members and update imageUrl.
 */
export async function syncMemberImages(): Promise<number> {
  console.log('[images] Fetching Wikidata MK images...');
  const wikiMKs = await fetchWikidataImages();
  console.log(`[images] Found ${wikiMKs.length} MKs with images on Wikidata`);

  // Get current members without images
  const dbMembers = await db
    .select({
      id: members.id,
      firstName: members.firstName,
      lastName: members.lastName,
    })
    .from(members)
    .where(
      and(
        eq(members.isCurrent, true),
        sql`(${members.imageUrl} IS NULL OR ${members.imageUrl} LIKE '%placeholder%')`,
      ),
    );

  console.log(`[images] ${dbMembers.length} current members need images`);

  // Build name→imageUrl lookup from Wikidata
  const wikiLookup = new Map<string, string>();
  for (const wm of wikiMKs) {
    wikiLookup.set(wm.name, wm.imageUrl);
  }

  let updated = 0;
  for (const m of dbMembers) {
    const fullName = `${m.firstName} ${m.lastName}`;
    const reverseName = `${m.lastName} ${m.firstName}`;

    const imageUrl = wikiLookup.get(fullName) ?? wikiLookup.get(reverseName);
    if (imageUrl) {
      await db
        .update(members)
        .set({
          imageUrl,
          imageSource: 'wikidata',
          imageAttribution: appConfig.images.sources.wikidata.attribution,
          updatedAt: new Date(),
        })
        .where(eq(members.id, m.id));
      updated++;
    }
  }

  console.log(`[images] Updated ${updated} member images`);
  return updated;
}
