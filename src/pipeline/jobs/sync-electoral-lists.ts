import { sql } from 'drizzle-orm';
import { db } from '../../lib/db';
import { electoralLists } from '../../lib/db/schema';
import { runSyncJob, type SyncCheckpoint } from '../utils';
import { appConfig } from '../../../app.config';

const BATCH_SIZE = 50;

interface ElectionListRow {
  name: string;
  ballotLetters: string;
  knessetNum: number;
  totalVotes: number | null;
  votePercentage: string | null;
  seats: number;
  isElected: boolean;
  electionDate: string | null;
}

const HEBREW_MONTHS: Record<string, string> = {
  'ינואר': '01', 'פברואר': '02', 'מרץ': '03', 'מרס': '03',
  'אפריל': '04', 'מאי': '05', 'יוני': '06',
  'יולי': '07', 'אוגוסט': '08', 'ספטמבר': '09',
  'אוקטובר': '10', 'נובמבר': '11', 'דצמבר': '12',
};

function getElectionUrl(knessetNum: number): string {
  return `https://votes${knessetNum}.bechirot.gov.il`;
}

function extractElectionDate(html: string): string | null {
  // Match "1 בנובמבר 2022" style dates
  const hebrewDateRe = /(\d{1,2})\s+ב(ינואר|פברואר|מרץ|מרס|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)\s+(\d{4})/;
  const m = html.match(hebrewDateRe);
  if (m) {
    const [, day, monthName, year] = m;
    const month = HEBREW_MONTHS[monthName];
    if (month) return `${year}-${month}-${day.padStart(2, '0')}`;
  }
  // Fallback: dd/mm/yyyy or dd.mm.yyyy
  const numericRe = /(\d{1,2})[./](\d{1,2})[./](\d{4})/;
  const n = html.match(numericRe);
  if (n) return `${n[3]}-${n[2].padStart(2, '0')}-${n[1].padStart(2, '0')}`;
  return null;
}

/**
 * Parse aggregated results table from bechirot.gov.il HTML.
 * Table structure: Name | Ballot Letters | Seats | Vote% | TotalVotes (inside FloatDir div)
 */
function parseElectionResults(html: string, knessetNum: number): ElectionListRow[] {
  const results: ElectionListRow[] = [];
  const electionDate = extractElectionDate(html);

  // Match rows that contain party data (td with class="th" is the party name cell)
  const rowRegex = /<tr>\s*<td\s+class="th"[^>]*title="([^"]*)"[^>]*>[\s\S]*?<\/td>\s*<td[^>]*>\s*([\s\S]*?)\s*<\/td>\s*<td[^>]*>\s*([\s\S]*?)\s*<\/td>\s*<td[^>]*>\s*([\s\S]*?)\s*<\/td>\s*<td[^>]*>[\s\S]*?<div class="FloatDir">\s*([\s\S]*?)\s*<\/div>/gi;

  let match;
  while ((match = rowRegex.exec(html)) !== null) {
    const name = match[1].trim();
    const ballotLetters = match[2].replace(/<[^>]+>/g, '').trim();
    const seatsStr = match[3].replace(/<[^>]+>/g, '').trim();
    const percentStr = match[4].replace(/<[^>]+>/g, '').replace('%', '').trim();
    const votesStr = match[5].replace(/<[^>]+>/g, '').replace(/[,\s]/g, '').trim();

    if (!ballotLetters || !name) continue;

    const seats = Number(seatsStr) || 0;
    const totalVotes = Number(votesStr) || null;
    const votePercentage = percentStr && !isNaN(Number(percentStr)) ? percentStr : null;

    results.push({
      name,
      ballotLetters,
      knessetNum,
      totalVotes,
      votePercentage,
      seats,
      isElected: seats > 0,
      electionDate,
    });
  }

  return results;
}

/**
 * Fetch and parse aggregated results from bechirot.gov.il HTML page.
 */
async function fetchElectionHTML(knessetNum: number): Promise<ElectionListRow[]> {
  const url = getElectionUrl(knessetNum);
  const response = await fetch(url, {
    headers: { 'Accept': 'text/html', 'User-Agent': 'KnessetInsight/1.0' },
  });

  if (!response.ok) {
    console.warn(`  [elections] Failed to fetch HTML for Knesset ${knessetNum}: ${response.status}`);
    return [];
  }

  const html = await response.text();
  return parseElectionResults(html, knessetNum);
}

