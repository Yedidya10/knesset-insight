/**
 * Backfill member_votes for vote headers that are missing per-member records.
 *
 * Use case: 71 K25 vote headers were synced without member_votes
 * (see docs/votes-k25-discrepancy-analysis.md §6). This script fetches
 * V4 PlenumVoteResult records for those exact VoteIDs, inserts the
 * member rows, and recomputes tallies on the vote headers.
 *
 * Usage: npx tsx src/scripts/backfill-missing-member-votes.ts [knessetNum]
 *   (defaults to 25 if no argument is passed)
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const knessetNum = Number(process.argv[2] ?? 25);

  const { db } = await import('../../lib/db');
  const { votes, memberVotes, members } = await import('../../lib/db/schema');
  const { sql, eq } = await import('drizzle-orm');
  const { fetchV4VoteResults } =
    await import('../../lib/knesset/knesset-api-client');
  const { mapV4ResultCode } = await import('../../lib/knesset/transforms');

  console.log(
    `\n=== BACKFILL MISSING member_votes — Knesset ${knessetNum} ===\n`,
  );

  // 1. Find vote IDs for the target knesset that have NO member_votes rows.
  const missing = await db.execute<{ id: string; knesset_id: string }>(sql`
    SELECT v.id::text, v.knesset_id::text
    FROM votes v
    WHERE v.knesset_num = ${knessetNum}
      AND NOT EXISTS (
        SELECT 1 FROM member_votes mv WHERE mv.vote_id = v.id
      )
    ORDER BY v.knesset_id
  `);
  console.log(`Found ${missing.length} vote headers without member_votes.`);
  if (missing.length === 0) {
    console.log('Nothing to backfill.');
    process.exit(0);
  }

  const voteIds = missing.map((r) => Number(r.knesset_id));
  const voteMap = new Map(
    missing.map((r) => [Number(r.knesset_id), Number(r.id)]),
  );
  const voteIdSet = new Set(voteIds);

  // 2. Load member FK map (v4 MkId + legacy vip_id).
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

  // 3. Fetch v4 results for the missing vote IDs in chunks.
  const sorted = [...voteIds].sort((a, b) => a - b);
  const CHUNK = 50; // small chunks — few VoteIDs, tight range keeps API happy
  let inserted = 0;
  let unresolved = 0;
  const affectedInternalIds = new Set<number>();

  for (let i = 0; i < sorted.length; i += CHUNK) {
    const chunkIds = sorted.slice(i, i + CHUNK);
    const minId = chunkIds[0];
    const maxId = chunkIds[chunkIds.length - 1];
    const chunkNum = Math.floor(i / CHUNK) + 1;
    const total = Math.ceil(sorted.length / CHUNK);
    console.log(
      `  [chunk ${chunkNum}/${total}] VoteID ${minId}–${maxId} (${chunkIds.length} votes)`,
    );

    const results = await fetchV4VoteResults(
      minId,
      maxId,
      voteIdSet,
      `backfill-${chunkNum}`,
    );

    const rows: { voteId: number; memberId: number; voteValue: string }[] = [];
    for (const r of results) {
      const vId = voteMap.get(r.VoteID);
      const mId = memberMap.get(r.MkId);
      if (vId && mId) {
        rows.push({
          voteId: vId,
          memberId: mId,
          voteValue: mapV4ResultCode(r.ResultCode),
        });
        affectedInternalIds.add(vId);
      } else if (vId && !mId) {
        unresolved++;
      }
    }

    if (rows.length === 0) {
      console.log(
        `  [chunk ${chunkNum}/${total}] no resolvable results (${results.length} raw)`,
      );
      continue;
    }

    const BATCH = 500;
    for (let j = 0; j < rows.length; j += BATCH) {
      const batch = rows.slice(j, j + BATCH);
      await db.insert(memberVotes).values(batch).onConflictDoNothing();
    }
    inserted += rows.length;
    console.log(
      `  [chunk ${chunkNum}/${total}] inserted ${rows.length} member_votes`,
    );
  }

  console.log(
    `\nTotal member_votes inserted: ${inserted} (unresolved MkIds: ${unresolved})`,
  );

  // 4. Recompute tallies for affected vote headers.
  if (affectedInternalIds.size > 0) {
    console.log(
      `\nRecomputing tallies for ${affectedInternalIds.size} vote headers...`,
    );
    const ids = [...affectedInternalIds];
    const BATCH = 500;
    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = ids.slice(i, i + BATCH);
      const tallies = await db
        .select({
          voteId: memberVotes.voteId,
          voteValue: memberVotes.voteValue,
          count: sql<number>`cast(count(*) as integer)`,
        })
        .from(memberVotes)
        .where(
          sql`${memberVotes.voteId} IN (${sql.join(
            batch.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        )
        .groupBy(memberVotes.voteId, memberVotes.voteValue);

      const tallyMap = new Map<
        number,
        { for: number; against: number; abstain: number }
      >();
      for (const row of tallies) {
        let t = tallyMap.get(row.voteId);
        if (!t) {
          t = { for: 0, against: 0, abstain: 0 };
          tallyMap.set(row.voteId, t);
        }
        if (row.voteValue === 'for') t.for = row.count;
        else if (row.voteValue === 'against') t.against = row.count;
        else if (row.voteValue === 'abstain') t.abstain = row.count;
      }

      await Promise.all(
        [...tallyMap.entries()].map(([vId, tally]) =>
          db
            .update(votes)
            .set({
              forCount: tally.for,
              againstCount: tally.against,
              abstainCount: tally.abstain,
              isAccepted: tally.for > tally.against,
              updatedAt: new Date(),
            })
            .where(eq(votes.id, vId)),
        ),
      );
    }
    console.log('Tallies recomputed.');
  }

  console.log('\n=== DONE ===\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
