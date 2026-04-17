/**
 * Fetch MK portrait images from Wikidata / Wikimedia Commons.
 * For each current MK without an image, queries Wikidata by Hebrew name
 * and extracts the P18 (image) property. Uses smart name matching
 * (middle-name removal, hyphenation, nicknames, abbreviations) and
 * falls back to Hebrew Wikipedia REST API. Respects Wikimedia licensing.
 *
 * Images are downloaded and saved locally as optimized WebP files
 * in public/images/mks/{knessetId}.webp and served from local storage.
 */
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../../lib/db';
import { members } from '../../lib/db/schema';
import fs from 'fs';
import path from 'path';
import { appConfig } from '../../../app.config';

const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql';
const COMMONS_THUMB = 'https://commons.wikimedia.org/wiki/Special:FilePath';
const MKS_IMAGE_DIR = path.resolve('public/images/mks');
const USER_AGENT =
  'KnessetInsight/1.0 (civic-tech; https://github.com/Yedidya10/knesset-insight)';

/** Download a remote image, optimize as WebP, and save locally */
async function downloadAndSaveLocally(
  remoteUrl: string,
  knessetId: number,
): Promise<string | null> {
  try {
    fs.mkdirSync(MKS_IMAGE_DIR, { recursive: true });
    const outFile = path.join(MKS_IMAGE_DIR, `${knessetId}.webp`);

    // Skip if already exists locally
    if (fs.existsSync(outFile)) {
      return `/images/mks/${knessetId}.webp`;
    }

    const res = await fetch(remoteUrl, {
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
    });
    if (!res.ok) return null;

    const sharp = (await import('sharp')).default;
    const buffer = Buffer.from(await res.arrayBuffer());
    await sharp(buffer)
      .resize(appConfig.images.thumbWidth, null, { withoutEnlargement: true })
      .webp({ quality: appConfig.images.quality })
      .toFile(outFile);

    return `/images/mks/${knessetId}.webp`;
  } catch (err) {
    console.warn(
      `[images] Failed to download locally for ${knessetId}: ${err}`,
    );
    return null;
  }
}

const SPARQL_QUERY = `
SELECT ?person ?personLabel ?image WHERE {
  ?person wdt:P39 wd:Q4047513 .
  ?person wdt:P18 ?image .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "he,en" . }
}
`;

/** Common Hebrew nickname ↔ full name mappings */
const NICKNAME_MAP: Record<string, string[]> = {
  בני: ['בנימין'],
  בנימין: ['בני'],
  יוסי: ['יוסף'],
  יוסף: ['יוסי'],
  אלי: ['אליהו', 'אליעזר'],
  אליהו: ['אלי'],
  דבי: ['דבורה'],
  דבורה: ['דבי'],
  קטי: ['קטרין'],
  אתי: ['חוה', 'אסתר'],
  חוה: ['אתי'],
  ששי: ['ששון'],
  ששון: ['ששי'],
  מיכי: ['מיכאל'],
  מיכאל: ['מיכי'],
};

interface WikidataMK {
  name: string;
  imageUrl: string;
}

/** Generate candidate name variants for fuzzy matching */
function generateCandidateNames(firstName: string, lastName: string): string[] {
  const candidates: string[] = [];
  const firstParts = firstName.split(' ');
  const lastParts = lastName.split(' ');

  // Full name, reversed name
  candidates.push(`${firstName} ${lastName}`, `${lastName} ${firstName}`);

  // Drop middle names
  if (firstParts.length > 1) {
    candidates.push(`${firstParts[0]} ${lastName}`);
  }

  // Hyphenated compound last names
  if (lastParts.length > 1) {
    const hyphenated = lastParts.join('-');
    candidates.push(
      `${firstName} ${hyphenated}`,
      `${firstParts[0]} ${hyphenated}`,
    );
  }

  // Nickname variants for first name parts
  for (const part of firstParts) {
    const nicks = NICKNAME_MAP[part];
    if (nicks) {
      for (const nick of nicks) {
        candidates.push(`${nick} ${lastName}`);
        if (lastParts.length > 1)
          candidates.push(`${nick} ${lastParts.join('-')}`);
      }
    }
  }

  // Middle name as first name (e.g., "חוה אתי עטייה" → "אתי עטייה")
  if (firstParts.length > 1) {
    for (let i = 1; i < firstParts.length; i++) {
      candidates.push(`${firstParts[i]} ${lastName}`);
      if (lastParts.length > 1)
        candidates.push(`${firstParts[i]} ${lastParts.join('-')}`);
      const middleNicks = NICKNAME_MAP[firstParts[i]];
      if (middleNicks) {
        for (const nick of middleNicks) candidates.push(`${nick} ${lastName}`);
      }
    }
  }

  // Abbreviation marks: כץ ↔ כ"ץ
  for (const c of [...candidates]) {
    if (c.includes('כץ')) candidates.push(c.replace('כץ', 'כ"ץ'));
    if (c.includes('כ"ץ')) candidates.push(c.replace('כ"ץ', 'כץ'));
  }

  // Shortened last name (drop last word of compound surname)
  if (lastParts.length > 1) {
    candidates.push(`${firstParts[0]} ${lastParts[0]}`);
  }

  return [...new Set(candidates)];
}

