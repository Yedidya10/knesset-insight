/**
 * Build a complete MkId mapping from v4 KNS_PlenumVoteResult.
 * Collects all distinct MkId+Name pairs and cross-references with our DB.
 */
import { db } from '../../lib/db';
import { members } from '../../lib/db/schema';
import { sql, isNotNull, eq } from 'drizzle-orm';

interface V4VoteResult {
  MkId: number;
  FirstName: string;
  LastName: string;
}

async function main() {
  // 1. Check v4 metadata first for a member entity
  console.log('=== Checking v4 metadata ===');
  try {
    const url = 'https://knesset.gov.il/OdataV4/ParliamentInfo/$metadata';
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    const text = await res.text();
    // Find all EntityType names
    const entities = text.match(/EntityType Name="([^"]+)"/g) || [];
    console.log(`Entity types found: ${entities.length}`);
    for (const e of entities) {
      console.log(`  ${e}`);
    }
    // Find entity sets
    const sets = text.match(/EntitySet Name="([^"]+)"/g) || [];
    console.log(`\nEntity sets: ${sets.length}`);
    for (const s of sets) {
      console.log(`  ${s}`);
    }
  } catch (err: any) {
    console.log(`Error: ${err.message}`);
  }

  // 2. Check if there's a KNS_Person with MK-related fields
  console.log('\n=== KNS_Person sample ===');
  try {
    const url =
      'https://knesset.gov.il/OdataV4/ParliamentInfo/KNS_Person?$top=3&$format=json';
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    const d = await res.json();
    if (d.value?.[0]) {
      console.log('KNS_Person fields:', Object.keys(d.value[0]).join(', '));
      console.log('Sample:', JSON.stringify(d.value[0]).substring(0, 300));
    }
  } catch (err: any) {
    console.log(`Error: ${err.message}`);
  }

  // 3. Collect all distinct MkId+Name from a WIDE range of votes
  // Use multiple large votes spanning K25
  console.log('\n=== Collecting all distinct MkIds from v4 ===');
  const allMkIdMap = new Map<number, { firstName: string; lastName: string }>();

  // Pick votes from different periods
  const sampleVoteIds = [
    37786, 37800, 38000, 38500, 38793, 39000, 39200, 39500, 39660, 40000, 40500,
    41000, 41500, 42000, 42500, 43500, 44000, 44500, 45000, 45200, 45500, 45700,
    45800,
  ];

  for (const voteId of sampleVoteIds) {
    try {
      const url = `https://knesset.gov.il/OdataV4/ParliamentInfo/KNS_PlenumVoteResult?$filter=VoteID eq ${voteId}&$select=MkId,FirstName,LastName&$format=json`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      const d = await res.json();
      for (const r of d.value || []) {
        if (!allMkIdMap.has(r.MkId)) {
          allMkIdMap.set(r.MkId, {
            firstName: r.FirstName,
            lastName: r.LastName,
          });
        }
      }
      process.stdout.write(
        `  Vote ${voteId}: ${d.value?.length || 0} results (total unique MKs: ${allMkIdMap.size})\n`,
      );
    } catch (err: any) {
      console.log(`  Vote ${voteId}: ERROR - ${err.message}`);
    }
    // Small delay
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\nTotal unique MkIds found: ${allMkIdMap.size}`);

  // 4. Compare with our DB members
  const dbMembers = await db
    .select({
      id: members.id,
      firstName: members.firstName,
      lastName: members.lastName,
      vipId: members.vipId,
      knessetId: members.knessetId,
      isCurrent: members.isCurrent,
      knessetNum: members.knessetNum,
    })
    .from(members);

  // Build name→dbMember map (may have duplicates!)
  const dbNameMap = new Map<string, typeof dbMembers>();
  for (const m of dbMembers) {
    const name = `${m.firstName} ${m.lastName}`;
    if (!dbNameMap.has(name)) dbNameMap.set(name, []);
    dbNameMap.get(name)!.push(m);
  }

  console.log('\n=== Full MkId list with DB comparison ===');
  let correctCount = 0;
  let wrongCount = 0;
  let missingVipId = 0;
  let notInDb = 0;
  const corrections: {
    memberId: number;
    oldVipId: number | null;
    newVipId: number;
    name: string;
  }[] = [];

  for (const [mkId, { firstName, lastName }] of allMkIdMap) {
    const name = `${firstName} ${lastName}`;
    const dbMatches = dbNameMap.get(name);

    if (!dbMatches || dbMatches.length === 0) {
      notInDb++;
      continue;
    }

    // Find the best match (current member, or closest knesset_num)
    const currentMatch = dbMatches.find((m) => m.isCurrent);
    const bestMatch = currentMatch || dbMatches[0];

    if (bestMatch.vipId === mkId) {
      correctCount++;
    } else if (bestMatch.vipId === null) {
      missingVipId++;
      corrections.push({
        memberId: bestMatch.id,
        oldVipId: null,
        newVipId: mkId,
        name,
      });
    } else {
      wrongCount++;
      corrections.push({
        memberId: bestMatch.id,
        oldVipId: bestMatch.vipId,
        newVipId: mkId,
        name,
      });
    }
  }

  console.log(`\nCorrect: ${correctCount}`);
  console.log(`Wrong vipId: ${wrongCount}`);
  console.log(`Missing vipId: ${missingVipId}`);
  console.log(`Not in DB: ${notInDb}`);

  if (corrections.length > 0) {
    console.log(`\n=== Corrections needed (${corrections.length}) ===`);
    for (const c of corrections) {
      console.log(
        `  id=${c.memberId}: "${c.name}" ${c.oldVipId} → ${c.newVipId}`,
      );
    }
  }

  // 5. Show members with 0 votes who are current
  console.log('\n=== Current members with wrong/missing vipIds ===');
  const currentMissing = corrections.filter((c) => {
    const m = dbMembers.find((m) => m.id === c.memberId);
    return m?.isCurrent;
  });
  for (const c of currentMissing) {
    console.log(
      `  id=${c.memberId}: "${c.name}" old=${c.oldVipId} → new=${c.newVipId}`,
    );
  }

  process.exit(0);
}

main().catch(console.error);