/**
 * Fallback: fetch per-station CSV (expb.csv) and aggregate votes by ballot letter column.
 * CSV is pivoted: each row = ballot station, columns 11+ = votes per ballot letter.
 */
async function fetchElectionCSV(knessetNum: number): Promise<ElectionListRow[] | null> {
  const csvUrl = `https://media${knessetNum}.bechirot.gov.il/files/expb.csv`;

  try {
    const response = await fetch(csvUrl, {
      headers: { 'User-Agent': 'KnessetInsight/1.0' },
    });
    if (!response.ok) return null;

    const text = await response.text();
    const lines = text.split('\n').filter(Boolean);
    if (lines.length < 2) return null;

    const headers = lines[0].split(',').map((s) => s.replace(/"/g, '').trim());
    // Ballot letter columns start after the fixed columns (סמל ועדה through כשרים = indices 0-10)
    const FIRST_PARTY_COL = 11;
    if (headers.length <= FIRST_PARTY_COL) return null;

    const ballotLetterHeaders = headers.slice(FIRST_PARTY_COL);
    const voteTotals = new Array<number>(ballotLetterHeaders.length).fill(0);

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((s) => s.replace(/"/g, '').trim());
      for (let j = 0; j < ballotLetterHeaders.length; j++) {
        const val = Number(cols[FIRST_PARTY_COL + j]);
        if (!isNaN(val)) voteTotals[j] += val;
      }
    }

    const grandTotal = voteTotals.reduce((a, b) => a + b, 0);
    const results: ElectionListRow[] = [];

    for (let j = 0; j < ballotLetterHeaders.length; j++) {
      const ballotLetters = ballotLetterHeaders[j];
      if (!ballotLetters) continue;

      const totalVotes = voteTotals[j];
      const pct = grandTotal > 0 ? ((totalVotes / grandTotal) * 100).toFixed(2) : null;

      results.push({
        name: ballotLetters, // Name unknown from CSV; use ballot letters as placeholder
        ballotLetters,
        knessetNum,
        totalVotes: totalVotes || null,
        votePercentage: pct,
        seats: 0, // Unknown from per-station CSV
        isElected: false,
        electionDate: null,
      });
    }

    return results.length > 0 ? results : null;
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sync electoral lists from bechirot.gov.il for configured Knesset numbers.
 */
async function syncElectoralListsJob(_prevCheckpoint: SyncCheckpoint | null): Promise<number> {
  let totalCount = 0;

  for (const knessetNum of appConfig.knesset.syncKnessets) {
    console.log(`  [elections] Syncing Knesset ${knessetNum} electoral lists`);

    // Try HTML first (aggregated data with names, seats, votes), CSV as fallback
    let lists = await fetchElectionHTML(knessetNum);
    if (lists.length === 0) {
      console.log(`  [elections] HTML parse empty, trying CSV fallback for Knesset ${knessetNum}`);
      const csvLists = await fetchElectionCSV(knessetNum);
      if (csvLists) lists = csvLists;
    }

    if (lists.length === 0) {
      console.warn(`  [elections] No results found for Knesset ${knessetNum}`);
      continue;
    }

    console.log(`  [elections] Knesset ${knessetNum}: ${lists.length} lists`);

    for (let i = 0; i < lists.length; i += BATCH_SIZE) {
      const batch = lists.slice(i, i + BATCH_SIZE);
      await db
        .insert(electoralLists)
        .values(batch)
        .onConflictDoUpdate({
          target: [electoralLists.ballotLetters, electoralLists.knessetNum],
          set: {
            name: sql`excluded.name`,
            totalVotes: sql`excluded.total_votes`,
            votePercentage: sql`excluded.vote_percentage`,
            seats: sql`excluded.seats`,
            isElected: sql`excluded.is_elected`,
            electionDate: sql`excluded.election_date`,
            updatedAt: new Date(),
          },
        });
    }

    totalCount += lists.length;
    await sleep(1000); // Rate limit between knessets
  }

  return totalCount;
}

/**
 * Entry point for electoral lists sync.
 */
export async function syncElectoralLists(): Promise<void> {
  await runSyncJob('electoral-lists', syncElectoralListsJob);
}
