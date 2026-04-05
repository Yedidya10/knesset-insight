import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { db } = await import('../lib/db');
  const { sql } = await import('drizzle-orm');

  // Check if Buskila's vipId appears in any member_votes via the votes table
  // The v4 sync maps MkId → memberMapForFk which is keyed by vipId
  // Let's verify by checking the Knesset API directly
  const vipId = 32681;
  
  // Check KNS_PlenumVoteResult for this MkId
  const url = `https://knesset.gov.il/OdataV4/ParliamentInfo/KNS_PlenumVoteResult?$filter=MkId eq ${vipId}&$top=5&$orderby=VoteID desc`;
  console.log('Fetching:', url);
  const resp = await fetch(url);
  const data = await resp.json() as { value: Array<{ VoteID: number; MkId: number; ResultCode: number }> };
  console.log('V4 API results for MkId', vipId, ':', data.value?.length, 'records');
  if (data.value?.length) {
    console.log('Sample:', JSON.stringify(data.value.slice(0, 3), null, 2));
  }

  // Also check legacy OData
  const legacyUrl = `https://knesset.gov.il/Odata/Votes.svc/vote_rslts_kmmbr_shadow?$filter=kmmbr_id eq ${vipId}&$top=5&$format=json&$orderby=vote_id desc`;
  console.log('\nFetching legacy:', legacyUrl);
  const resp2 = await fetch(legacyUrl);
  const data2 = await resp2.json() as { value: Array<Record<string, unknown>> };
  console.log('Legacy API results for kmmbr_id', vipId, ':', data2.value?.length, 'records');
  if (data2.value?.length) {
    console.log('Sample:', JSON.stringify(data2.value.slice(0, 2), null, 2));
  }

  // Check how many current members have vip_id but 0 votes
  const withVipNoVotes = await db.execute(sql.raw(`
    SELECT m.id, m.first_name, m.last_name, m.vip_id
    FROM members m
    WHERE m.is_current = true
    AND m.vip_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM member_votes mv WHERE mv.member_id = m.id)
  `));
  console.log('\nCurrent members WITH vipId but 0 votes:', withVipNoVotes.length);
  for (const m of withVipNoVotes) {
    console.log(`  ${m.first_name} ${m.last_name} (id=${m.id}, vipId=${m.vip_id})`);
  }

  process.exit(0);
}

main();
