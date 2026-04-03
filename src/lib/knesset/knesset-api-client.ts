import { appConfig } from '../../../app.config';
import type {
  ODataV4PlenumVote,
  ODataV4PlenumVoteResult,
} from './types';

const WEBSITE_API_BASE =
  appConfig.dataSources.knessetWebsiteApi;
const ODATA_V4_BASE =
  appConfig.dataSources.knessetOdataV4;

/**
 * Response shape from GetVotesHeaders endpoint.
 */
export interface WebsiteApiVoteHeader {
  VoteId: number;
  VoteProtocolNo: number | null;
  VoteDate: string; // ISO datetime e.g. "2026-03-30T22:25:00"
  VoteDateStr: string;
  VoteTimeStr: string;
  VoteDateLongStr: string;
  VoteType: string; // "אלקטרונית" / "שמית"
  ItemTitle: string;
  KnessetId: number;
  SessionId: number;
}

interface GetVotesHeadersResponse {
  Table: WebsiteApiVoteHeader[];
}

/**
 * Fetch vote headers from the Knesset WebSiteApi.
 * This is the only API that has Knesset 25+ data.
 *
 * @param knessetNum - Knesset number (e.g. 25)
 * @param pageSize   - Results per page (max ~500)
 * @param pageNumber - 1-based page number
 */
export async function fetchWebsiteApiVoteHeaders(
  knessetNum: number,
  pageSize = 500,
  pageNumber = 1,
): Promise<WebsiteApiVoteHeader[]> {
  const url = `${WEBSITE_API_BASE}/Votes/GetVotesHeaders`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      KnessetNum: knessetNum,
      PageSize: pageSize,
      PageNumber: pageNumber,
      OrderBy: 'VoteDate',
      OrderDir: 'desc',
    }),
  });

  if (!response.ok) {
    throw new Error(
      `WebSiteApi fetch failed: ${response.status} ${response.statusText} — GetVotesHeaders`,
    );
  }

  const data: GetVotesHeadersResponse = await response.json();
  return data.Table ?? [];
}

/**
 * Fetch ALL vote headers for a knesset number.
 * The API ignores PageSize/PageNumber and returns all results in one response.
 */
export async function fetchAllWebsiteApiVoteHeaders(
  knessetNum: number,
  maxRetries = 3,
): Promise<WebsiteApiVoteHeader[]> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const results = await fetchWebsiteApiVoteHeaders(knessetNum, 10000, 1);
      console.log(
        `  [WebSiteApi] Knesset ${knessetNum}: ${results.length} vote headers`,
      );
      return results;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const delay = attempt * 2000;
      console.warn(
        `  [WebSiteApi retry] Attempt ${attempt} failed, retrying in ${delay}ms...`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return []; // unreachable
}

// ──────────────────────────────────────
// OData v4 — ParliamentInfo
// ──────────────────────────────────────

interface ODataV4Response<T> {
  value: T[];
  '@odata.count'?: number;
  '@odata.nextLink'?: string;
}

/**
 * Generic paginated fetch for OData v4 endpoints.
 * The v4 API returns max 100 items per page and provides @odata.nextLink.
 */
async function fetchAllODataV4<T>(
  entity: string,
  params: Record<string, string> = {},
  label = '',
  maxRetries = 5,
): Promise<T[]> {
  const results: T[] = [];
  // Build query string manually — URLSearchParams encodes $ as %24 which OData rejects
  const allParams = { $format: 'json', ...params };
  const qs = Object.entries(allParams)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  let url: string | null = `${ODATA_V4_BASE}/${entity}?${qs}`;

  let page = 0;
  while (url) {
    let data: ODataV4Response<T> | null = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response: Response = await fetch(url, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(30_000),
        });
        if (!response.ok) {
          throw new Error(`OData v4 fetch failed: ${response.status} ${response.statusText}`);
        }
        data = await response.json();
        break;
      } catch (err) {
        if (attempt === maxRetries) throw err;
        const delay = Math.min(attempt * 3000, 15000);
        console.warn(`  [ODataV4 retry] Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    if (!data) break;

    results.push(...data.value);
    page++;
    if (label && page % 10 === 0) {
      console.log(`  [${label}] page ${page}: total ${results.length}`);
    }

    url = data['@odata.nextLink'] ?? null;
    // Small delay between pages to avoid API throttling
    if (url) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  if (label) {
    console.log(`  [${label}] done: ${results.length} records in ${page} pages`);
  }
  return results;
}

/**
 * Fetch vote headers from OData v4 KNS_PlenumVote for a given knesset number.
 * Uses navigation property filter: KNS_PlenumSession/KnessetNum eq N
 */
export async function fetchV4PlenumVotes(
  knessetNum: number,
): Promise<ODataV4PlenumVote[]> {
  return fetchAllODataV4<ODataV4PlenumVote>(
    'KNS_PlenumVote',
    {
      $filter: `KNS_PlenumSession/KnessetNum eq ${knessetNum}`,
      $orderby: 'Id desc',
      $top: '100000',
    },
    `v4-votes-k${knessetNum}`,
  );
}

/**
 * Fetch member-level vote results from OData v4 KNS_PlenumVoteResult in a sub-range.
 * Uses a VoteID range filter, then filters to exact IDs client-side.
 */
export async function fetchV4VoteResults(
  minVoteId: number,
  maxVoteId: number,
  voteIdSet: Set<number>,
  label = 'v4-vote-results',
): Promise<ODataV4PlenumVoteResult[]> {
  console.log(`  [${label}] Fetching VoteID range ${minVoteId}–${maxVoteId}...`);

  const allResults = await fetchAllODataV4<ODataV4PlenumVoteResult>(
    'KNS_PlenumVoteResult',
    {
      $filter: `VoteID ge ${minVoteId} and VoteID le ${maxVoteId}`,
      $orderby: 'VoteID desc',
      $top: '1000000',
    },
    label,
  );

  const filtered = allResults.filter((r) => voteIdSet.has(r.VoteID));
  console.log(`  [${label}] Fetched ${allResults.length}, kept ${filtered.length}`);
  return filtered;
}

/** Minimal result type with only the 3 fields needed for tallies + member votes */
export type V4VoteResultMinimal = Pick<ODataV4PlenumVoteResult, 'VoteID' | 'MkId' | 'ResultCode'>;

/**
 * Fetch member-level vote results with minimal payload ($select=VoteID,MkId,ResultCode).
 * ~70% smaller than full results. Filters to exact vote IDs client-side.
 */
export async function fetchV4VoteResultsMinimal(
  minVoteId: number,
  maxVoteId: number,
  voteIdSet: Set<number>,
  label = 'v4-results',
): Promise<V4VoteResultMinimal[]> {
  const allResults = await fetchAllODataV4<V4VoteResultMinimal>(
    'KNS_PlenumVoteResult',
    {
      $filter: `VoteID ge ${minVoteId} and VoteID le ${maxVoteId}`,
      $select: 'VoteID,MkId,ResultCode',
      $top: '1000000',
    },
    label,
  );

  return allResults.filter((r) => voteIdSet.has(r.VoteID));
}

// computeV4TalliesInChunks removed — tallies are now computed in the single-pass sync pipeline
