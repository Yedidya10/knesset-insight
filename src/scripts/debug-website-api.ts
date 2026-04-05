import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  // The Knesset website at mk-parliamentary-activity/1088 likely uses WebSiteApi
  // Let's find what API the website uses for vote data
  
  // Check WebSiteApi for MK votes
  const baseUrl = 'https://knesset.gov.il/WebSiteApi/knessetapi';
  
  // Common endpoint patterns
  const endpoints = [
    `${baseUrl}/MKs/1088/Votes`,
    `${baseUrl}/MK/1088/Votes`,
    `${baseUrl}/MKs/1088/PlenumVotes`,
    `${baseUrl}/Votes/MK/1088`,
    `${baseUrl}/MK/1088/VoteStatistics`,
  ];

  for (const url of endpoints) {
    try {
      const resp = await fetch(url, { headers: { Accept: 'application/json' } });
      console.log(`${url.replace(baseUrl, '')} → ${resp.status}`);
      if (resp.ok) {
        const text = await resp.text();
        console.log('  Response preview:', text.substring(0, 300));
      }
    } catch (e) {
      console.log(`${url.replace(baseUrl, '')} → ERROR: ${(e as Error).message}`);
    }
  }

  // Also check v4 entities available
  console.log('\n--- Checking v4 vote-related entities ---');
  const v4Entities = [
    'KNS_PlenumVoteResult',
    'KNS_VoteResult', 
    'KNS_Vote',
    'KNS_PlmSessionVote',
  ];
  
  for (const entity of v4Entities) {
    const url = `https://knesset.gov.il/OdataV4/ParliamentInfo/${entity}?$top=1`;
    try {
      const resp = await fetch(url);
      console.log(`${entity}: ${resp.status}`);
    } catch (e) {
      console.log(`${entity}: ERROR`);
    }
  }

  // Check if vote 45854 (latest in our DB, March 30 2026) has Buskila 
  const voteCheck = `https://knesset.gov.il/OdataV4/ParliamentInfo/KNS_PlenumVoteResult?$filter=VoteID eq 45854 and MkId eq 32681`;
  const vc = await fetch(voteCheck);
  const vcd = await vc.json() as { value: Array<Record<string, unknown>> };
  console.log(`\nVote 45854 + Buskila vipId: ${vcd.value?.length} results`);

  // Check how many distinct MkIds are in vote 45854
  const allForVote = `https://knesset.gov.il/OdataV4/ParliamentInfo/KNS_PlenumVoteResult?$filter=VoteID eq 45854&$select=MkId,ResultCode`;
  const afv = await fetch(allForVote);
  const afvd = await afv.json() as { value: Array<{ MkId: number; ResultCode: number }> };
  console.log(`Vote 45854 total results: ${afvd.value?.length}`);
  const mkIds = new Set(afvd.value?.map((r: { MkId: number }) => r.MkId));
  console.log(`Distinct MkIds in vote 45854: ${mkIds.size}`);
  console.log(`MkIds include 32681 (Buskila vip): ${mkIds.has(32681)}`);
  console.log(`MkIds sample:`, [...mkIds].slice(0, 10));

  process.exit(0);
}

main();
