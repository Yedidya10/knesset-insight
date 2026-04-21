/**
 * Download member images from Wikimedia Commons and save as optimized WebP.
 *
 * Strategy:
 * 1. Query Wikidata SPARQL for ALL Israeli MKs (past + current) with P18 images
 * 2. Match results to DB members by Hebrew name (using smart fuzzy matching)
 * 3. Download real photos from Commons at 300px width
 * 4. Fetch attribution (photographer) info from Commons API
 * 5. Save as optimized WebP in public/images/mks/{knessetId}.webp
 * 6. Update DB imageUrl to local path
 * 7. Generate CREDITS.md
 *
 * Run with: npx tsx src/scripts/download-member-images.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const OUT_DIR = path.resolve('public/images/mks');
const CREDITS_PATH = path.resolve('CREDITS.md');
const THUMB_WIDTH = 300;
const WEBP_QUALITY = 80;
const USER_AGENT =
  'KnessetInsight/1.0 (civic-tech; https://github.com/Yedidya10/knesset-insight)';

// ────────────────────────────────────────
// Wikidata SPARQL — fetch ALL MKs with images (past + present)
// ────────────────────────────────────────

// P39 = position held, Q4047513 = member of the Knesset
// Also fetches members of specific Knesset terms for historical MKs
const SPARQL_QUERY = `
SELECT DISTINCT ?person ?personLabel ?image WHERE {
  {
    ?person wdt:P39 wd:Q4047513 .
  } UNION {
    ?person wdt:P39 ?position .
    ?position wdt:P279* wd:Q4047513 .
  } UNION {
    ?person wdt:P39/wdt:P361 wd:Q4047513 .
  }
  ?person wdt:P18 ?image .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "he,en" . }
}
`;

/** Common Hebrew nickname mappings */
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
  דני: ['דניאל'],
  דניאל: ['דני'],
  אבי: ['אברהם', 'אביגדור'],
  אברהם: ['אבי'],
  מירי: ['מירב', 'מריאם'],
  ריקי: ['רבקה'],
};

interface WikidataMK {
  name: string;
  imageFilename: string;
  thumbUrl: string;
}

interface MemberRow {
  id: number;
  knessetId: number;
  firstName: string;
  lastName: string;
  imageUrl: string | null;
  imageSource: string | null;
  isCurrent: boolean | null;
}

interface CreditEntry {
  knessetId: number;
  name: string;
  originalUrl: string;
  license: string;
  attribution: string;
}

// ────────────────────────────────────────
// Name matching
// ────────────────────────────────────────

