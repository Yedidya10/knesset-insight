/**
 * Investigate what ID system the v4 MkId actually uses.
 * Cross-reference v4 MkIds with PersonID, vipId, and mk_individual_id.
 */
export {};

async function main() {
  // 1. Get full results for vote 40000 including names
  console.log('=== Vote 40000: Full member list with MkId ===');
  const url = `https://knesset.gov.il/OdataV4/ParliamentInfo/KNS_PlenumVoteResult?$filter=VoteID eq 40000&$select=MkId,FirstName,LastName,ResultCode&$orderby=MkId&$format=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  const data = await res.json();

  console.log(`Total: ${data.value.length} results`);
  console.log('\nMkId    | Name                      | Result');
  console.log('--------|---------------------------|-------');
  for (const r of data.value) {
    console.log(
      `${String(r.MkId).padEnd(7)} | ${(r.FirstName + ' ' + r.LastName).padEnd(25)} | ${r.ResultCode}`,
    );
  }

  // 2. Check Dan Illouz result
  console.log('\n=== Dan Illouz check ===');
  const illouz = data.value.find(
    (r: any) =>
      r.LastName?.includes('אילוז') ||
      r.LastName?.includes('Illouz') ||
      r.MkId === 34520,
  );
  console.log(
    `Illouz in vote 40000: ${illouz ? JSON.stringify(illouz) : 'NOT FOUND'}`,
  );

  // 3. Check MkId=34520 specifically
  const url2 = `https://knesset.gov.il/OdataV4/ParliamentInfo/KNS_PlenumVoteResult?$filter=MkId eq 34520&$top=3&$format=json`;
  const res2 = await fetch(url2, { signal: AbortSignal.timeout(10_000) });
  const data2 = await res2.json();
  console.log(`\nMkId=34520 results: ${data2.value?.length}`);
  for (const r of data2.value || []) {
    console.log(
      `  VoteID=${r.VoteID}, ${r.FirstName} ${r.LastName}, ResultCode=${r.ResultCode}`,
    );
  }

  // 4. Look up Buskila in KNS_Person to get PersonID
  console.log('\n=== KNS_Person lookup for Buskila ===');
  const url3 = `https://knesset.gov.il/OdataV4/ParliamentInfo/KNS_Person?$filter=contains(LastName,'בוסקילה')&$format=json`;
  const res3 = await fetch(url3, { signal: AbortSignal.timeout(10_000) });
  const data3 = await res3.json();
  console.log(`Buskila in KNS_Person: ${data3.value?.length} results`);
  for (const p of data3.value || []) {
    console.log(
      `  PersonID=${p.PersonID}, ${p.FirstName} ${p.LastName}, IsCurrent=${p.IsCurrent}`,
    );
  }

  // 5. Check the MK table in v4 - there might be a KNS_MK or KNS_MkIndividual table
  console.log('\n=== Checking for KNS_MkIndividual, KNS_MK entities ===');
  for (const entity of ['KNS_MkIndividual', 'kns_MKIndividual', 'KNS_MK']) {
    try {
      const url = `https://knesset.gov.il/OdataV4/ParliamentInfo/${entity}?$top=3&$format=json`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (res.ok) {
        const d = await res.json();
        console.log(`${entity}: ${d.value?.length} results`);
        if (d.value?.[0])
          console.log(
            `  Sample record keys: ${Object.keys(d.value[0]).join(', ')}`,
          );
        if (d.value?.[0])
          console.log(
            `  Sample: ${JSON.stringify(d.value[0]).substring(0, 300)}`,
          );
      } else {
        console.log(`${entity}: ${res.status}`);
      }
    } catch (err: any) {
      console.log(`${entity}: ERROR - ${err.message}`);
    }
  }

  // 6. Check vote result for PersonID=30799 (Buskila's PersonID)
  console.log('\n=== V4 check by PersonID ===');
  for (const [name, id] of [
    ['Buskila', 30799],
    ['Israel Katz', 46],
  ] as const) {
    try {
      const url = `https://knesset.gov.il/OdataV4/ParliamentInfo/KNS_PlenumVoteResult?$filter=MkId eq ${id}&$count=true&$top=3&$format=json`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      const d = await res.json();
      console.log(
        `${name} (PersonID=${id}): ${d['@odata.count'] ?? d.value?.length} results`,
      );
    } catch (err: any) {
      console.log(`${name}: ${err.message}`);
    }
  }

  // 7. Try to find what MkId Buskila actually has in v4
  // Search for "בוסקילה" in vote results
  console.log('\n=== Searching for Buskila by name in v4 vote results ===');
  try {
    const url = `https://knesset.gov.il/OdataV4/ParliamentInfo/KNS_PlenumVoteResult?$filter=contains(LastName,'בוסקילה')&$top=5&$format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    const d = await res.json();
    console.log(
      `Search by LastName contains 'בוסקילה': ${d.value?.length} results`,
    );
    for (const r of d.value || []) {
      console.log(
        `  MkId=${r.MkId}, VoteID=${r.VoteID}, ${r.FirstName} ${r.LastName}`,
      );
    }
  } catch (err: any) {
    console.log(`Error: ${err.message}`);
  }
}

main().catch(console.error);
