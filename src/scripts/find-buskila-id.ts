import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  // Search for Buskila in KNS_Person
  const url1 = `https://knesset.gov.il/OdataV4/ParliamentInfo/KNS_Person?$filter=contains(LastName,'בוסקילה')&$select=PersonID,FirstName,LastName,GenderDesc,Email`;
  console.log('Fetching KNS_Person...');
  const resp1 = await fetch(url1);
  const data1 = await resp1.json() as { value: Array<Record<string, unknown>> };
  console.log('KNS_Person results:', JSON.stringify(data1.value, null, 2));

  // Search in View_Vote_MK_Individual (the view that maps names to MkIds)
  const url2 = `https://knesset.gov.il/Odata/Votes.svc/View_Vote_MK_Individual?$filter=substringof('בוסקילה',mk_individual_name_heb)&$top=5&$format=json`;
  console.log('\nFetching View_Vote_MK_Individual...');
  const resp2 = await fetch(url2);
  const data2 = await resp2.json() as { value: Array<Record<string, unknown>> };
  console.log('View_Vote_MK_Individual results:', JSON.stringify(data2.value, null, 2));

  // Check the Knesset website API for the member
  const url3 = `https://knesset.gov.il/WebSiteApi/knessetapi/MKs?$filter=contains(LastNameHeb,'בוסקילה')`;
  console.log('\nFetching WebSiteApi/MKs...');
  try {
    const resp3 = await fetch(url3);
    const data3 = await resp3.json();
    console.log('WebSiteApi results:', JSON.stringify(data3, null, 2).substring(0, 1000));
  } catch (e) {
    console.log('WebSiteApi failed:', (e as Error).message);
  }

  // Check our DB - what name matched to vipId 32681?
  const { db } = await import('../lib/db');
  const { sql } = await import('drizzle-orm');
  
  // Check what vipId 32681 maps to in the vote individual view
  const url4 = `https://knesset.gov.il/Odata/Votes.svc/View_Vote_MK_Individual?$filter=mk_individual_id eq 32681&$format=json`;
  console.log('\nChecking vipId 32681 in vote view...');
  const resp4 = await fetch(url4);
  const data4 = await resp4.json() as { value: Array<Record<string, unknown>> };
  console.log('VipId 32681:', JSON.stringify(data4.value, null, 2));

  process.exit(0);
}

main();
