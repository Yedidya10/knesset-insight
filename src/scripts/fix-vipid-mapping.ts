/**
 * Fix incorrect vipId mappings and re-sync member_votes for affected members.
 *
 * Root cause: Name-based vipId mapping (from View_Vote_MK_Individual) was ambiguous
 * for members with common names (e.g. two "ישראל כץ"), and some newer MKs have
 * different IDs in the v4 OData vs. legacy data.
 *
 * This script:
 * 1. Corrects vipId for 10 affected members
 * 2. Deletes their existing (wrong) member_votes
 * 3. Re-syncs their votes from legacy (K16–K24) + v4 (K25)
 * 4. Recomputes vote tallies for affected K25 votes
 */
import { db } from '../lib/db';
import { votes, memberVotes, members } from '../lib/db/schema';
import { eq, sql, and, inArray } from 'drizzle-orm';
import { fetchV4VoteResultsMinimal } from '../lib/knesset/knesset-api-client';
import { mapVoteValue, mapV4ResultCode } from '../lib/knesset/transforms';
import { fetchOData } from '../lib/knesset/odata-client';
import type { ODataMemberVote } from '../lib/knesset/types';
import { appConfig } from '../../app.config';

const BATCH_SIZE = 500;
const PAGE_SIZE = 100;

const CORRECTIONS: { memberId: number; name: string; oldVipId: number | null; newVipId: number }[] = [
  { memberId: 1010, name: 'בנימין גנץ',       oldVipId: null,  newVipId: 32007 },
  { memberId: 46,   name: 'ישראל כץ',         oldVipId: 3260,  newVipId: 468 },
  { memberId: 987,  name: 'נעמה לזימי',       oldVipId: 30105, newVipId: 33856 },
  { memberId: 135,  name: 'אלי כהן',          oldVipId: 755,   newVipId: 30083 },
  { memberId: 1033, name: 'יואב סגלוביץ\'',   oldVipId: null,  newVipId: 32027 },
  { memberId: 1014, name: 'יצחק פינדרוס',     oldVipId: null,  newVipId: 32033 },
  { memberId: 1157, name: 'צגה מלקו',         oldVipId: null,  newVipId: 34626 },
  { memberId: 995,  name: 'יהודה גליק',       oldVipId: null,  newVipId: 30494 },
  { memberId: 991,  name: 'יעל כהן-פארן',     oldVipId: null,  newVipId: 30357 },
  { memberId: 1103, name: 'מישל בוסקילה',     oldVipId: 32681, newVipId: 34328 },
];

async function fetchLegacyVotesForMember(vipId: number): Promise<ODataMemberVote[]> {
  const paddedId = String(vipId).padStart(9, '0');
  const results: ODataMemberVote[] = [];
  let skip = 0;
  console.log(`    Fetching legacy votes for vipId=${paddedId}...`);

  while (true) {
    let page: ODataMemberVote[];
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        page = await fetchOData<ODataMemberVote>('Votes', 'vote_rslts_kmmbr_shadow', {
          $filter: `kmmbr_id eq '${paddedId}'`,
          $top: PAGE_SIZE,
          $skip: skip,
          $orderby: 'vote_id desc',
        });
        break;
      } catch (err) {
        if (attempt === 3) throw err;
        await new Promise(r => setTimeout(r, attempt * 2000));
      }
    }
    results.push(...page!);
    if (page!.length < PAGE_SIZE) break;
    skip += PAGE_SIZE;
  }

  console.log(`    Legacy: ${results.length} vote records fetched`);
  return results;
}

