/**
 * Import election results by city from the Central Elections Committee CSVs.
 *
 * Usage:
 *   pnpm tsx src/scripts/import-election-results.ts [knessetNum]
 *
 * Examples:
 *   pnpm tsx src/scripts/import-election-results.ts       # import all (20-25)
 *   pnpm tsx src/scripts/import-election-results.ts 25    # import only K25
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

const targetKnesset = process.argv[2] ? Number(process.argv[2]) : null;

const KNESSET_CSVS: Record<number, string> = {
  21: 'https://media21.bechirot.gov.il/files/expc.csv',
  22: 'https://media22.bechirot.gov.il/files/expc.csv',
  23: 'https://media23.bechirot.gov.il/files/expc.csv',
  24: 'https://media24.bechirot.gov.il/files/expc.csv',
  25: 'https://media25.bechirot.gov.il/files/expc.csv',
};

interface CityRow {
  cityCode: string;
  cityName: string;
  districtCode: number | null;
  eligible: number;
  actual: number;
  valid: number;
  invalid: number;
  parties: { letters: string; name: string; votes: number }[];
}

function parseCSV(
  csvText: string,
  districtMap: Map<number, number>,
): CityRow[] {
  const lines = csvText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) return [];

  // Detect CSV format: K21 has no "סמל ועדה" column, K22+ does.
  // If first header column contains "ועדה", there's an extra col 0 offset.
  const headerCols = parseCSVLine(lines[0]);
  const firstCol =
    headerCols[0]
      ?.replace(/"/g, '')
      .replace(/\uFEFF/g, '')
      .trim() ?? '';
  const hasCommitteeCol = firstCol.includes('ועדה');
  const offset = hasCommitteeCol ? 1 : 0;

  // Columns (with offset):
  // [offset+0]: שם ישוב (city name)
  // [offset+1]: סמל ישוב (city code)
  // [offset+2]: בזב (eligible voters)
  // [offset+3]: מצביעים (actual voters)
  // [offset+4]: פסולים (invalid votes)
  // [offset+5]: כשרים (valid votes)
  // [offset+6]+: vote count per party (ballot letters from header)
  const partyStart = offset + 6;

  // Parse header to get party ballot letters
  const partyHeaders: string[] = [];
  for (let j = partyStart; j < headerCols.length; j++) {
    partyHeaders.push(headerCols[j]?.replace(/"/g, '').trim() ?? '');
  }

  const rows: CityRow[] = [];

  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const cols = parseCSVLine(line);

    if (cols.length < partyStart) continue;

    const cityName = cols[offset]?.replace(/"/g, '').trim() ?? '';
    const cityCode = cols[offset + 1]?.replace(/"/g, '').trim() ?? '';
    const eligible = parseInt(
      cols[offset + 2]?.replace(/"/g, '').trim() ?? '0',
      10,
    );
    const actual = parseInt(
      cols[offset + 3]?.replace(/"/g, '').trim() ?? '0',
      10,
    );
    const invalid = parseInt(
      cols[offset + 4]?.replace(/"/g, '').trim() ?? '0',
      10,
    );
    const valid = parseInt(
      cols[offset + 5]?.replace(/"/g, '').trim() ?? '0',
      10,
    );

    if (!cityCode || !cityName || isNaN(eligible)) continue;

    // Derive district code from the CBS settlement→nafa mapping
    const cityNum = parseInt(cityCode, 10);
    const districtCode = districtMap.get(cityNum) ?? null;

    // Each column from partyStart onwards has votes for the party
    // whose ballot letters are in the same header column
    const parties: CityRow['parties'] = [];
    for (let j = partyStart; j < cols.length; j++) {
      const votes = parseInt(cols[j]?.replace(/"/g, '').trim() ?? '0', 10);
      const letters = partyHeaders[j - partyStart] ?? '';
      if (letters && !isNaN(votes) && votes > 0) {
        parties.push({ letters, name: letters, votes });
      }
    }

    rows.push({
      cityCode,
      cityName,
      districtCode,
      eligible,
      actual,
      valid,
      invalid,
      parties,
    });
  }

  return rows;
}

/** Parse a CSV line handling quoted fields with commas inside */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

