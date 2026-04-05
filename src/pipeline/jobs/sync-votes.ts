import { eq, sql } from 'drizzle-orm';
import { db } from '../../lib/db';
import { votes, memberVotes, members } from '../../lib/db/schema';
import { fetchOData, fetchODataSince } from '../../lib/knesset/odata-client';
import { fetchOKnessetCSV } from '../../lib/knesset/oknesset-client';
import {
  fetchAllWebsiteApiVoteHeaders,
  fetchV4PlenumVotes,
  fetchV4VoteResults,
  fetchV4VoteResultsMinimal,
} from '../../lib/knesset/knesset-api-client';
import type { WebsiteApiVoteHeader, V4VoteResultMinimal } from '../../lib/knesset/knesset-api-client';
import type {
  ODataVoteHeader,
  ODataMemberVote,
  ODataV4PlenumVote,
  ODataV4PlenumVoteResult,
} from '../../lib/knesset/types';
import { transformVoteHeader, mapVoteValue, mapV4ResultCode } from '../../lib/knesset/transforms';
import { getLastSyncTime, runSyncJob, getCheckpoint, setCheckpoint, type SyncCheckpoint } from '../utils';
import { appConfig } from '../../../app.config';

const BATCH_SIZE = 500;
const HEADER_BATCH_SIZE = 200; // larger batches for header upserts (fewer round trips)
const PAGE_SIZE = 100; // OData server caps at 100 per page

const SYNC_KNESSETS = appConfig.knesset.syncKnessets;
/** Knessets where only the Knesset WebSiteApi has data (OData + CSV are empty) */
const WEBSITE_API_ONLY = new Set(appConfig.knesset.websiteApiOnlyKnessets);

/**
 * Fetch a single OData page with retry logic.
 */
