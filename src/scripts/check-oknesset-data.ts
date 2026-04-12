/**
 * Check Open Knesset CSV data for K25 vote results and investigate Buskila's missing votes.
 */
export {};

async function main() {
  // 1. Check Open Knesset vote_rslts_kmmbr_shadow.csv header + sample
  console.log('=== Checking Open Knesset vote_rslts_kmmbr_shadow.csv ===');
  try {
    const url =
      'https://production.oknesset.org/pipelines/data/votes/vote_rslts_kmmbr_shadow/vote_rslts_kmmbr_shadow.csv';
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    const contentLength = res.headers.get('content-length');
    console.log(
      `Content-Length: ${contentLength} bytes (${Math.round(Number(contentLength) / 1024 / 1024)}MB)`,
    );

    // Read just first 5KB to see headers + sample
    const reader = res.body!.getReader();
    let text = '';
    while (text.length < 5000) {
      const { done, value } = await reader.read();
      if (done) break;
      text += new TextDecoder().decode(value);
    }
    reader.cancel();

    const lines = text.split('\n');
    console.log(`\nHeaders: ${lines[0]}`);
    console.log(`\nFirst 5 data rows:`);
    for (let i = 1; i <= Math.min(5, lines.length - 1); i++) {
      console.log(`  ${lines[i]}`);
    }
  } catch (err: any) {
    console.log(`Error: ${err.message}`);
  }

  // 2. Check vote_rslts_kmmbr_shadow_extra (might have newer data)
  console.log('\n=== Checking vote_rslts_kmmbr_shadow_extra.csv ===');
  try {
    const url =
      'https://production.oknesset.org/pipelines/data/votes/vote_rslts_kmmbr_shadow_extra/vote_rslts_kmmbr_shadow.csv';
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    const contentLength = res.headers.get('content-length');
    console.log(
      `Content-Length: ${contentLength} bytes (${Math.round(Number(contentLength) / 1024 / 1024)}MB)`,
    );

    const reader = res.body!.getReader();
    let text = '';
    while (text.length < 5000) {
      const { done, value } = await reader.read();
      if (done) break;
      text += new TextDecoder().decode(value);
    }
    reader.cancel();

    const lines = text.split('\n');
    console.log(`Headers: ${lines[0]}`);
    console.log(`First 5 data rows:`);
    for (let i = 1; i <= Math.min(5, lines.length - 1); i++) {
      console.log(`  ${lines[i]}`);
    }
  } catch (err: any) {
    console.log(`Error: ${err.message}`);
  }

  // 3. Check view_vote_mk_individual
  console.log('\n=== Checking view_vote_mk_individual.csv ===');
  try {
    const url =
      'https://production.oknesset.org/pipelines/data/votes/view_vote_mk_individual/view_vote_mk_individual.csv';
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    const contentLength = res.headers.get('content-length');
    console.log(
      `Content-Length: ${contentLength} bytes (${Math.round(Number(contentLength) / 1024 / 1024)}MB)`,
    );

    const reader = res.body!.getReader();
    let text = '';
    while (text.length < 5000) {
      const { done, value } = await reader.read();
      if (done) break;
      text += new TextDecoder().decode(value);
    }
    reader.cancel();

    const lines = text.split('\n');
    console.log(`Headers: ${lines[0]}`);
    console.log(`First 5 data rows:`);
    for (let i = 1; i <= Math.min(5, lines.length - 1); i++) {
      console.log(`  ${lines[i]}`);
    }
  } catch (err: any) {
    console.log(`Error: ${err.message}`);
  }

  // 4. Check OData v4: does MkId=32681 (Buskila) appear in ANY vote result?
  console.log(
    '\n=== Checking if Buskila (MkId=32681) appears in v4 OData at all ===',
  );
  try {
    const url = `https://knesset.gov.il/OdataV4/ParliamentInfo/KNS_PlenumVoteResult?$filter=MkId eq 32681&$count=true&$top=5&$format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    const data = await res.json();
    console.log(
      `Total results for MkId=32681: ${data['@odata.count'] ?? data.value?.length}`,
    );
    if (data.value?.length > 0) {
      for (const r of data.value.slice(0, 5)) {
        console.log(
          `  VoteID=${r.VoteID}, ResultCode=${r.ResultCode}, ${r.FirstName} ${r.LastName}`,
        );
      }
    }
  } catch (err: any) {
    console.log(`Error: ${err.message}`);
  }

  // 5. Check a few other missing member MkIds
  console.log('\n=== Checking other K25-only members in v4 ===');
  const membersToCheck = [
    { name: 'Israel Katz', mkId: 3260 },
    { name: 'Yoav Segalovich', mkId: 0 }, // need to find
    { name: 'Benny Gantz', mkId: 0 },
    { name: 'Buskila', mkId: 32681 },
  ];

  // Check Israel Katz specifically
  try {
    const url = `https://knesset.gov.il/OdataV4/ParliamentInfo/KNS_PlenumVoteResult?$filter=MkId eq 3260&$count=true&$top=3&$format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    const data = await res.json();
    console.log(
      `Israel Katz (MkId=3260): ${data['@odata.count'] ?? data.value?.length} results`,
    );
    if (data.value?.length > 0) {
      for (const r of data.value.slice(0, 3)) {
        console.log(
          `  VoteID=${r.VoteID}, ResultCode=${r.ResultCode}, ${r.FirstName} ${r.LastName}`,
        );
      }
    }
  } catch (err: any) {
    console.log(`Error: ${err.message}`);
  }

  // 6. How many distinct MkIds are in v4 vote results?
  console.log('\n=== Distinct MkIds in recent K25 votes ===');
  try {
    // Check a complete-looking vote (40000)
    const url = `https://knesset.gov.il/OdataV4/ParliamentInfo/KNS_PlenumVoteResult?$filter=VoteID eq 40000&$select=MkId,FirstName,LastName&$format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    const data = await res.json();
    const mkIds = new Set(data.value.map((r: any) => r.MkId));
    console.log(
      `Vote 40000: ${data.value.length} results, ${mkIds.size} distinct MkIds`,
    );

    // Check if Buskila's MkId is in this vote
    const buskila = data.value.find((r: any) => r.MkId === 32681);
    console.log(
      `Buskila in vote 40000: ${buskila ? `YES (${buskila.FirstName} ${buskila.LastName})` : 'NO'}`,
    );

    // Show sample MkIds
    console.log(`Sample MkIds: ${[...mkIds].slice(0, 10).join(', ')}`);
  } catch (err: any) {
    console.log(`Error: ${err.message}`);
  }
}

main().catch(console.error);