async function importKnesset(
  knessetNum: number,
  url: string,
  districtMap: Map<number, number>,
) {
  const { db } = await import('../lib/db');
  const { electionCityResults, electionCityPartyResults } =
    await import('../lib/db/schema');
  const { eq, and } = await import('drizzle-orm');

  console.log(`\n📥 Fetching K${knessetNum} from ${url}...`);

  // Validate URL domain to prevent SSRF — only allow official election committee domain
  const parsed = new URL(url);
  if (!parsed.hostname.endsWith('.bechirot.gov.il')) {
    console.error(`  ❌ Blocked: untrusted domain ${parsed.hostname}`);
    return;
  }

  const response = await fetch(url);
  if (!response.ok) {
    console.error(`  ❌ Failed to fetch: ${response.status}`);
    return;
  }

  // Handle possible encoding issues (some CSVs are windows-1255)
  const buffer = await response.arrayBuffer();
  let csvText: string;

  try {
    // Try UTF-8 first
    csvText = new TextDecoder('utf-8').decode(buffer);
    // Check if Hebrew is garbled: look for replacement chars or absence of Hebrew
    const hasHebrew = /[\u0590-\u05FF]/.test(csvText.slice(0, 500));
    if (!hasHebrew || csvText.includes('\uFFFD')) {
      csvText = new TextDecoder('windows-1255').decode(buffer);
    }
  } catch {
    csvText = new TextDecoder('windows-1255').decode(buffer);
  }

  const rows = parseCSV(csvText, districtMap);
  console.log(`  📊 Parsed ${rows.length} cities`);

  if (rows.length === 0) {
    console.log('  ⚠️ No data parsed, skipping');
    return;
  }

  // Delete existing data for this knesset (idempotent)
  await db
    .delete(electionCityResults)
    .where(eq(electionCityResults.knessetNum, knessetNum));

  let cityCount = 0;
  let partyCount = 0;
  const BATCH_SIZE = 25;

  // Insert cities in batches, then collect IDs for party inserts
  for (let b = 0; b < rows.length; b += BATCH_SIZE) {
    const batch = rows.slice(b, b + BATCH_SIZE);

    const cityValues = batch.map((row) => {
      const turnoutPercent =
        row.eligible > 0
          ? parseFloat(((row.actual / row.eligible) * 100).toFixed(2))
          : 0;
      return {
        knessetNum,
        cityCode: row.cityCode,
        cityName: row.cityName,
        districtCode: row.districtCode,
        eligibleVoters: row.eligible,
        actualVoters: row.actual,
        validVotes: row.valid,
        invalidVotes: row.invalid,
        turnoutPercent: String(turnoutPercent),
      };
    });

    const inserted = await db
      .insert(electionCityResults)
      .values(cityValues)
      .returning({
        id: electionCityResults.id,
        cityCode: electionCityResults.cityCode,
      });

    cityCount += inserted.length;

    // Build a cityCode→id map for party inserts
    const idMap = new Map<string, number>();
    for (const row of inserted) {
      idMap.set(row.cityCode, row.id);
    }

    // Collect all party rows for this batch
    const allPartyValues: {
      cityResultId: number;
      ballotLetters: string;
      partyName: string;
      votes: number;
      votePercent: string;
    }[] = [];

    for (const row of batch) {
      const cityResultId = idMap.get(row.cityCode);
      if (!cityResultId || row.parties.length === 0) continue;
      for (const p of row.parties) {
        allPartyValues.push({
          cityResultId,
          ballotLetters: p.letters,
          partyName: p.name,
          votes: p.votes,
          votePercent:
            row.valid > 0
              ? String(parseFloat(((p.votes / row.valid) * 100).toFixed(2)))
              : '0',
        });
      }
    }

    // Insert party results in sub-batches
    const PARTY_BATCH = 100;
    for (let p = 0; p < allPartyValues.length; p += PARTY_BATCH) {
      const partyBatch = allPartyValues.slice(p, p + PARTY_BATCH);
      await db.insert(electionCityPartyResults).values(partyBatch);
      partyCount += partyBatch.length;
    }

    console.log(`  ⏳ ${cityCount}/${rows.length} cities...`);
  }

  console.log(
    `\n  ✅ K${knessetNum}: ${cityCount} cities, ${partyCount} party results`,
  );
}

/** Fetch city→district mapping from the CBS settlement list on data.gov.il */
async function fetchDistrictMap(): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  const RESOURCE_ID = '5c78e9fa-c2e2-4771-93ff-7f400a12f7ba';
  const ALLOWED_HOST = 'data.gov.il';
  const limit = 1500;

  console.log('📍 Fetching city→district mapping from data.gov.il...');
  const url = new URL(`https://${ALLOWED_HOST}/api/3/action/datastore_search`);
  url.searchParams.set('resource_id', RESOURCE_ID);
  url.searchParams.set('limit', String(limit));

  const response = await fetch(url.toString());
  if (!response.ok) {
    console.warn(
      '  ⚠️ Failed to fetch district mapping, district codes will be null',
    );
    return map;
  }

  const data = (await response.json()) as {
    result: {
      records: Array<{
        סמל_ישוב: string;
        סמל_נפה: number;
      }>;
    };
  };

  for (const record of data.result.records) {
    const cityCode = parseInt(String(record['סמל_ישוב']).trim(), 10);
    const nafaCode = Number(record['סמל_נפה']);
    if (!isNaN(cityCode) && !isNaN(nafaCode) && nafaCode > 0) {
      // First digit of nafa code = CBS district code (1-7)
      const district = Math.floor(nafaCode / 10);
      // Districts 1-6 match our GADM map, district 7 (Judea & Samaria) → skip
      if (district >= 1 && district <= 6) {
        map.set(cityCode, district);
      }
    }
  }

  console.log(`  📍 Mapped ${map.size} settlements to 6 districts`);
  return map;
}

async function main() {
  const districtMap = await fetchDistrictMap();

  const knessets = targetKnesset
    ? { [targetKnesset]: KNESSET_CSVS[targetKnesset] }
    : KNESSET_CSVS;

  console.log(
    `🗳️ Importing election results for: ${Object.keys(knessets).join(', ')}`,
  );

  for (const [numStr, url] of Object.entries(knessets)) {
    const num = Number(numStr);
    if (!url) {
      console.log(`  ⚠️ No URL for K${num}, skipping`);
      continue;
    }
    try {
      await importKnesset(num, url, districtMap);
    } catch (err) {
      console.error(
        `  ❌ K${num} failed:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  console.log('\n🎉 Import complete!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
