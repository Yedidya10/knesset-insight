import { eq } from 'drizzle-orm';
import { db } from '../../lib/db';
import { votes, memberVotes, members } from '../../lib/db/schema';
import { fetchOData, fetchODataSince } from '../../lib/knesset/odata-client';
import type {
  ODataVoteHeader,
  ODataMemberVote,
} from '../../lib/knesset/types';
import { transformVoteHeader, mapVoteValue } from '../../lib/knesset/transforms';
import { getLastSyncTime, runSyncJob } from '../utils';

/**
 * Sync vote headers from OData.
 */
async function syncVoteHeaders(): Promise<number> {
  const lastSync = await getLastSyncTime('votes');

  let rawVotes: ODataVoteHeader[];
  if (lastSync) {
    rawVotes = await fetchODataSince<ODataVoteHeader>(
      'Votes',
      'View_vote_rslts_hdr_Approved',
      lastSync,
      'vote_date_str',
    );
  } else {
    // Initial full sync — fetch all
    rawVotes = [];
    let skip = 0;
    const pageSize = 1000;
    while (true) {
      const page = await fetchOData<ODataVoteHeader>(
        'Votes',
        'View_vote_rslts_hdr_Approved',
        {
          $top: pageSize,
          $skip: skip,
          $orderby: 'vote_date_str desc',
        },
      );
      rawVotes.push(...page);
      if (page.length < pageSize) break;
      skip += pageSize;
    }
  }

  let count = 0;
  for (const raw of rawVotes) {
    const transformed = transformVoteHeader(raw);
    await db
      .insert(votes)
      .values(transformed)
      .onConflictDoUpdate({
        target: votes.knessetId,
        set: {
          title: transformed.title,
          voteDate: transformed.voteDate,
          voteType: transformed.voteType,
          forCount: transformed.forCount,
          againstCount: transformed.againstCount,
          abstainCount: transformed.abstainCount,
          isAccepted: transformed.isAccepted,
          updatedAt: new Date(),
        },
      });
    count++;
  }

  return count;
}

/**
 * Sync individual member votes for recently synced vote headers.
 */
async function syncMemberVoteRecords(): Promise<number> {
  const lastSync = await getLastSyncTime('member_votes');

  // Fetch member votes from OData
  let rawMemberVotes: ODataMemberVote[];
  if (lastSync) {
    // For incremental: get the vote IDs that were recently synced
    // and fetch their member votes
    const recentVotes = await db
      .select({ knessetId: votes.knessetId })
      .from(votes)
      .where(eq(votes.updatedAt, votes.updatedAt)) // placeholder for recent
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
    // Full sync — fetch all member votes page by page
    rawMemberVotes = [];
    let skip = 0;
    const pageSize = 1000;
    while (true) {
      const page = await fetchOData<ODataMemberVote>(
        'Votes',
        'vote_rslts_kmmbr_shadow',
        { $top: pageSize, $skip: skip },
      );
      rawMemberVotes.push(...page);
      if (page.length < pageSize) break;
      skip += pageSize;
    }
  }

  let count = 0;
  for (const raw of rawMemberVotes) {
    // Resolve foreign keys
    const voteRows = await db
      .select({ id: votes.id })
      .from(votes)
      .where(eq(votes.knessetId, raw.vote_id))
      .limit(1);

    const memberRows = await db
      .select({ id: members.id })
      .from(members)
      .where(eq(members.knessetId, raw.kmmbr_id))
      .limit(1);

    const voteId = voteRows[0]?.id;
    const memberId = memberRows[0]?.id;
    if (!voteId || !memberId) continue;

    await db
      .insert(memberVotes)
      .values({
        voteId,
        memberId,
        voteValue: mapVoteValue(raw.vote_result),
      })
      .onConflictDoNothing();
    count++;
  }

  return count;
}

/**
 * Full votes sync: headers first, then individual member votes.
 */
export async function syncVotes(): Promise<void> {
  await runSyncJob('votes', syncVoteHeaders);
  await runSyncJob('member_votes', syncMemberVoteRecords);
}