async function fetchWithRetry<T>(
  entity: string,
  params: Record<string, string | number>,
  maxRetries = 3,
): Promise<T[]> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fetchOData<T>('Votes', entity, params);
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const delay = attempt * 2000;
      console.warn(`  [retry] Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return []; // unreachable
}

/**
 * Fetch all paginated OData results for a given entity + filter.
 */
async function fetchAllPaginated<T>(
  entity: string,
  filter: string,
  orderby = 'vote_date desc',
  label = '',
): Promise<T[]> {
  const results: T[] = [];
  let skip = 0;
  while (true) {
    const page = await fetchWithRetry<T>(entity, {
      $top: PAGE_SIZE,
      $skip: skip,
      $orderby: orderby,
      $filter: filter,
    });
    results.push(...page);
    if (label) {
      console.log(`  [${label}] page ${skip / PAGE_SIZE + 1}: +${page.length} (total: ${results.length})`);
    }
    if (page.length < PAGE_SIZE) break;
    skip += PAGE_SIZE;
  }
  return results;
}

/**
 * Fetch vote headers from OData v4 KNS_PlenumVote (headers only, no tallies).
 * Tallies are computed later in the single-pass pipeline.
 */
async function fetchVoteHeadersFromV4(knessetNum: number): Promise<ODataVoteHeader[]> {
  console.log(`  [v4] Fetching PlenumVote headers for Knesset ${knessetNum}...`);
  const plenumVotes = await fetchV4PlenumVotes(knessetNum);
  console.log(`  [v4] Got ${plenumVotes.length} vote headers for Knesset ${knessetNum}`);

  return plenumVotes.map((v): ODataVoteHeader => ({
    vote_id: v.Id,
    vote_date: v.VoteDateTime,
    vote_time: '',
    vote_item_dscr: [v.VoteTitle, v.VoteSubject].filter(Boolean).join(' — '),
    sess_item_nbr: v.Ordinal ?? 0,
    sess_item_id: v.ItemID ?? 0,
    total_for: 0,
    total_against: 0,
    total_abstain: 0,
    is_accepted: 0,
    vote_type: v.VoteMethodID ?? 1,
    is_elctrnc_vote: 0,
    knesset_num: knessetNum,
    session_id: String(v.SessionID ?? ''),
    session_num: 0,
  }));
}

/**
 * Sync vote headers from OData + WebSiteApi.
 * Knessets in WEBSITE_API_ONLY use the WebSiteApi, all others use OData.
 * Returns count + checkpoint with the max vote ID synced.
 */
async function syncVoteHeaders(prevCheckpoint: SyncCheckpoint | null): Promise<{ count: number; checkpoint: SyncCheckpoint }> {
  const lastSync = await getLastSyncTime('votes');

  let rawVotes: ODataVoteHeader[];
  if (lastSync) {
    // Incremental: OData for knessets it covers
    rawVotes = await fetchODataSince<ODataVoteHeader>(
      'Votes',
      'View_vote_rslts_hdr_Approved',
      lastSync,
      'vote_date',
    );
    // Also refresh v4-only knessets (they don't support incremental sync)
    const v4Knessets = [...WEBSITE_API_ONLY];
    for (const kn of v4Knessets) {
      const v4Votes = await fetchVoteHeadersFromV4(kn);
      rawVotes.push(...v4Votes);
    }
  } else {
    // Fetch current Knesset first, then backwards
    rawVotes = [];
    const odataKnessets = SYNC_KNESSETS.filter((k) => !WEBSITE_API_ONLY.has(k));
    const v4Knessets = SYNC_KNESSETS.filter((k) => WEBSITE_API_ONLY.has(k));

    // Fetch v4 knessets first (newest, e.g. K25)
    for (const kn of v4Knessets) {
      const v4Votes = await fetchVoteHeadersFromV4(kn);
      rawVotes.push(...v4Votes);
      console.log(`  [votes] OData v4 Knesset ${kn}: ${v4Votes.length} votes (running total: ${rawVotes.length})`);
    }

    // Fetch from OData
    for (const kn of odataKnessets) {
      const knVotes = await fetchAllPaginated<ODataVoteHeader>(
        'View_vote_rslts_hdr_Approved',
        `knesset_num eq ${kn}`,
        'vote_date desc',
        `votes-knesset${kn}`,
      );
      rawVotes.push(...knVotes);
      console.log(`  [votes] Knesset ${kn}: ${knVotes.length} votes (running total: ${rawVotes.length})`);
    }
  }

  // Batch upsert vote headers (deduplicate by knessetId to avoid ON CONFLICT error)
  const allRows = rawVotes.map(transformVoteHeader);
  const seen = new Set<number>();
  const rows = allRows.filter((r) => {
    if (seen.has(r.knessetId)) return false;
    seen.add(r.knessetId);
    return true;
  });
  if (rows.length !== allRows.length) {
    console.log(`  [dedup] Removed ${allRows.length - rows.length} duplicate vote IDs`);
  }
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await db
      .insert(votes)
      .values(batch)
      .onConflictDoUpdate({
        target: votes.knessetId,
        set: {
          title: sql`excluded.title`,
          voteDate: sql`excluded.vote_date`,
          voteType: sql`excluded.vote_type`,
          knessetNum: sql`excluded.knesset_num`,
          sessionId: sql`excluded.session_id`,
          sessItemId: sql`excluded.sess_item_id`,
          // Only overwrite tallies when incoming values are non-zero.
          // v4 headers carry 0 tallies (computed later in Phase 2);
          // overwriting would erase previously computed tallies.
          forCount: sql`CASE WHEN excluded.for_count > 0 THEN excluded.for_count ELSE ${votes.forCount} END`,
          againstCount: sql`CASE WHEN excluded.against_count > 0 THEN excluded.against_count ELSE ${votes.againstCount} END`,
          abstainCount: sql`CASE WHEN excluded.abstain_count > 0 THEN excluded.abstain_count ELSE ${votes.abstainCount} END`,
          isAccepted: sql`CASE WHEN excluded.for_count > 0 OR excluded.against_count > 0 THEN excluded.is_accepted ELSE ${votes.isAccepted} END`,
          updatedAt: new Date(),
        },
      });
  }

  // Build checkpoint from the max vote ID synced
  const maxVoteId = rows.reduce((max, r) => Math.max(max, r.knessetId), 0);
  const checkpoint: SyncCheckpoint = {
    lastItemId: maxVoteId,
    lastItemTimestamp: new Date().toISOString(),
    totalHeaders: rows.length,
  };

  return { count: rows.length, checkpoint };
}

/**
 * Sync individual member votes from OData (legacy) + OData v4 (K25+).
 * Processes and inserts per-knesset to be crash-resilient — if the process
 * is interrupted, previously-completed knessets are already persisted.
 * Returns count + checkpoint with the last processed state.
 */
async function syncMemberVoteRecords(prevCheckpoint: SyncCheckpoint | null): Promise<{ count: number; checkpoint: SyncCheckpoint }> {
  const lastSync = await getLastSyncTime('member_votes');

  const odataKnessets = SYNC_KNESSETS.filter((k) => !WEBSITE_API_ONLY.has(k));
  const v4Knessets = SYNC_KNESSETS.filter((k) => WEBSITE_API_ONLY.has(k));

  // Pre-load vote and member maps for FK resolution (shared by legacy + v4)
  const allVotesForFk = await db.select({ id: votes.id, knessetId: votes.knessetId }).from(votes);
  const voteMapForFk = new Map(allVotesForFk.map((v) => [v.knessetId, v.id]));
  const allMembersForFk = await db.select({ id: members.id, vipId: members.vipId, legacyVipId: members.legacyVipId }).from(members);
  // Build FK map with both v4 MkId (vipId) and legacy vip_id (legacyVipId)
  // for members where the two IDs differ. This ensures correct matching for
  // both legacy K1-K24 OData (uses legacy vip_id) and v4 K25+ (uses v4 MkId).
  const memberMapForFk = new Map<number, number>();
  for (const m of allMembersForFk) {
    if (m.vipId) memberMapForFk.set(m.vipId, m.id);
    if (m.legacyVipId && m.legacyVipId !== m.vipId) memberMapForFk.set(m.legacyVipId, m.id);
  }

  let totalInserted = 0;
  let totalUnmapped = 0;

  /** Resolve FKs and insert a batch of legacy OData member votes immediately. */
  async function resolveAndInsertLegacy(rawVotes: ODataMemberVote[], label: string): Promise<number> {
    let unmapped = 0;
    const rows = rawVotes
      .map((raw) => {
        const voteId = voteMapForFk.get(raw.vote_id);
        const memberId = memberMapForFk.get(parseInt(String(raw.kmmbr_id), 10));
        if (!voteId || !memberId) {
          if (voteId && !memberId) unmapped++;
          return null;
        }
        return { voteId, memberId, voteValue: mapVoteValue(raw.vote_result) };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (unmapped > 0) {
      console.warn(`  [${label}] ${unmapped} vote records skipped: member vipId not found`);
      totalUnmapped += unmapped;
    }

    let inserted = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      await db.insert(memberVotes).values(batch).onConflictDoNothing();
      inserted += batch.length;
      if (inserted % 5000 < BATCH_SIZE) {
        console.log(`  [${label}] DB insert progress: ${inserted}/${rows.length}`);
      }
    }
    console.log(`  [${label}] Inserted ${rows.length} member vote records`);
    return rows.length;
  }

  // ── Legacy OData knessets ──
  if (lastSync) {
    // Incremental: fetch member votes for votes updated since last sync
    const recentVotes = await db
      .select({ knessetId: votes.knessetId })
      .from(votes)
      .where(sql`${votes.updatedAt} > ${lastSync}`)
      .limit(500);

    const rawMemberVotes: ODataMemberVote[] = [];
    for (const vote of recentVotes) {
      const mvs = await fetchOData<ODataMemberVote>(
        'Votes',
        'vote_rslts_kmmbr_shadow',
        { $filter: `vote_id eq ${vote.knessetId}` },
      );
      rawMemberVotes.push(...mvs);
    }
    totalInserted += await resolveAndInsertLegacy(rawMemberVotes, 'incremental');
  } else {
    // Full sync — process and INSERT each knesset immediately (crash-resilient)
    for (const kn of odataKnessets) {
      const knVotes = await fetchAllPaginated<ODataMemberVote>(
        'vote_rslts_kmmbr_shadow',
        `knesset_num eq ${kn}`,
        'vote_id desc',
        `member_votes-knesset${kn}`,
      );
      console.log(`  [member_votes] Knesset ${kn}: ${knVotes.length} records fetched`);
      totalInserted += await resolveAndInsertLegacy(knVotes, `knesset${kn}`);
    }
  }

  // ── v4 knessets (K25+) — fetch member votes from KNS_PlenumVoteResult ──
  const v4VoteIdsForTally: number[] = [];
  if (v4Knessets.length > 0) {
    for (const kn of v4Knessets) {
      console.log(`  [member_votes] Fetching v4 vote results for Knesset ${kn}...`);
      const knVoteRows = await db
        .select({ knessetId: votes.knessetId })
        .from(votes)
        .where(sql`${votes.knessetNum} = ${kn}`);
      const voteIds = knVoteRows.map((v) => v.knessetId);
      console.log(`  [member_votes] Knesset ${kn}: ${voteIds.length} votes in DB`);

      const sorted = [...voteIds].sort((a, b) => a - b);
      const voteIdSet = new Set(voteIds);
      const CHUNK = 500;
      for (let i = 0; i < sorted.length; i += CHUNK) {
        const chunkIds = sorted.slice(i, i + CHUNK);
        const minId = chunkIds[0];
        const maxId = chunkIds[chunkIds.length - 1];
        const chunkNum = Math.floor(i / CHUNK) + 1;
        const totalChunks = Math.ceil(sorted.length / CHUNK);
        console.log(`  [member_votes] Chunk ${chunkNum}/${totalChunks}: VoteID ${minId}–${maxId}`);

        const v4Results = await fetchV4VoteResults(minId, maxId, voteIdSet, `v4-mv-chunk-${chunkNum}`);

        let chunkUnmapped = 0;
        const chunkRows: { voteId: number; memberId: number; voteValue: string }[] = [];
        for (const r of v4Results) {
          const vId = voteMapForFk.get(r.VoteID);
          const mId = memberMapForFk.get(r.MkId);
          if (vId && mId) {
            chunkRows.push({ voteId: vId, memberId: mId, voteValue: mapV4ResultCode(r.ResultCode) });
            v4VoteIdsForTally.push(vId);
          } else if (vId && !mId) {
            chunkUnmapped++;
          }
        }
        if (chunkUnmapped > 0) {
          console.warn(`  [member_votes] Chunk ${chunkNum}: ${chunkUnmapped} v4 vote records skipped: member vipId not found`);
          totalUnmapped += chunkUnmapped;
        }
        // Insert chunk immediately
        for (let j = 0; j < chunkRows.length; j += BATCH_SIZE) {
          const batch = chunkRows.slice(j, j + BATCH_SIZE);
          await db.insert(memberVotes).values(batch).onConflictDoNothing();
        }
        totalInserted += chunkRows.length;
      }
      console.log(`  [member_votes] Knesset ${kn}: v4 processing complete`);
    }
  }

  if (totalUnmapped > 0) {
    console.warn(`  [member_votes] Total: ${totalUnmapped} vote records skipped (member vipId not found)`);
  }

  // Recompute tallies for v4 votes from actual member_votes rows
  // (v4 headers are inserted with 0 tallies, so we must always recompute)
  if (v4VoteIdsForTally.length > 0) {
    const uniqueV4VoteIds = [...new Set(v4VoteIdsForTally)];
    console.log(`  [tally-recompute] Recomputing tallies for ${uniqueV4VoteIds.length} v4 votes from member_votes...`);
    for (let i = 0; i < uniqueV4VoteIds.length; i += BATCH_SIZE) {
      const batch = uniqueV4VoteIds.slice(i, i + BATCH_SIZE);
      const tallies = await db
        .select({
          voteId: memberVotes.voteId,
          voteValue: memberVotes.voteValue,
          count: sql<number>`cast(count(*) as integer)`,
        })
        .from(memberVotes)
        .where(sql`${memberVotes.voteId} IN (${sql.join(batch.map((id) => sql`${id}`), sql`, `)})`)
        .groupBy(memberVotes.voteId, memberVotes.voteValue);

      const tallyMap = new Map<number, { for: number; against: number; abstain: number }>();
      for (const row of tallies) {
        let t = tallyMap.get(row.voteId);
        if (!t) { t = { for: 0, against: 0, abstain: 0 }; tallyMap.set(row.voteId, t); }
        if (row.voteValue === 'for') t.for = row.count;
        else if (row.voteValue === 'against') t.against = row.count;
        else if (row.voteValue === 'abstain') t.abstain = row.count;
      }

      await Promise.all([...tallyMap.entries()].map(([vId, tally]) =>
        db.update(votes)
          .set({
            forCount: tally.for,
            againstCount: tally.against,
            abstainCount: tally.abstain,
            isAccepted: tally.for > tally.against,
            updatedAt: new Date(),
          })
          .where(eq(votes.id, vId))
      ));
    }
    console.log(`  [tally-recompute] Done.`);
  }

  const checkpoint: SyncCheckpoint = {
    lastItemTimestamp: new Date().toISOString(),
    totalInserted,
    totalUnmapped,
    knessetsSynced: [...odataKnessets, ...v4Knessets],
  };

  return { count: totalInserted, checkpoint };
}

/**
 * Full votes sync: headers first, then individual member votes.
 */
export async function syncVotes(): Promise<void> {
  await runSyncJob('votes', syncVoteHeaders);
  await runSyncJob('member_votes', syncMemberVoteRecords);
}

/**
 * Run ONLY the member_votes phase (skip vote headers).
 * Useful when headers are already synced and you need to resume member votes.
 */
export async function syncMemberVotesOnly(): Promise<void> {
  await runSyncJob('member_votes', syncMemberVoteRecords);
}

// ──────────────────────────────────────
// Open Knesset CSV-based sync
// ──────────────────────────────────────

interface CSVVoteHeader {
  [key: string]: string;
  id: string;
  knesset_num: string;
  session_id: string;
  sess_item_nbr: string;
  sess_item_id: string;
  sess_item_dscr: string;
  vote_item_id: string;
  vote_item_dscr: string;
  vote_date: string;
  vote_time: string;
  is_elctrnc_vote: string;
  vote_type: string;
  is_accepted: string;
  total_for: string;
  total_against: string;
  total_abstain: string;
}

interface CSVMemberVote {
  [key: string]: string;
  vote_id: string;
  kmmbr_id: string;
  kmmbr_name: string;
  vote_result: string;
  knesset_num: string;
  faction_id: string;
  faction_name: string;
  mk_individual_id: string;
}

function csvHeaderToOData(row: CSVVoteHeader): ODataVoteHeader {
  return {
    vote_id: parseInt(row.id, 10),
    knesset_num: parseInt(row.knesset_num, 10),
    session_id: row.session_id,
    sess_item_nbr: parseInt(row.sess_item_nbr, 10) || 0,
    sess_item_id: parseInt(row.sess_item_id, 10) || 0,
    vote_item_dscr: row.vote_item_dscr || '',
    vote_date: row.vote_date,
    vote_time: row.vote_time || '',
    is_elctrnc_vote: parseInt(row.is_elctrnc_vote, 10) || 0,
    vote_type: parseInt(row.vote_type, 10) || 0,
    is_accepted: parseInt(row.is_accepted, 10) || 0,
    total_for: parseInt(row.total_for, 10) || 0,
    total_against: parseInt(row.total_against, 10) || 0,
    total_abstain: parseInt(row.total_abstain, 10) || 0,
    session_num: 0,
  };
}

/**
 * Fetch vote headers from Open Knesset CSV for specified knesset numbers.
 */
async function fetchVoteHeadersFromCSV(knessetNums: number[]): Promise<ODataVoteHeader[]> {
  const knessetSet = new Set(knessetNums);
  console.log(`  [CSV] Fetching vote headers from Open Knesset CSV...`);

  const csvRows = await fetchOKnessetCSV<CSVVoteHeader>(
    'votes/view_vote_rslts_hdr_approved_extra/view_vote_rslts_hdr_approved.csv',
  );

  console.log(`  [CSV] Total rows in CSV: ${csvRows.length}`);

  const filtered = csvRows
    .filter((row) => knessetSet.has(parseInt(row.knesset_num, 10)))
    .map(csvHeaderToOData);

  console.log(`  [CSV] Filtered to knessets [${knessetNums.join(',')}]: ${filtered.length} vote headers`);
  return filtered;
}

/**
 * Fetch member votes from Open Knesset CSV for specified knesset numbers.
 */
async function fetchMemberVotesFromCSV(knessetNums: number[]): Promise<ODataMemberVote[]> {
  const knessetSet = new Set(knessetNums);
  console.log(`  [CSV] Fetching member votes from Open Knesset CSV (~99MB, this may take a while)...`);

  const csvRows = await fetchOKnessetCSV<CSVMemberVote>(
    'votes/vote_rslts_kmmbr_shadow_extra/vote_rslts_kmmbr_shadow.csv',
  );

  console.log(`  [CSV] Total rows in CSV: ${csvRows.length}`);

  const filtered = csvRows
    .filter((row) => knessetSet.has(parseInt(row.knesset_num, 10)))
    .map((row): ODataMemberVote => ({
      vote_id: parseInt(row.vote_id, 10),
      kmmbr_id: row.kmmbr_id,
      kmmbr_name: row.kmmbr_name,
      vote_result: parseInt(row.vote_result, 10),
      knesset_num: parseInt(row.knesset_num, 10),
      faction_id: parseInt(row.faction_id, 10) || 0,
      faction_name: row.faction_name || '',
    }));

  console.log(`  [CSV] Filtered to knessets [${knessetNums.join(',')}]: ${filtered.length} member votes`);
  return filtered;
}

// ──────────────────────────────────────
// Checkpoint helpers for resumable sync
// (uses DB-based checkpoints via syncLog)
// ──────────────────────────────────────

/**
 * Targeted sync for specific Knesset numbers.
 * Uses a single-pass, checkpointed approach for v4 knessets:
 *
 * Phase 1: Insert vote headers with zero tallies (fast — ~69 pages)
 * Phase 2: Single pass through member results in chunks:
 *   - Fetch minimal results ($select=VoteID,MkId,ResultCode)
 *   - Compute tallies + UPDATE vote headers
 *   - INSERT member_votes
 *   - Save checkpoint after each chunk
 *   - On restart: skip completed chunks
 */
export async function syncVotesForKnessets(knessetNums: number[]): Promise<void> {
  const v4Knessets = knessetNums.filter((k) => WEBSITE_API_ONLY.has(k));
  const odataKnessets = knessetNums.filter((k) => !WEBSITE_API_ONLY.has(k));

  // ── Phase 1: Vote Headers (fast) ──────────────────────────
  console.log(`\n=== Phase 1: Vote Headers ===`);
  let allRawVotes: ODataVoteHeader[] = [];

  for (const kn of v4Knessets) {
    const v4Votes = await fetchVoteHeadersFromV4(kn);
    allRawVotes.push(...v4Votes);
    console.log(`  [v4] Knesset ${kn}: ${v4Votes.length} votes (headers only, tallies computed in Phase 2)`);
  }

  for (const kn of odataKnessets) {
    const knVotes = await fetchAllPaginated<ODataVoteHeader>(
      'View_vote_rslts_hdr_Approved',
      `knesset_num eq ${kn}`,
      'vote_date desc',
      `votes-knesset${kn}`,
    );
    allRawVotes.push(...knVotes);
    console.log(`  [OData] Knesset ${kn}: ${knVotes.length} votes`);
  }

  // Deduplicate and insert headers
  const allHeaderRows = allRawVotes.map(transformVoteHeader);
  const seenIds = new Set<number>();
  const headerRows = allHeaderRows.filter((r) => {
    if (seenIds.has(r.knessetId)) return false;
    seenIds.add(r.knessetId);
    return true;
  });
  if (headerRows.length !== allHeaderRows.length) {
    console.log(`  [dedup] Removed ${allHeaderRows.length - headerRows.length} duplicate vote IDs`);
  }

  for (let i = 0; i < headerRows.length; i += HEADER_BATCH_SIZE) {
    const batch = headerRows.slice(i, i + HEADER_BATCH_SIZE);
    await db.insert(votes).values(batch).onConflictDoUpdate({
      target: votes.knessetId,
      set: {
        title: sql`excluded.title`,
        voteDate: sql`excluded.vote_date`,
        voteType: sql`excluded.vote_type`,
        knessetNum: sql`excluded.knesset_num`,
        sessionId: sql`excluded.session_id`,
        sessItemId: sql`excluded.sess_item_id`,
        updatedAt: new Date(),
      },
    });
    const done = Math.min(i + HEADER_BATCH_SIZE, headerRows.length);
    console.log(`  [DB] Upserted ${done}/${headerRows.length} vote headers`);
  }
  console.log(`  Phase 1 done: ${headerRows.length} vote headers upserted\n`);

  // ── Phase 2: Single-pass tallies + member votes (resumable) ──
  console.log(`=== Phase 2: Tallies + Member Votes (single pass, resumable) ===`);

  // Pre-load FK maps
  const allVotesDb = await db.select({ id: votes.id, knessetId: votes.knessetId }).from(votes);
  const voteMap = new Map(allVotesDb.map((v) => [v.knessetId, v.id]));
  const allMembersDb = await db.select({ id: members.id, vipId: members.vipId, legacyVipId: members.legacyVipId }).from(members);
  // Map both vipId (v4 MkId) and legacyVipId for FK resolution
  const memberMap = new Map<number, number>();
  for (const m of allMembersDb) {
    if (m.vipId) memberMap.set(m.vipId, m.id);
    if (m.legacyVipId && m.legacyVipId !== m.vipId) memberMap.set(m.legacyVipId, m.id);
  }

  for (const kn of v4Knessets) {
    const checkpointKey = `v4-k${kn}`;
    const prevChkpt = await getCheckpoint(checkpointKey);
    const resumeFromId = (prevChkpt?.lastItemId as number) ?? null;
    if (resumeFromId) {
      console.log(`  [checkpoint] Resuming Knesset ${kn} from VoteID > ${resumeFromId}`);
    }

    // Get sorted vote IDs for this knesset
    const knVoteRows = await db
      .select({ knessetId: votes.knessetId })
      .from(votes)
      .where(sql`${votes.knessetNum} = ${kn}`);
    const voteIds = knVoteRows.map((v) => v.knessetId).sort((a, b) => a - b);
    const voteIdSet = new Set(voteIds);

    const CHUNK = 20; // 20 vote IDs per chunk → ~1.4K results → ~14 pages
    const totalChunks = Math.ceil(voteIds.length / CHUNK);
    let skipped = 0;
    let processedResults = 0;
    let processedMemberVotes = 0;

    for (let i = 0; i < voteIds.length; i += CHUNK) {
      const chunkIds = voteIds.slice(i, i + CHUNK);
      const minId = chunkIds[0];
      const maxId = chunkIds[chunkIds.length - 1];
      const chunkNum = Math.floor(i / CHUNK) + 1;

      // Skip already-processed chunks
      if (resumeFromId && maxId <= resumeFromId) {
        skipped++;
        continue;
      }

      console.log(`  [chunk ${chunkNum}/${totalChunks}] VoteID ${minId}–${maxId} (${chunkIds.length} votes)`);

      // Fetch minimal results ($select=VoteID,MkId,ResultCode)
      const results = await fetchV4VoteResultsMinimal(
        minId, maxId, voteIdSet,
        `chunk-${chunkNum}`,
      );
      processedResults += results.length;

      // Resolve FKs first — only resolved rows count toward tallies
      const mvRows: { voteId: number; memberId: number; voteValue: string; voteKnessetId: number }[] = [];
      let unresolvedCount = 0;
      for (const r of results) {
        const vId = voteMap.get(r.VoteID);
        const mId = memberMap.get(r.MkId);
        if (vId && mId) {
          mvRows.push({ voteId: vId, memberId: mId, voteValue: mapV4ResultCode(r.ResultCode), voteKnessetId: r.VoteID });
        } else {
          unresolvedCount++;
        }
      }
      if (unresolvedCount > 0) {
        console.warn(`  [chunk ${chunkNum}/${totalChunks}] ⚠ ${unresolvedCount} results skipped (unresolved MkId/VoteID)`);
      }

      // Compute tallies from resolved member votes only
      const tallyMap = new Map<number, { for: number; against: number; abstain: number }>();
      for (const mv of mvRows) {
        let tally = tallyMap.get(mv.voteKnessetId);
        if (!tally) {
          tally = { for: 0, against: 0, abstain: 0 };
          tallyMap.set(mv.voteKnessetId, tally);
        }
        if (mv.voteValue === 'for') tally.for++;
        else if (mv.voteValue === 'against') tally.against++;
        else if (mv.voteValue === 'abstain') tally.abstain++;
      }

      // UPDATE vote headers with tallies (batched via Promise.all)
      const tallyUpdates = [...tallyMap.entries()];
      for (let t = 0; t < tallyUpdates.length; t += 20) {
        const batch = tallyUpdates.slice(t, t + 20);
        await Promise.all(batch.map(([voteKnessetId, tally]) =>
          db.update(votes)
            .set({
              forCount: tally.for,
              againstCount: tally.against,
              abstainCount: tally.abstain,
              isAccepted: tally.for > tally.against,
              updatedAt: new Date(),
            })
            .where(eq(votes.knessetId, voteKnessetId))
        ));
      }

      // INSERT member votes
      const mvInsertRows = mvRows.map(({ voteId, memberId, voteValue }) => ({ voteId, memberId, voteValue }));
      for (let j = 0; j < mvInsertRows.length; j += BATCH_SIZE) {
        const batch = mvInsertRows.slice(j, j + BATCH_SIZE);
        await db.insert(memberVotes).values(batch).onConflictDoNothing();
      }
      processedMemberVotes += mvInsertRows.length;

      // Save checkpoint
      await setCheckpoint(checkpointKey, { lastItemId: maxId });
      console.log(`  [chunk ${chunkNum}/${totalChunks}] ✓ ${results.length} results → ${tallyMap.size} tallies, ${mvInsertRows.length} member votes`);
    }

    if (skipped > 0) {
      console.log(`  [checkpoint] Skipped ${skipped} already-processed chunks`);
    }
    console.log(`  Knesset ${kn} done: ${processedResults} results, ${processedMemberVotes} member votes`);
    // Clear checkpoint after successful completion
    await setCheckpoint(checkpointKey, {});
  }

  // Legacy OData knessets — member votes
  if (odataKnessets.length > 0) {
    console.log(`\n=== Phase 2b: Legacy OData Member Votes ===`);
    let allRawMemberVotes: ODataMemberVote[] = [];
    for (const kn of odataKnessets) {
      const knMemberVotes = await fetchAllPaginated<ODataMemberVote>(
        'vote_rslts_kmmbr_shadow',
        `knesset_num eq ${kn}`,
        'vote_id desc',
        `member_votes-knesset${kn}`,
      );
      allRawMemberVotes.push(...knMemberVotes);
      console.log(`  [OData] Knesset ${kn} member votes: ${knMemberVotes.length}`);
    }

    const memberVoteRows = allRawMemberVotes
      .map((raw) => {
        const vId = voteMap.get(raw.vote_id);
        const mId = memberMap.get(parseInt(String(raw.kmmbr_id), 10));
        if (!vId || !mId) return null;
        return { voteId: vId, memberId: mId, voteValue: mapVoteValue(raw.vote_result) };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    for (let i = 0; i < memberVoteRows.length; i += BATCH_SIZE) {
      const batch = memberVoteRows.slice(i, i + BATCH_SIZE);
      await db.insert(memberVotes).values(batch).onConflictDoNothing();
    }
    console.log(`  Legacy member votes synced: ${memberVoteRows.length}`);
  }

  console.log(`\nSync complete.`);
}
