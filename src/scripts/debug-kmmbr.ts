import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  // 1. kmmbr_id is Edm.String - need to query with string syntax
  const tests = [
    `https://knesset.gov.il/Odata/Votes.svc/vote_rslts_kmmbr_shadow?$format=json&$filter=kmmbr_id eq '000032681'&$top=3`,
    `https://knesset.gov.il/Odata/Votes.svc/vote_rslts_kmmbr_shadow?$format=json&$filter=kmmbr_id eq '32681'&$top=3`,
    `https://knesset.gov.il/Odata/Votes.svc/vote_rslts_kmmbr_shadow?$format=json&$filter=kmmbr_id eq '000034520'&$top=3`,
  ];
  
  for (const url of tests) {
    const resp = await fetch(url);
    const data = await resp.json() as { value?: Array<Record<string, unknown>> };
    const count = data.value?.length ?? 0;
    console.log(`${url.split('filter=')[1]?.split('&')[0]}: ${count} results`);
    if (count > 0) {
      console.log('  Sample kmmbr_id:', data.value![0].kmmbr_id);
    }
  }

  // 2. Check what kmmbr_id looks like in a raw page of the legacy API
  const rawUrl = `https://knesset.gov.il/Odata/Votes.svc/vote_rslts_kmmbr_shadow?$format=json&$top=3&$select=vote_id,kmmbr_id,knesset_num`;
  const rawResp = await fetch(rawUrl);
  const rawData = await rawResp.json() as { value: Array<Record<string, unknown>> };
  console.log('\nRaw kmmbr_id values:');
  for (const r of rawData.value) {
    console.log(`  vote_id=${r.vote_id}, kmmbr_id="${r.kmmbr_id}" (type: ${typeof r.kmmbr_id}), knesset_num=${r.knesset_num}`);
  }

  // 3. Check latest v4 vote date to see if data is up to date
  const v4Url = `https://knesset.gov.il/OdataV4/ParliamentInfo/KNS_PlenumVoteResult?$orderby=VoteID desc&$top=3&$select=VoteID,MkId,ResultCode`;
  const v4Resp = await fetch(v4Url);
  const v4Data = await v4Resp.json() as { value: Array<Record<string, unknown>> };
  console.log('\nLatest v4 PlenumVoteResult entries:');
  for (const r of v4Data.value) {
    console.log(`  VoteID=${r.VoteID}, MkId=${r.MkId}, ResultCode=${r.ResultCode}`);
  }

  // 4. Check latest vote in our DB
  const { db } = await import('../lib/db');
  const { sql } = await import('drizzle-orm');
  const latestVote = await db.execute(sql.raw(`
    SELECT id, knesset_id, title, vote_date, knesset_num 
    FROM votes 
    ORDER BY vote_date DESC
    LIMIT 3
  `));
  console.log('\nLatest votes in our DB:');
  for (const v of latestVote) {
    console.log(`  id=${v.id}, knesset_id=${v.knesset_id}, date=${v.vote_date}, knesset=${v.knesset_num}`);
  }

  process.exit(0);
}

main();
