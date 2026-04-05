import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  // Key question: does v4 KNS_PlenumVoteResult.MkId = vip_id or mk_individual_id?
  
  // Buskila: vip_id=32681, mk_individual_id=1088
  // Test both
  const tests = [
    { label: 'Buskila mk_individual_id', mkId: 1088 },
    { label: 'Buskila vip_id', mkId: 32681 },
  ];

  for (const t of tests) {
    const url = `https://knesset.gov.il/OdataV4/ParliamentInfo/KNS_PlenumVoteResult?$filter=MkId eq ${t.mkId}&$top=3&$orderby=VoteID desc`;
    const resp = await fetch(url);
    const data = await resp.json() as { value: Array<Record<string, unknown>> };
    console.log(`${t.label} (MkId=${t.mkId}): ${data.value?.length ?? 0} results`);
    if (data.value?.length) {
      console.log('  Sample:', JSON.stringify(data.value[0]));
    }
  }

  // Also check Dan Illouz to understand
  // Dan Illouz: vip_id=34520 (stored in our DB), PersonID=30839
  // Find his mk_individual_id from View_Vote_MK_Individual
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
  
  const illouz = allRecords.find((r: Record<string, unknown>) => 
    String(r.mk_individual_name).includes('אילוז')
  );
  console.log('\nDan Illouz entry:', JSON.stringify(illouz, null, 2));

  if (illouz) {
    const illouzVipId = parseInt(String(illouz.vip_id), 10);
    const illouzMkId = illouz.mk_individual_id;
    
    const url1 = `https://knesset.gov.il/OdataV4/ParliamentInfo/KNS_PlenumVoteResult?$filter=MkId eq ${illouzMkId}&$top=1`;
    const resp1 = await fetch(url1);
    const data1 = await resp1.json() as { value: Array<Record<string, unknown>> };
    console.log(`Illouz mk_individual_id (${illouzMkId}): ${data1.value?.length} v4 results`);

    const url2 = `https://knesset.gov.il/OdataV4/ParliamentInfo/KNS_PlenumVoteResult?$filter=MkId eq ${illouzVipId}&$top=1`;
    const resp2 = await fetch(url2);
    const data2 = await resp2.json() as { value: Array<Record<string, unknown>> };
    console.log(`Illouz vip_id (${illouzVipId}): ${data2.value?.length} v4 results`);
  }

  // Also check legacy for Buskila
  const legacyUrl = `https://knesset.gov.il/Odata/Votes.svc/vote_rslts_kmmbr_shadow?$format=json&$filter=kmmbr_id eq 32681&$top=3`;
  const lr = await fetch(legacyUrl);
  const ld = await lr.json();
  console.log('\nLegacy kmmbr_id=32681:', JSON.stringify(ld).substring(0, 200));

  const legacyUrl2 = `https://knesset.gov.il/Odata/Votes.svc/vote_rslts_kmmbr_shadow?$format=json&$filter=kmmbr_id eq 1088&$top=3`;
  const lr2 = await fetch(legacyUrl2);
  const ld2 = await lr2.json();
  console.log('Legacy kmmbr_id=1088:', JSON.stringify(ld2).substring(0, 200));

  process.exit(0);
}

main();
