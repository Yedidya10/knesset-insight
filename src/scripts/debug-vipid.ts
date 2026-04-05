import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  // Fetch View_Vote_MK_Individual and look for Buskila
  const url = `https://knesset.gov.il/Odata/Votes.svc/View_Vote_MK_Individual?$format=json`;
  console.log('Fetching all View_Vote_MK_Individual entries...');
  const resp = await fetch(url + '&$top=100');
  const data = await resp.json() as { value: Array<Record<string, unknown>> };
  
  // Show first entry to understand field structure
  console.log('Sample entry:', JSON.stringify(data.value[0], null, 2));
  
  // Find Buskila
  const buskila = data.value.filter((r: Record<string, unknown>) => 
    String(r.mk_individual_name || '').includes('בוסקילה')
  );
  console.log('\nBuskila in first page:', JSON.stringify(buskila, null, 2));

  // Check if vip_id differs from mk_individual_id for ANY entry
  let diffCount = 0;
  const diffs: Array<Record<string, unknown>> = [];
  for (const r of data.value) {
    if (String(r.vip_id) !== String(r.mk_individual_id)) {
      diffCount++;
      if (diffs.length < 5) diffs.push(r);
    }
  }
  console.log(`\nvip_id != mk_individual_id in ${diffCount}/${data.value.length} entries`);
  if (diffs.length > 0) {
    console.log('Diff samples:', JSON.stringify(diffs, null, 2));
  }

  // Now check: is the vip_id field what maps to KNS_PlenumVoteResult.MkId?
  // Let's find an entry and check both
  const sampleVipId = data.value[0].vip_id;
  const sampleMkId = data.value[0].mk_individual_id;
  
  // Check which one has results in v4
  const url2 = `https://knesset.gov.il/OdataV4/ParliamentInfo/KNS_PlenumVoteResult?$filter=MkId eq ${sampleMkId}&$top=1`;
  const resp2 = await fetch(url2);
  const data2 = await resp2.json() as { value: Array<Record<string, unknown>> };
  console.log(`\nv4 results for mk_individual_id ${sampleMkId}:`, data2.value?.length);

  const url3 = `https://knesset.gov.il/OdataV4/ParliamentInfo/KNS_PlenumVoteResult?$filter=MkId eq ${sampleVipId}&$top=1`;
  const resp3 = await fetch(url3);
  const data3 = await resp3.json() as { value: Array<Record<string, unknown>> };
  console.log(`v4 results for vip_id ${sampleVipId}:`, data3.value?.length);

  // Now fetch ALL pages to find Buskila (might be on later pages)
  let allRecords: Array<Record<string, unknown>> = [];
  let skip = 0;
  while (true) {
    const pageUrl = `https://knesset.gov.il/Odata/Votes.svc/View_Vote_MK_Individual?$format=json&$top=100&$skip=${skip}`;
    const pageResp = await fetch(pageUrl);
    const pageData = await pageResp.json() as { value: Array<Record<string, unknown>> };
    allRecords = allRecords.concat(pageData.value);
    if (pageData.value.length < 100) break;
    skip += 100;
  }
  console.log(`\nTotal View_Vote_MK_Individual records: ${allRecords.length}`);
  
  const allBuskila = allRecords.filter((r: Record<string, unknown>) => 
    String(r.mk_individual_name || '').includes('בוסקילה')
  );
  console.log('Buskila entries:', JSON.stringify(allBuskila, null, 2));

  // Check v4 for Buskila's PersonID (30799)
  const url4 = `https://knesset.gov.il/OdataV4/ParliamentInfo/KNS_PlenumVoteResult?$filter=MkId eq 30799&$top=1`;
  const resp4 = await fetch(url4);
  const data4 = await resp4.json() as { value: Array<Record<string, unknown>> };
  console.log(`\nv4 results for PersonID 30799:`, data4.value?.length);

  process.exit(0);
}

main();
