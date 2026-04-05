import { sql } from 'drizzle-orm';
import { db } from '../../lib/db';
import { politicalParties } from '../../lib/db/schema';
import { runSyncJob, type SyncCheckpoint } from '../utils';

const BATCH_SIZE = 50;
const CKAN_RESOURCE_ID = '1dbfc053-e92f-4354-92d6-1b99aadb20d7';
const CKAN_API_URL = 'https://data.gov.il/api/3/action/datastore_search';

interface CkanPartyRecord {
  _id: number;
  'שם מפלגה': string;
  'מספר מפלגה': string;
  'מטרות': string;
  'כתובת': string;
  'דואר אלקטרוני': string;
  'תאריך רישום': string;
}

interface ParsedParty {
  name: string;
  registrarNumber: string;
  type: 'party' | 'movement';
  registrationYear: number | null;
  email: string | null;
  address: string | null;
  goals: string | null;
}

function parsePartyRecord(record: CkanPartyRecord): ParsedParty | null {
  const name = record['שם מפלגה']?.trim();
  const registrarNumber = record['מספר מפלגה']?.trim();
  if (!name || !registrarNumber) return null;

  // Extract year from registration date (various formats)
  let registrationYear: number | null = null;
  const dateStr = record['תאריך רישום']?.trim();
  if (dateStr) {
    const yearMatch = dateStr.match(/(\d{4})/);
    if (yearMatch) registrationYear = Number(yearMatch[1]);
  }

  // Determine type
  const type: 'party' | 'movement' = name.includes('תנועה') ? 'movement' : 'party';

  // Clean email
  let email = record['דואר אלקטרוני']?.trim() || null;
  if (email) {
    email = email.replace(/^mailto:/, '').trim();
    if (!email.includes('@')) email = null;
  }

  const address = record['כתובת']?.trim() || null;
  const goals = record['מטרות']?.trim() || null;

  return {
    name,
    registrarNumber,
    type,
    registrationYear,
    email,
    address,
    goals,
  };
}

/**
 * Fetch all parties from data.gov.il CKAN datastore API.
 */
async function fetchAllParties(): Promise<CkanPartyRecord[]> {
  const PAGE_SIZE = 100;
  const allRecords: CkanPartyRecord[] = [];
  let offset = 0;

  while (true) {
    const url = `${CKAN_API_URL}?resource_id=${CKAN_RESOURCE_ID}&limit=${PAGE_SIZE}&offset=${offset}`;
    console.log(`  [parties] Fetching offset=${offset}`);

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`data.gov.il API failed: ${response.status}`);
    }

    const data = await response.json() as {
      success: boolean;
      result: { records: CkanPartyRecord[]; total: number };
    };

    if (!data.success) {
      throw new Error('data.gov.il API returned success=false');
    }

    allRecords.push(...data.result.records);

    if (allRecords.length >= data.result.total) break;
    offset += PAGE_SIZE;
  }

  return allRecords;
}

/**
 * Sync registered political parties from data.gov.il Party Registrar.
 */
async function syncRegisteredPartiesJob(_prevCheckpoint: SyncCheckpoint | null): Promise<number> {
  const records = await fetchAllParties();
  console.log(`  [parties] Fetched ${records.length} records from data.gov.il`);

  const allParties = records
    .map(parsePartyRecord)
    .filter((p): p is ParsedParty => p !== null);

  console.log(`  [parties] Parsed ${allParties.length} valid parties`);

  // Upsert parties
  for (let i = 0; i < allParties.length; i += BATCH_SIZE) {
    const batch = allParties.slice(i, i + BATCH_SIZE).map((p) => ({
      registrarNumber: p.registrarNumber,
      name: p.name,
      type: p.type,
      registrationYear: p.registrationYear,
      email: p.email,
      address: p.address,
      goals: p.goals,
      isActive: true,
    }));

    await db
      .insert(politicalParties)
      .values(batch)
      .onConflictDoUpdate({
        target: politicalParties.registrarNumber,
        set: {
          name: sql`excluded.name`,
          type: sql`excluded.type`,
          registrationYear: sql`excluded.registration_year`,
          email: sql`excluded.email`,
          address: sql`excluded.address`,
          goals: sql`excluded.goals`,
          updatedAt: new Date(),
        },
      });
  }

  return allParties.length;
}

/**
 * Entry point for registered parties sync.
 */
export async function syncRegisteredParties(): Promise<void> {
  await runSyncJob('registered-parties', syncRegisteredPartiesJob);
}
