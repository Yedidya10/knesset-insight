/**
 * Re-sync v4 member_votes for the 10 corrected members using proper pagination.
 * The vipIds were already updated by the previous script.
 * This script:
 * 1. Deletes existing v4 member_votes for corrected members
 * 2. Fetches ALL v4 vote results using paginated API
 * 3. Inserts the complete data
 */
import { db } from '../../lib/db';
import { votes, memberVotes, members } from '../../lib/db/schema';
import { eq, sql, and, inArray } from 'drizzle-orm';
import { mapV4ResultCode } from '../../lib/knesset/transforms';

const BATCH_SIZE = 500;

const CORRECTIONS = [
  { memberId: 1010, name: 'בנימין גנץ', newVipId: 32007 },
  { memberId: 46, name: 'ישראל כץ', newVipId: 468 },
  { memberId: 987, name: 'נעמה לזימי', newVipId: 33856 },
  { memberId: 135, name: 'אלי כהן', newVipId: 30083 },
  { memberId: 1033, name: "יואב סגלוביץ'", newVipId: 32027 },
  { memberId: 1014, name: 'יצחק פינדרוס', newVipId: 32033 },
  { memberId: 1157, name: 'צגה מלקו', newVipId: 34626 },
  { memberId: 995, name: 'יהודה גליק', newVipId: 30494 },
  { memberId: 991, name: 'יעל כהן-פארן', newVipId: 30357 },
  { memberId: 1103, name: 'מישל בוסקילה', newVipId: 34328 },
];

interface V4Result {
  VoteID: number;
  MkId: number;
  ResultCode: number;
}

/**
 * Fetch ALL v4 PlenumVoteResult for a specific MkId with proper pagination.
 */
async function fetchAllV4ForMember(
  mkId: number,
  maxRetries = 5,
): Promise<V4Result[]> {
  const allResults: V4Result[] = [];
  const baseQs = `$filter=MkId eq ${mkId}&$select=VoteID,MkId,ResultCode&$orderby=VoteID desc&$format=json`;
  let url: string | null =
    `https://knesset.gov.il/OdataV4/ParliamentInfo/KNS_PlenumVoteResult?${baseQs}`;

  let page = 0;
  while (url) {
    let data: any = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(url, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(30_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        data = await res.json();
        break;
      } catch (err: any) {
        if (attempt === maxRetries) throw err;
        const delay = Math.min(attempt * 3000, 15000);
        console.warn(
          `    [retry] Attempt ${attempt} failed: ${err.message}, retrying in ${delay}ms...`,
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    if (!data) break;

    allResults.push(...(data.value || []));
    page++;

    url = data['@odata.nextLink'] ?? null;
    if (url) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  return allResults;
}

async function main() {
  console.log('=== Re-sync v4 member_votes with proper pagination ===\n');

  // Pre-load vote FK map
  const allVotesForFk = await db
    .select({ id: votes.id, knessetId: votes.knessetId })
    .from(votes);
  const voteMapForFk = new Map(allVotesForFk.map((v) => [v.knessetId, v.id]));
  console.log(`Loaded ${voteMapForFk.size} votes for FK resolution`);

  // Get K25 vote DB IDs to identify which votes are K25
  const k25VoteIds = new Set(
    (
      await db
        .select({ id: votes.id })
        .from(votes)
        .where(eq(votes.knessetNum, 25))
    ).map((v) => v.id),
  );

  for (const { memberId, name, newVipId } of CORRECTIONS) {
    console.log(`\n── ${name} (id=${memberId}, MkId=${newVipId}) ──`);

    // Delete only K25 member_votes for this member (legacy ones are already correct)
    const existingK25 = await db.execute(sql`
      DELETE FROM member_votes 
      WHERE member_id = ${memberId} 
      AND vote_id IN (SELECT id FROM votes WHERE knesset_num = 25)
    `);
    console.log(`  Deleted existing K25 member_votes`);

    // Fetch ALL v4 results with proper pagination
    console.log(`  Fetching v4 results for MkId=${newVipId}...`);
    const v4Results = await fetchAllV4ForMember(newVipId);
    console.log(`  v4: ${v4Results.length} total vote results fetched`);

    const v4Rows = v4Results
      .map((r) => {
        const voteId = voteMapForFk.get(r.VoteID);
        if (!voteId) return null;
        return { voteId, memberId, voteValue: mapV4ResultCode(r.ResultCode) };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    let inserted = 0;
    for (let i = 0; i < v4Rows.length; i += BATCH_SIZE) {
      const batch = v4Rows.slice(i, i + BATCH_SIZE);
      await db.insert(memberVotes).values(batch).onConflictDoNothing();
      inserted += batch.length;
    }
    console.log(
      `  ✓ v4: ${inserted} member_votes inserted (${v4Results.length - v4Rows.length} skipped - no matching vote)`,
    );

    await new Promise((r) => setTimeout(r, 500));
  }

  // Final verification
  console.log('\n=== Final Verification ===');
  for (const { memberId, name } of CORRECTIONS) {
    const result = await db.execute(sql`
      SELECT 
        count(*) as total_votes,
        count(*) FILTER (WHERE v.knesset_num = 25) as k25_votes,
        count(*) FILTER (WHERE v.knesset_num < 25) as legacy_votes
      FROM member_votes mv
      JOIN votes v ON v.id = mv.vote_id
      WHERE mv.member_id = ${memberId}
    `);
    const r = result[0];
    console.log(
      `  ${name}: ${r.total_votes} total (${r.legacy_votes} legacy + ${r.k25_votes} K25)`,
    );
  }

  process.exit(0);
}

main().catch(console.error);
