/**
 * Backfill script: Fix member_votes records where ResultCode 6 (present)
 * or 11 (voted/secret ballot) were incorrectly mapped to 'absent'.
 *
 * This re-fetches v4 vote results and updates only the misclassified rows.
 *
 * Usage: npx tsx src/scripts/backfill-vote-values.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { db } = await import('../lib/db');
  const { votes, memberVotes, members } = await import('../lib/db/schema');
  const { fetchV4VoteResultsMinimal } =
    await import('../lib/knesset/knesset-api-client');
  const { mapV4ResultCode } = await import('../lib/knesset/transforms');
  const { eq, sql, and } = await import('drizzle-orm');

  console.log(
    '=== Backfill: Fix misclassified vote values (ResultCode 6/11 → present/voted) ===\n',
  );

  // Get all v4 knesset votes (K25+)
  const knVoteRows = await db
    .select({ id: votes.id, knessetId: votes.knessetId })
    .from(votes)
    .where(sql`${votes.knessetNum} >= 25`);

  console.log(`Found ${knVoteRows.length} v4 votes in DB`);

  // Build FK maps
  const voteMap = new Map(knVoteRows.map((v) => [v.knessetId, v.id]));

  const allMembers = await db
    .select({
      id: members.id,
      vipId: members.vipId,
      legacyVipId: members.legacyVipId,
    })
    .from(members);
  const memberMap = new Map<number, number>();
  for (const m of allMembers) {
    if (m.vipId) memberMap.set(m.vipId, m.id);
    if (m.legacyVipId && m.legacyVipId !== m.vipId)
      memberMap.set(m.legacyVipId, m.id);
  }

  const voteIds = knVoteRows.map((v) => v.knessetId).sort((a, b) => a - b);
  const voteIdSet = new Set(voteIds);

  let totalUpdated = 0;
  let totalPresent = 0;
  let totalVoted = 0;
  const CHUNK = 20;
  const totalChunks = Math.ceil(voteIds.length / CHUNK);

  for (let i = 0; i < voteIds.length; i += CHUNK) {
    const chunkIds = voteIds.slice(i, i + CHUNK);
    const minId = chunkIds[0];
    const maxId = chunkIds[chunkIds.length - 1];
    const chunkNum = Math.floor(i / CHUNK) + 1;

    const results = await fetchV4VoteResultsMinimal(
      minId,
      maxId,
      voteIdSet,
      `backfill-chunk-${chunkNum}`,
    );

    // Find results with code 6 or 11 that were wrongly mapped
    const fixRows: { voteId: number; memberId: number; newValue: string }[] =
      [];
    for (const r of results) {
      if (r.ResultCode !== 6 && r.ResultCode !== 11) continue;

      const vId = voteMap.get(r.VoteID);
      const mId = memberMap.get(r.MkId);
      if (!vId || !mId) continue;

      fixRows.push({
        voteId: vId,
        memberId: mId,
        newValue: mapV4ResultCode(r.ResultCode),
      });
    }

    // Batch update
    for (const row of fixRows) {
      await db
        .update(memberVotes)
        .set({ voteValue: row.newValue })
        .where(
          and(
            eq(memberVotes.voteId, row.voteId),
            eq(memberVotes.memberId, row.memberId),
          ),
        );
      if (row.newValue === 'present') totalPresent++;
      if (row.newValue === 'voted') totalVoted++;
    }

    totalUpdated += fixRows.length;

    if (chunkNum % 50 === 0 || chunkNum === totalChunks) {
      console.log(
        `  [${chunkNum}/${totalChunks}] Updated ${totalUpdated} records so far (present: ${totalPresent}, voted: ${totalVoted})`,
      );
    }
  }

  console.log(`\n=== Backfill complete ===`);
  console.log(`Total records updated: ${totalUpdated}`);
  console.log(`  - "present" (code 6): ${totalPresent}`);
  console.log(`  - "voted" (code 11): ${totalVoted}`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
