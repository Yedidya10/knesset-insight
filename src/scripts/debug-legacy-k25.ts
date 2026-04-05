import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  // Check if legacy vote_rslts_kmmbr_shadow has K25 data
  const legacyK25 = `https://knesset.gov.il/Odata/Votes.svc/vote_rslts_kmmbr_shadow?$format=json&$filter=knesset_num eq 25&$top=5&$orderby=vote_id desc`;
  console.log('Legacy K25 votes:');
  const resp = await fetch(legacyK25);
  const data = await resp.json() as { value?: Array<Record<string, unknown>> };
  console.log(`  Count: ${data.value?.length ?? 0}`);
  if (data.value?.length) {
    console.log('  Sample:', JSON.stringify(data.value[0], null, 2));
  }
  
  // Check legacy total count for K25
  const legacyK25Count = `https://knesset.gov.il/Odata/Votes.svc/vote_rslts_kmmbr_shadow/$count?$filter=knesset_num eq 25`;
  const countResp = await fetch(legacyK25Count);
  console.log('  Legacy K25 total count:', await countResp.text());

  // If legacy has K25 data, check if Buskila is there
  if (data.value?.length) {
    const buskVoteUrl = `https://knesset.gov.il/Odata/Votes.svc/vote_rslts_kmmbr_shadow?$format=json&$filter=knesset_num eq 25 and kmmbr_id eq '000032681'&$top=5`;
    const buskResp = await fetch(buskVoteUrl);
    const buskData = await buskResp.json() as { value?: Array<Record<string, unknown>> };
    console.log(`\n  Buskila in legacy K25: ${buskData.value?.length ?? 0}`);
    
    // Also search by Illouz
    const illouzUrl = `https://knesset.gov.il/Odata/Votes.svc/vote_rslts_kmmbr_shadow?$format=json&$filter=knesset_num eq 25 and kmmbr_id eq '000034520'&$top=5`;
    const illouzResp = await fetch(illouzUrl);
    const illouzData = await illouzResp.json() as { value?: Array<Record<string, unknown>> };
    console.log(`  Illouz in legacy K25: ${illouzData.value?.length ?? 0}`);
  }

  // Check full vote 45854 in legacy
  const legacyVote = `https://knesset.gov.il/Odata/Votes.svc/vote_rslts_kmmbr_shadow?$format=json&$filter=vote_id eq 45854&$top=200`;
  const vr = await fetch(legacyVote);
  const vd = await vr.json() as { value?: Array<Record<string, unknown>> };
  console.log(`\nLegacy vote 45854 total results: ${vd.value?.length ?? 0}`);
  if (vd.value?.length) {
    // Check if Buskila is in this vote
    const hasBuskila = vd.value.some((r: Record<string, unknown>) => r.kmmbr_id === '000032681');
    console.log(`  Buskila in vote 45854 (legacy): ${hasBuskila}`);
    // Show some kmmbr_ids
    const ids = vd.value.slice(0, 5).map((r: Record<string, unknown>) => r.kmmbr_id);
    console.log('  Sample kmmbr_ids:', ids);
  }

  process.exit(0);
}

main();