/** Try Hebrew Wikipedia REST API as fallback image source */
async function tryWikipediaImage(name: string): Promise<string | null> {
  try {
    const url = `https://he.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'KnessetInsight/1.0 (civic-tech)' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.originalimage?.source ?? data.thumbnail?.source ?? null;
  } catch {
    return null;
  }
}

async function fetchWikidataImages(): Promise<WikidataMK[]> {
  const url = `${WIKIDATA_SPARQL}?query=${encodeURIComponent(SPARQL_QUERY)}&format=json`;

  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'KnessetInsight/1.0 (civic-tech; https://github.com/knesset-insight)',
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

    const filename = decodeURIComponent(imageUri.split('/').pop()!);
    const thumbUrl = `${COMMONS_THUMB}/${encodeURIComponent(filename)}?width=${appConfig.images.thumbWidth}`;
    results.push({ name, imageUrl: thumbUrl });
  }

  return results;
}

/**
 * Match Wikidata/Wikipedia names to our DB members and update imageUrl.
 * Uses smart name matching with fallback to Wikipedia REST API.
 */
export async function syncMemberImages(): Promise<number> {
  console.log('[images] Fetching Wikidata MK images...');
  const wikiMKs = await fetchWikidataImages();
  console.log(`[images] Found ${wikiMKs.length} MKs with images on Wikidata`);

  const dbMembers = await db
    .select({
      id: members.id,
      knessetId: members.knessetId,
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
  if (dbMembers.length === 0) return 0;

  // Build name→imageUrl lookup
  const wikiLookup = new Map<string, string>();
  for (const wm of wikiMKs) {
    wikiLookup.set(wm.name, wm.imageUrl);
  }

  let updated = 0;
  const unmatched: typeof dbMembers = [];

  // Pass 1: Smart Wikidata name matching
  for (const m of dbMembers) {
    const candidates = generateCandidateNames(m.firstName, m.lastName);
    let imageUrl: string | undefined;

    for (const candidate of candidates) {
      const img = wikiLookup.get(candidate);
      if (img) {
        imageUrl = img;
        break;
      }
    }

    if (imageUrl) {
      // Download and save locally as optimized WebP
      const localPath = await downloadAndSaveLocally(imageUrl, m.knessetId);
      await db
        .update(members)
        .set({
          imageUrl: localPath ?? imageUrl,
          imageSource: 'wikidata',
          imageAttribution: appConfig.images.sources.wikidata.attribution,
          updatedAt: new Date(),
        })
        .where(eq(members.id, m.id));
      updated++;
    } else {
      unmatched.push(m);
    }
  }

  console.log(`[images] Wikidata matched: ${updated}`);

  // Pass 2: Wikipedia REST API fallback for remaining
  if (unmatched.length > 0) {
    console.log(
      `[images] Trying Wikipedia API for ${unmatched.length} remaining...`,
    );

    for (const m of unmatched) {
      const candidates = generateCandidateNames(m.firstName, m.lastName);
      let imageUrl: string | null = null;

      for (const candidate of candidates) {
        imageUrl = await tryWikipediaImage(candidate);
        if (imageUrl) break;
      }

      if (imageUrl) {
        // Download and save locally as optimized WebP
        const localPath = await downloadAndSaveLocally(imageUrl, m.knessetId);
        await db
          .update(members)
          .set({
            imageUrl: localPath ?? imageUrl,
            imageSource: 'wikidata',
            imageAttribution: appConfig.images.sources.wikidata.attribution,
            updatedAt: new Date(),
          })
          .where(eq(members.id, m.id));
        updated++;
      }
    }
  }

  console.log(`[images] Updated ${updated} member images total`);
  return updated;
}
