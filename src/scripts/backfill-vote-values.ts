/**
 * Backfill script: Fix member_votes records where ResultCode 6 (present)
 * or 11 (voted/secret ballot) were incorrectly mapped to 'absent'.
 *
 * Fetches ResultCode 6/11 from OData in VoteID-range chunks (combined filter),
 * then batch-updates the matching DB rows.
 *
 * Usage: npx tsx src/scripts/backfill-vote-values.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

const ODATA_V4_BASE = 'https://knesset.gov.il/OdataV4/ParliamentInfo';

interface V4Row {
  VoteID: number;
  MkId: number;
  ResultCode: number;
}

async function fetchODataPage(
  url: string,
): Promise<{ value: V4Row[]; nextLink?: string }> {
  const response: Response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    throw new Error(
      `OData fetch failed: ${response.status} ${response.statusText}`,
    );
  }
  const data: { value: V4Row[]; '@odata.nextLink'?: string } =
    await response.json();
  return { value: data.value, nextLink: data['@odata.nextLink'] };
}

async function fetchChunkResults(
  minVoteId: number,
  maxVoteId: number,
): Promise<V4Row[]> {
  const filter = `VoteID ge ${minVoteId} and VoteID le ${maxVoteId} and (ResultCode eq 6 or ResultCode eq 11)`;
  const qs = `$filter=${encodeURIComponent(filter)}&$select=${encodeURIComponent('VoteID,MkId,ResultCode')}&$format=json`;
  let url: string | null = `${ODATA_V4_BASE}/KNS_PlenumVoteResult?${qs}`;

  const results: V4Row[] = [];
  while (url) {
    const page = await fetchODataPage(url);
    results.push(...page.value);
    url = page.nextLink ?? null;
    if (url) await new Promise((r) => setTimeout(r, 150));
  }
  return results;
}

async function main() {
  const { db } = await import('../lib/db');
  const { votes, members } = await import('../lib/db/schema');
  const { mapV4ResultCode } = await import('../lib/knesset/transforms');
  const { sql } = await import('drizzle-orm');

  console.log(
    '=== Backfill: Fix misclassified vote values (ResultCode 6/11 → present/voted) ===\n',
  );

  // Build lookup maps
  const knVoteRows = await db
    .select({ id: votes.id, knessetId: votes.knessetId })
    .from(votes)
    .where(sql`${votes.knessetNum} >= 25`);
  const voteMap = new Map(knVoteRows.map((v) => [v.knessetId, v.id]));
  console.log(`Found ${knVoteRows.length} v4 votes in DB`);

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

  // Sort vote IDs and chunk in groups of 200
  // Each chunk uses a combined filter: VoteID range + ResultCode 6/11
  const voteIds = knVoteRows.map((v) => v.knessetId).sort((a, b) => a - b);
  const CHUNK = 200;
  const totalChunks = Math.ceil(voteIds.length / CHUNK);

  console.log(
    `Fetching ResultCode 6/11 in ${totalChunks} chunks of ${CHUNK} vote IDs...\n`,
  );

  const allFixRows: {
    voteId: number;
    memberId: number;
    newValue: string;
  }[] = [];

  for (let i = 0; i < voteIds.length; i += CHUNK) {
    const chunkIds = voteIds.slice(i, i + CHUNK);
    const minId = chunkIds[0];
    const maxId = chunkIds[chunkIds.length - 1];
    const chunkNum = Math.floor(i / CHUNK) + 1;

    const results = await fetchChunkResults(minId, maxId);

    for (const r of results) {
      const vId = voteMap.get(r.VoteID);
      const mId = memberMap.get(r.MkId);
      if (!vId || !mId) continue;
      allFixRows.push({
        voteId: vId,
        memberId: mId,
        newValue: mapV4ResultCode(r.ResultCode),
      });
    }

    if (chunkNum % 5 === 0 || chunkNum === totalChunks) {
      console.log(
        `  chunk ${chunkNum}/${totalChunks}: ${results.length} API results, ${allFixRows.length} DB matches total`,
      );
    }

    // Small delay between chunks
    if (i + CHUNK < voteIds.length) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  console.log(`\nFound ${allFixRows.length} records to update in DB\n`);

  // Group by newValue, then batch-update using raw SQL for efficiency
  const byValue = new Map<string, { voteId: number; memberId: number }[]>();
  for (const row of allFixRows) {
    const list = byValue.get(row.newValue) ?? [];
    list.push({ voteId: row.voteId, memberId: row.memberId });
    byValue.set(row.newValue, list);
  }

  let totalUpdated = 0;
  const BATCH = 200;

  for (const [value, rows] of byValue) {
    console.log(`  Updating ${rows.length} rows to "${value}"...`);

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);

      // Build a VALUES list for (vote_id, member_id) pairs
      const pairs = batch.map((r) => `(${r.voteId}, ${r.memberId})`).join(', ');

      await db.execute(
        sql`UPDATE member_votes SET vote_value = ${value}
            WHERE (vote_id, member_id) IN (${sql.raw(pairs)})`,
      );

      totalUpdated += batch.length;
      console.log(
        `    ${Math.min(i + BATCH, rows.length)}/${rows.length} done (total: ${totalUpdated}/${allFixRows.length})`,
      );
    }
  }

  console.log(`\n=== Backfill complete ===`);
  console.log(`Total records updated: ${totalUpdated}`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
