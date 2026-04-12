/**
 * Discover the WebSiteApi endpoint for vote results.
 * Tests various endpoint patterns used by the Knesset website.
 */
export {};

const WEBSITE_API = 'https://main.knesset.gov.il/WebSiteApi/Knesset';
const VOTE_ID = 45854; // Known K25 vote
const MK_ID = 1088; // Buskila's mk_individual_id

async function tryEndpoint(name: string, url: string, options?: RequestInit) {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(options?.headers || {}),
      },
      signal: AbortSignal.timeout(10_000),
    });
    const text = await res.text();
    const preview = text.substring(0, 500);
    console.log(`\n[${name}] ${res.status} ${res.statusText}`);
    if (res.ok) {
      console.log(`  Response (first 500 chars): ${preview}`);
    }
    return { name, status: res.status, ok: res.ok, preview };
  } catch (err: any) {
    console.log(`\n[${name}] ERROR: ${err.message}`);
    return { name, status: 0, ok: false, preview: '' };
  }
}

async function main() {
  console.log(
    '=== Discovering Knesset WebSiteApi vote results endpoints ===\n',
  );

  // 1. Try GET endpoints for vote results
  const getEndpoints = [
    [
      'GET GetVoteResults',
      `${WEBSITE_API}/Votes/GetVoteResults?voteId=${VOTE_ID}`,
    ],
    [
      'GET GetVoteResult',
      `${WEBSITE_API}/Votes/GetVoteResult?voteId=${VOTE_ID}`,
    ],
    [
      'GET GetVoteDetails',
      `${WEBSITE_API}/Votes/GetVoteDetails?voteId=${VOTE_ID}`,
    ],
    [
      'GET GetVoteMembers',
      `${WEBSITE_API}/Votes/GetVoteMembers?voteId=${VOTE_ID}`,
    ],
    [
      'GET GetPlenumVotes',
      `${WEBSITE_API}/Votes/GetPlenumVotes?voteId=${VOTE_ID}`,
    ],
    ['GET GetMKVotes', `${WEBSITE_API}/MK/GetMKVotes?mkId=${MK_ID}`],
    [
      'GET GetMKPlenumVotes',
      `${WEBSITE_API}/MK/GetMKPlenumVotes?mkId=${MK_ID}`,
    ],
    [
      'GET GetMKVotingRecord',
      `${WEBSITE_API}/MK/GetMKVotingRecord?mkId=${MK_ID}`,
    ],
    ['GET GetMKActivity', `${WEBSITE_API}/MK/GetMKActivity?mkId=${MK_ID}`],
    [
      'GET GetMKParliamentaryActivity',
      `${WEBSITE_API}/MK/GetMKParliamentaryActivity?mkId=${MK_ID}`,
    ],
    ['GET vote by id', `${WEBSITE_API}/Votes/${VOTE_ID}`],
  ];

  for (const [name, url] of getEndpoints) {
    await tryEndpoint(name, url);
  }

  // 2. Try POST endpoints for vote results
  const postEndpoints: [string, string, object][] = [
    [
      'POST GetVoteResults',
      `${WEBSITE_API}/Votes/GetVoteResults`,
      { VoteId: VOTE_ID },
    ],
    [
      'POST GetVoteResult',
      `${WEBSITE_API}/Votes/GetVoteResult`,
      { VoteId: VOTE_ID },
    ],
    [
      'POST GetVoteDetails',
      `${WEBSITE_API}/Votes/GetVoteDetails`,
      { VoteId: VOTE_ID },
    ],
    [
      'POST GetVoteMembers',
      `${WEBSITE_API}/Votes/GetVoteMembers`,
      { VoteId: VOTE_ID },
    ],
    [
      'POST GetMKVotes',
      `${WEBSITE_API}/MK/GetMKVotes`,
      { MkId: MK_ID, KnessetNum: 25 },
    ],
    [
      'POST GetMKPlenumVotes',
      `${WEBSITE_API}/MK/GetMKPlenumVotes`,
      { MkId: MK_ID, KnessetNum: 25 },
    ],
    [
      'POST GetMKVotingRecord',
      `${WEBSITE_API}/MK/GetMKVotingRecord`,
      { MkId: MK_ID, KnessetNum: 25 },
    ],
    [
      'POST GetMKActivity',
      `${WEBSITE_API}/MK/GetMKActivity`,
      { MkId: MK_ID, KnessetNum: 25 },
    ],
  ];

  for (const [name, url, body] of postEndpoints) {
    await tryEndpoint(name, url, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // 3. Try the Knesset website page directly to find API references
  console.log('\n\n=== Checking page source for API clues ===');
  try {
    const pageRes = await fetch(
      `https://main.knesset.gov.il/Activity/Legislation/Pages/VoteDetails.aspx?VoteID=${VOTE_ID}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    const html = await pageRes.text();
    // Look for API URLs in the HTML
    const apiRefs = html.match(/WebSiteApi[^"'\s]*/g) || [];
    console.log(
      `Found ${apiRefs.length} WebSiteApi references in vote page HTML:`,
    );
    for (const ref of [...new Set(apiRefs)]) {
      console.log(`  ${ref}`);
    }

    // Look for fetch/ajax/XMLHttpRequest calls
    const fetchCalls = html.match(/fetch\(["'][^"']+["']/g) || [];
    console.log(`\nFound ${fetchCalls.length} fetch calls:`);
    for (const call of [...new Set(fetchCalls)]) {
      console.log(`  ${call}`);
    }
  } catch (err: any) {
    console.log(`Page fetch error: ${err.message}`);
  }

  // 4. Try the newer Next.js-style API if they migrated
  console.log('\n\n=== Trying alternative API patterns ===');
  const altEndpoints = [
    ['GET api/votes', `https://main.knesset.gov.il/api/votes/${VOTE_ID}`],
    [
      'GET api/vote-results',
      `https://main.knesset.gov.il/api/vote-results/${VOTE_ID}`,
    ],
    [
      'GET mk activity json',
      `https://main.knesset.gov.il/mk/Apps/mk/mk-parliamentary-activity/${MK_ID}?format=json`,
    ],
    [
      'GET mk votes json',
      `https://main.knesset.gov.il/mk/Apps/mk/mk-votes/${MK_ID}`,
    ],
  ];

  for (const [name, url] of altEndpoints) {
    await tryEndpoint(name, url);
  }
}

main().catch(console.error);