async function main() {
  console.log('=== Fix vipId mappings and re-sync member_votes ===\n');

  // Pre-load vote FK map
  const allVotesForFk = await db.select({ id: votes.id, knessetId: votes.knessetId }).from(votes);
  const voteMapForFk = new Map(allVotesForFk.map(v => [v.knessetId, v.id]));
  console.log(`Loaded ${voteMapForFk.size} votes for FK resolution`);

  // Load K25 vote IDs for v4 querying
  const k25VoteRows = await db.select({ knessetId: votes.knessetId })
    .from(votes)
    .where(eq(votes.knessetNum, 25));
  const k25VoteIds = k25VoteRows.map(v => v.knessetId).sort((a, b) => a - b);
  const k25VoteIdSet = new Set(k25VoteIds);
  console.log(`K25 votes in DB: ${k25VoteIds.length}`);

  for (const correction of CORRECTIONS) {
    const { memberId, name, oldVipId, newVipId } = correction;
    console.log(`\n── ${name} (id=${memberId}): ${oldVipId ?? 'null'} → ${newVipId} ──`);

    // Step 1: Update vipId
    await db.update(members).set({ vipId: newVipId }).where(eq(members.id, memberId));
    console.log(`  ✓ vipId updated to ${newVipId}`);

    // Step 2: Delete existing member_votes for this member
    const deleted = await db.delete(memberVotes).where(eq(memberVotes.memberId, memberId));
    console.log(`  ✓ Deleted existing member_votes`);

    // Step 3a: Fetch and insert legacy votes (K16–K24)
    try {
      const legacyVotes = await fetchLegacyVotesForMember(newVipId);
      const legacyRows = legacyVotes
        .map(raw => {
          const voteId = voteMapForFk.get(raw.vote_id);
          if (!voteId) return null;
          return { voteId, memberId, voteValue: mapVoteValue(raw.vote_result) };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      let legacyInserted = 0;
      for (let i = 0; i < legacyRows.length; i += BATCH_SIZE) {
        const batch = legacyRows.slice(i, i + BATCH_SIZE);
        await db.insert(memberVotes).values(batch).onConflictDoNothing();
        legacyInserted += batch.length;
      }
      console.log(`  ✓ Legacy: ${legacyInserted} member_votes inserted`);
    } catch (err: any) {
      console.warn(`  ⚠ Legacy fetch failed: ${err.message}`);
    }

    // Step 3b: Fetch and insert v4 votes (K25)
    try {
      console.log(`    Fetching v4 votes for MkId=${newVipId}...`);
      // Query v4 by MkId — fetch all results for this member
      const url = `https://knesset.gov.il/OdataV4/ParliamentInfo/KNS_PlenumVoteResult?$filter=MkId eq ${newVipId}&$select=VoteID,MkId,ResultCode&$format=json&$top=100000`;
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      const data = await res.json();
      const v4Results: { VoteID: number; MkId: number; ResultCode: number }[] = data.value || [];
      console.log(`    v4: ${v4Results.length} vote results fetched`);

      const v4Rows = v4Results
        .map(r => {
          const voteId = voteMapForFk.get(r.VoteID);
          if (!voteId) return null;
          return { voteId, memberId, voteValue: mapV4ResultCode(r.ResultCode) };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      let v4Inserted = 0;
      for (let i = 0; i < v4Rows.length; i += BATCH_SIZE) {
        const batch = v4Rows.slice(i, i + BATCH_SIZE);
        await db.insert(memberVotes).values(batch).onConflictDoNothing();
        v4Inserted += batch.length;
      }
      console.log(`  ✓ v4: ${v4Inserted} member_votes inserted`);
    } catch (err: any) {
      console.warn(`  ⚠ v4 fetch failed: ${err.message}`);
    }

    // Brief pause between members
    await new Promise(r => setTimeout(r, 500));
  }

  // Step 4: Recompute tallies for v4 votes that were affected
  console.log('\n── Recomputing K25 vote tallies ──');
  const affectedVoteIds = await db.select({ voteId: memberVotes.voteId })
    .from(memberVotes)
    .where(inArray(memberVotes.memberId, CORRECTIONS.map(c => c.memberId)))
    .groupBy(memberVotes.voteId);
  
  const v4AffectedIds = affectedVoteIds
    .map(r => r.voteId)
    .filter(id => id !== null);

  if (v4AffectedIds.length > 0) {
    for (let i = 0; i < v4AffectedIds.length; i += BATCH_SIZE) {
      const batch = v4AffectedIds.slice(i, i + BATCH_SIZE);
      const tallies = await db
        .select({
          voteId: memberVotes.voteId,
          forCount: sql<number>`count(*) filter (where ${memberVotes.voteValue} = 'for')`,
          againstCount: sql<number>`count(*) filter (where ${memberVotes.voteValue} = 'against')`,
          abstainCount: sql<number>`count(*) filter (where ${memberVotes.voteValue} = 'abstain')`,
        })
        .from(memberVotes)
        .where(inArray(memberVotes.voteId, batch))
        .groupBy(memberVotes.voteId);

      for (const t of tallies) {
        if (!t.voteId) continue;
        await db.update(votes).set({
          forCount: t.forCount,
          againstCount: t.againstCount,
          abstainCount: t.abstainCount,
          isAccepted: t.forCount > t.againstCount,
          updatedAt: new Date(),
        }).where(eq(votes.id, t.voteId));
      }
    }
    console.log(`✓ Recomputed tallies for ${v4AffectedIds.length} votes`);
  }

  // Step 5: Verify
  console.log('\n=== Verification ===');
  for (const correction of CORRECTIONS) {
    const voteCount = await db.select({ count: sql<number>`count(*)` })
      .from(memberVotes)
      .where(eq(memberVotes.memberId, correction.memberId));
    console.log(`  ${correction.name}: ${voteCount[0].count} votes`);
  }

  process.exit(0);
}

main().catch(console.error);
