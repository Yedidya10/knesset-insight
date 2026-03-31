import { eq, sql } from 'drizzle-orm';
import { db } from '../../lib/db';
import { votes, memberVotes, members } from '../../lib/db/schema';
import { fetchOData, fetchODataSince } from '../../lib/knesset/odata-client';
import type {
  ODataVoteHeader,
  ODataMemberVote,
} from '../../lib/knesset/types';
import { transformVoteHeader, mapVoteValue } from '../../lib/knesset/transforms';
import { getLastSyncTime, runSyncJob } from '../utils';

const BATCH_SIZE = 50;
const PAGE_SIZE = 100; // OData server caps at 100 per page

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
    const page = await fetchOData<T>('Votes', entity, {
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
 * Sync vote headers from OData.
 * On initial sync, fetches Knesset 25 (current) first then backwards.
 */
async function syncVoteHeaders(): Promise<number> {
  const lastSync = await getLastSyncTime('votes');

  let rawVotes: ODataVoteHeader[];
  if (lastSync) {
    rawVotes = await fetchODataSince<ODataVoteHeader>(
      'Votes',
      'View_vote_rslts_hdr_Approved',
      lastSync,
      'vote_date',
    );
  } else {
    // Fetch current Knesset (25) first, then backwards through 24, 23, ...
    rawVotes = [];
    const knessets = [25, 24, 23, 22, 21, 20];
    for (const kn of knessets) {
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

  // Batch upsert vote headers
  const rows = rawVotes.map(transformVoteHeader);
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
          forCount: sql`excluded.for_count`,
          againstCount: sql`excluded.against_count`,
          abstainCount: sql`excluded.abstain_count`,
          isAccepted: sql`excluded.is_accepted`,
          updatedAt: new Date(),
        },
      });
  }

  return rows.length;
}

/**
 * Sync individual member votes from OData.
 * On initial sync, fetches per-Knesset (25 first, backwards).
 */
async function syncMemberVoteRecords(): Promise<number> {
  const lastSync = await getLastSyncTime('member_votes');

  let rawMemberVotes: ODataMemberVote[];
  if (lastSync) {
    // Incremental: fetch member votes for votes updated since last sync
    const recentVotes = await db
      .select({ knessetId: votes.knessetId })
      .from(votes)
      .where(sql`${votes.updatedAt} > ${lastSync}`)
      .limit(500);

    rawMemberVotes = [];
    for (const vote of recentVotes) {
      const mvs = await fetchOData<ODataMemberVote>(
        'Votes',
        'vote_rslts_kmmbr_shadow',
        { $filter: `vote_id eq ${vote.knessetId}` },
      );
      rawMemberVotes.push(...mvs);
    }
  } else {
    // Full sync per Knesset, current first
    rawMemberVotes = [];
    const knessets = [25, 24, 23, 22, 21, 20];
    for (const kn of knessets) {
      const knVotes = await fetchAllPaginated<ODataMemberVote>(
        'vote_rslts_kmmbr_shadow',
        `knesset_num eq ${kn}`,
        'vote_id desc',
        `member_votes-knesset${kn}`,
      );
      rawMemberVotes.push(...knVotes);
      console.log(`  [member_votes] Knesset ${kn}: ${knVotes.length} records (running total: ${rawMemberVotes.length})`);
    }
  }

  // Pre-load all votes and members for FK resolution
  const allVotes = await db
    .select({ id: votes.id, knessetId: votes.knessetId })
    .from(votes);
  const voteMap = new Map(allVotes.map((v) => [v.knessetId, v.id]));

  const allMembers = await db
    .select({ id: members.id, knessetId: members.knessetId })
    .from(members);
  const memberMap = new Map(allMembers.map((m) => [m.knessetId, m.id]));

  // Prepare rows with resolved FKs
  const rows = rawMemberVotes
    .map((raw) => {
      const voteId = voteMap.get(raw.vote_id);
      const memberId = memberMap.get(parseInt(String(raw.kmmbr_id), 10));
      if (!voteId || !memberId) return null;
      return {
        voteId,
        memberId,
        voteValue: mapVoteValue(raw.vote_result),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  // Batch insert
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await db.insert(memberVotes).values(batch).onConflictDoNothing();
  }

  return rows.length;
}

/**
 * Full votes sync: headers first, then individual member votes.
 */
export async function syncVotes(): Promise<void> {
  await runSyncJob('votes', syncVoteHeaders);
  await runSyncJob('member_votes', syncMemberVoteRecords);
}
