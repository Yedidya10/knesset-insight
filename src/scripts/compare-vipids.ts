/**
 * Compare our vipId assignments with actual v4 MkId values.
 * Use vote 40000 (115 members) as ground truth.
 */
import { db } from '../lib/db';
import { members } from '../lib/db/schema';
import { sql, isNotNull } from 'drizzle-orm';

interface V4Result {
  MkId: number;
  FirstName: string;
  LastName: string;
  ResultCode: number;
}

async function main() {
  // 1. Fetch a large vote from v4 as ground truth
  console.log('=== Fetching vote 40000 from v4 (all members) ===');
  const url = `https://knesset.gov.il/OdataV4/ParliamentInfo/KNS_PlenumVoteResult?$filter=VoteID eq 40000&$select=MkId,FirstName,LastName,ResultCode&$format=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  const data = await res.json();
  const v4Members: V4Result[] = data.value;
  console.log(`Vote 40000: ${v4Members.length} members`);

  // Build name→MkId map from v4
  const v4NameToMkId = new Map<string, number>();
  for (const m of v4Members) {
    const name = `${m.FirstName} ${m.LastName}`;
    v4NameToMkId.set(name, m.MkId);
  }

  // 2. Load our DB members with vipId
  const dbMembers = await db.select({
    id: members.id,
    firstName: members.firstName,
    lastName: members.lastName,
    vipId: members.vipId,
    knessetId: members.knessetId,
    isCurrent: members.isCurrent,
  }).from(members).where(isNotNull(members.vipId));
  
  console.log(`DB members with vipId: ${dbMembers.length}`);

  // 3. Cross-reference
  let matches = 0;
  let mismatches = 0;
  let notInV4 = 0;

  console.log('\n=== MISMATCHES (DB vipId ≠ v4 MkId) ===');
  console.log('Member                    | DB vipId | v4 MkId | Current');
  console.log('--------------------------|----------|---------|--------');
  
  for (const m of dbMembers) {
    const name = `${m.firstName} ${m.lastName}`;
    const v4MkId = v4NameToMkId.get(name);
    
    if (v4MkId === undefined) {
      notInV4++;
      continue;
    }

    if (v4MkId === m.vipId) {
      matches++;
    } else {
      mismatches++;
      console.log(`${name.padEnd(25)} | ${String(m.vipId).padEnd(8)} | ${String(v4MkId).padEnd(7)} | ${m.isCurrent}`);
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Matches: ${matches}`);
  console.log(`Mismatches: ${mismatches}`);
  console.log(`Not in vote 40000: ${notInV4}`);

  // 4. Also check: for Buskila, search across multiple votes
  console.log('\n=== Finding Buskila across multiple votes ===');
  for (const voteId of [45000, 44000, 43000, 42000, 41000]) {
    try {
      const url = `https://knesset.gov.il/OdataV4/ParliamentInfo/KNS_PlenumVoteResult?$filter=VoteID eq ${voteId}&$select=MkId,FirstName,LastName&$format=json`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      const d = await res.json();
      const buskila = d.value?.find((r: any) => r.LastName?.includes('בוסקילה'));
      if (buskila) {
        console.log(`Vote ${voteId}: Buskila found! MkId=${buskila.MkId}, ${buskila.FirstName} ${buskila.LastName}`);
      } else {
        console.log(`Vote ${voteId}: Buskila NOT found (${d.value?.length} members)`);
      }
    } catch (err: any) {
      console.log(`Vote ${voteId}: ERROR - ${err.message}`);
    }
  }

  // 5. Check multiple recent votes for Buskila (she may have entered recently)
  console.log('\n=== Searching broader vote range for Buskila ===');
  for (const voteId of [45800, 45700, 45600, 45500, 45400, 45300, 45200, 45100]) {
    try {
      const url = `https://knesset.gov.il/OdataV4/ParliamentInfo/KNS_PlenumVoteResult?$filter=VoteID eq ${voteId}&$select=MkId,FirstName,LastName&$format=json`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      const d = await res.json();
      const buskila = d.value?.find((r: any) => r.LastName?.includes('בוסקילה'));
      if (buskila) {
        console.log(`Vote ${voteId}: Buskila found! MkId=${buskila.MkId}`);
      }
    } catch (err: any) {}
  }

  // 6. Check the actual Open Knesset view_vote_mk_individual for Israel Katz
  console.log('\n=== Open Knesset: searching for כץ in view_vote_mk_individual ===');
  try {
    const csvUrl = 'https://production.oknesset.org/pipelines/data/votes/view_vote_mk_individual/view_vote_mk_individual.csv';
    const res = await fetch(csvUrl, { signal: AbortSignal.timeout(15_000) });
    const text = await res.text();
    const lines = text.split('\n');
    console.log(`Total lines: ${lines.length}`);
    
    // Find ישראל כץ entries
    const katzLines = lines.filter(l => l.includes('כץ'));
    console.log(`\nAll entries containing כץ:`);
    for (const l of katzLines) {
      console.log(`  ${l}`);
    }

    // Find בוסקילה
    const buskilaLines = lines.filter(l => l.includes('בוסקילה'));
    console.log(`\nAll entries containing בוסקילה:`);
    for (const l of buskilaLines) {
      console.log(`  ${l}`);
    }
  } catch (err: any) {
    console.log(`Error: ${err.message}`);
  }

  process.exit(0);
}

main().catch(console.error);