function normalizeHebrew(s: string): string {
  return s
    .replace(/[""״]/g, '"')
    .replace(/[-–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function generateCandidateNames(firstName: string, lastName: string): string[] {
  const candidates: string[] = [];
  const firstParts = firstName.split(' ');
  const lastParts = lastName.split(' ');

  candidates.push(`${firstName} ${lastName}`, `${lastName} ${firstName}`);

  if (firstParts.length > 1) {
    candidates.push(`${firstParts[0]} ${lastName}`);
  }

  if (lastParts.length > 1) {
    const hyphenated = lastParts.join('-');
    candidates.push(
      `${firstName} ${hyphenated}`,
      `${firstParts[0]} ${hyphenated}`,
    );
  }

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

  if (firstParts.length > 1) {
    for (let i = 1; i < firstParts.length; i++) {
      candidates.push(`${firstParts[i]} ${lastName}`);
    }
  }

  // Abbreviation marks: כץ ↔ כ"ץ
  for (const c of [...candidates]) {
    if (c.includes('כץ')) candidates.push(c.replace('כץ', 'כ"ץ'));
    if (c.includes('כ"ץ')) candidates.push(c.replace('כ"ץ', 'כץ'));
  }

  if (lastParts.length > 1) {
    candidates.push(`${firstParts[0]} ${lastParts[0]}`);
  }

  return [...new Set(candidates.map(normalizeHebrew))];
}

// ────────────────────────────────────────
// Wikidata + Commons API
// ────────────────────────────────────────

async function fetchWikidataMKImages(): Promise<WikidataMK[]> {
  console.log('Querying Wikidata SPARQL for MK images...');
  const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(SPARQL_QUERY)}&format=json`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/sparql-results+json',
    },
  });

  if (!res.ok) {
    throw new Error(`Wikidata SPARQL failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const results: WikidataMK[] = [];

  for (const binding of data.results.bindings) {
    const name = binding.personLabel?.value;
    const imageUri = binding.image?.value;
    if (!name || !imageUri) continue;

    const filename = decodeURIComponent(imageUri.split('/').pop()!);
    const thumbUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=${THUMB_WIDTH}`;
    results.push({
      name: normalizeHebrew(name),
      imageFilename: filename,
      thumbUrl,
    });
  }

  console.log(`  Found ${results.length} MKs with images on Wikidata`);
  return results;
}

async function fetchCommonsAttribution(
  filename: string,
): Promise<{ artist: string; license: string } | null> {
  try {
    const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(filename)}&prop=imageinfo&iiprop=extmetadata&format=json`;
    const res = await fetch(apiUrl, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const pages = data.query?.pages;
    if (!pages) return null;
    const page = Object.values(pages)[0] as {
      imageinfo?: { extmetadata?: Record<string, { value?: string }> }[];
    };
    const meta = page?.imageinfo?.[0]?.extmetadata;
    if (!meta) return null;

    const artist =
      meta.Artist?.value?.replace(/<[^>]*>/g, '').trim() ?? 'Unknown';
    const licenseName =
      meta.LicenseShortName?.value ?? meta.License?.value ?? 'CC BY-SA 4.0';
    return { artist, license: licenseName };
  } catch {
    return null;
  }
}

// ────────────────────────────────────────
// Download & optimize
// ────────────────────────────────────────

async function downloadAndOptimize(
  imageUrl: string,
  outputPath: string,
): Promise<boolean> {
  try {
    const res = await fetch(imageUrl, {
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
    });
    if (!res.ok) {
      console.warn(`  HTTP ${res.status} for ${imageUrl.substring(0, 80)}`);
      return false;
    }
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) {
      console.warn(`  Not an image: ${contentType}`);
      return false;
    }
    const buffer = Buffer.from(await res.arrayBuffer());

    // Verify this is a real image, not a tiny placeholder
    const metadata = await sharp(buffer).metadata();
    if (!metadata.width || !metadata.height) return false;
    // Skip images smaller than 50px (likely placeholders or icons)
    if (metadata.width < 50 && metadata.height < 50) {
      console.warn(`  Image too small: ${metadata.width}x${metadata.height}`);
      return false;
    }

    await sharp(buffer)
      .resize(THUMB_WIDTH, null, { withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toFile(outputPath);
    return true;
  } catch (err) {
    console.warn(`  Error processing: ${err}`);
    return false;
  }
}

// ────────────────────────────────────────
// CREDITS.md generation
// ────────────────────────────────────────

function generateCreditsFile(credits: CreditEntry[]) {
  const lines: string[] = [
    '# Image Credits & Attribution',
    '',
    'This project uses photographs of Knesset members sourced from',
    '[Wikimedia Commons](https://commons.wikimedia.org/) and the',
    '[Knesset Archive](https://main.knesset.gov.il/).',
    '',
    'All images are used under their respective Creative Commons licenses.',
    'Most are licensed under **CC BY-SA 4.0** (Creative Commons Attribution-ShareAlike 4.0 International).',
    '',
    '## License Summary',
    '',
    '- **CC BY-SA 4.0**: You may share and adapt the images, provided you give',
    '  appropriate credit and distribute derivatives under the same license.',
    '  [Full license text](https://creativecommons.org/licenses/by-sa/4.0/)',
    '',
    '## Image Sources',
    '',
    '| Member | Photographer / Attribution | License |',
    '|--------|---------------------------|---------|',
  ];

  for (const c of credits.sort((a, b) => a.name.localeCompare(b.name, 'he'))) {
    const escapedAttribution = c.attribution.replace(/\|/g, '\\|');
    lines.push(`| ${c.name} | ${escapedAttribution} | ${c.license} |`);
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(
    '*This file was auto-generated by `src/scripts/download-member-images.ts`.*',
  );
  lines.push(`*Last updated: ${new Date().toISOString().split('T')[0]}*`);
  lines.push('');

  fs.writeFileSync(CREDITS_PATH, lines.join('\n'), 'utf-8');
  console.log(`\nWrote ${CREDITS_PATH}`);
}

// ────────────────────────────────────────
// Main
// ────────────────────────────────────────

async function main() {
  const { db } = await import('../../lib/db');
  const { members } = await import('../../lib/db/schema');
  const { eq } = await import('drizzle-orm');

  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Step 1: Get all Wikidata MK images
  const wikiMKs = await fetchWikidataMKImages();

  // Build lookup: normalized name → WikidataMK
  const wikiLookup = new Map<string, WikidataMK>();
  for (const mk of wikiMKs) {
    wikiLookup.set(mk.name, mk);
  }

  // Step 2: Get all members from DB
  const allMembers: MemberRow[] = await db
    .select({
      id: members.id,
      knessetId: members.knessetId,
      firstName: members.firstName,
      lastName: members.lastName,
      imageUrl: members.imageUrl,
      imageSource: members.imageSource,
      isCurrent: members.isCurrent,
    })
    .from(members);

  console.log(`\nTotal members in DB: ${allMembers.length}`);

  // Step 3: Match and download
  const credits: CreditEntry[] = [];
  let downloaded = 0;
  let skipped = 0;
  let matched = 0;
  let noMatch = 0;

  for (const m of allMembers) {
    const outFile = path.join(OUT_DIR, `${m.knessetId}.webp`);
    const name = `${m.firstName} ${m.lastName}`;

    // Already downloaded locally?
    if (fs.existsSync(outFile)) {
      skipped++;
      // Still record credit for existing files
      const candidates2 = generateCandidateNames(m.firstName, m.lastName);
      let wiki2: WikidataMK | undefined;
      for (const c of candidates2) {
        wiki2 = wikiLookup.get(c);
        if (wiki2) break;
      }
      if (wiki2) {
        credits.push({
          knessetId: m.knessetId,
          name,
          originalUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(wiki2.imageFilename)}`,
          license: 'CC BY-SA 4.0',
          attribution: 'Wikimedia Commons / ארכיון הכנסת',
        });
      }
      continue;
    }

    // Try to find this member in Wikidata results
    const candidates = generateCandidateNames(m.firstName, m.lastName);
    let wiki: WikidataMK | undefined;
    for (const candidate of candidates) {
      wiki = wikiLookup.get(candidate);
      if (wiki) break;
    }

    if (!wiki) {
      noMatch++;
      continue;
    }

    matched++;
    console.log(
      `  [${matched}] ${name} → ${wiki.imageFilename.substring(0, 60)}...`,
    );

    try {
      const ok = await downloadAndOptimize(wiki.thumbUrl, outFile);
      if (ok) {
        downloaded++;

        // Update DB: point to local path
        const localPath = `/images/mks/${m.knessetId}.webp`;
        try {
          await db
            .update(members)
            .set({
              imageUrl: localPath,
              imageSource: 'wikidata',
              imageAttribution: 'Wikimedia Commons (CC BY-SA 4.0)',
              updatedAt: new Date(),
            })
            .where(eq(members.id, m.id));
        } catch (dbErr) {
          console.warn(`  DB update failed for ${name}: ${dbErr}`);
        }

        // Fetch attribution info from Commons (don't block on failure)
        const attrInfo = await fetchCommonsAttribution(wiki.imageFilename);
        credits.push({
          knessetId: m.knessetId,
          name,
          originalUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(wiki.imageFilename)}`,
          license: attrInfo?.license ?? 'CC BY-SA 4.0',
          attribution: attrInfo?.artist ?? 'Wikimedia Commons / ארכיון הכנסת',
        });
      }
    } catch (err) {
      console.warn(`  Error processing ${name}: ${err}`);
    }

    // Respectful delay between requests
    await new Promise((r) => setTimeout(r, 250));
  }

  console.log(`\n=== Results ===`);
  console.log(`  Matched: ${matched}`);
  console.log(`  Downloaded: ${downloaded}`);
  console.log(`  Skipped (exists): ${skipped}`);
  console.log(`  No match on Wikidata: ${noMatch}`);

  // Generate CREDITS.md
  if (credits.length > 0) {
    generateCreditsFile(credits);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
