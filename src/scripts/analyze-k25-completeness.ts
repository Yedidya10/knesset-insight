/**
 * Analyze K25 vote completeness pattern and check Open Knesset data.
 */
import { db } from '../lib/db';
import { memberVotes, votes } from '../lib/db/schema';
import { eq, sql, and, desc, asc } from 'drizzle-orm';

async function main() {
  // 1. Monthly K25 vote completeness
  console.log('=== K25 vote completeness over time ===');
  const monthlyStats = await db.execute(sql`
    SELECT
      to_char(v.vote_date, 'YYYY-MM') as month,
      count(distinct v.id) as total_votes,
      avg(mv_counts.cnt)::int as avg_mv,
      min(mv_counts.cnt) as min_mv,
      max(mv_counts.cnt) as max_mv
    FROM votes v
    LEFT JOIN (
      SELECT vote_id, count(*) as cnt FROM member_votes GROUP BY vote_id
    ) mv_counts ON mv_counts.vote_id = v.id
    WHERE v.knesset_num = 25
    GROUP BY to_char(v.vote_date, 'YYYY-MM')
    ORDER BY to_char(v.vote_date, 'YYYY-MM')
  `);
  console.log('Month       | Votes | Avg MV | Min MV | Max MV');
  console.log('------------|-------|--------|--------|-------');
  for (const row of monthlyStats) {
    console.log(
      `${row.month}   | ${String(row.total_votes).padStart(5)} | ${String(row.avg_mv).padStart(6)} | ${String(row.min_mv).padStart(6)} | ${String(row.max_mv).padStart(5)}`
    );
  }

  // 2. Recent votes with low member_vote counts
  console.log('\n=== Recent votes with low member_vote counts ===');
  const recentIncomplete = await db.execute(sql`
    SELECT v.knesset_id, v.vote_date, v.title, count(mv.id) as mv_count
    FROM votes v
    LEFT JOIN member_votes mv ON mv.vote_id = v.id
    WHERE v.knesset_num = 25
    GROUP BY v.id, v.knesset_id, v.vote_date, v.title
    HAVING count(mv.id) < 50
    ORDER BY v.vote_date DESC
    LIMIT 20
  `);
  console.log('Recent votes with < 50 member_votes:');
  for (const v of recentIncomplete) {
    console.log(`  ${v.vote_date} knessetId=${v.knesset_id}: ${v.mv_count} MVs — ${(v.title as string)?.substring(0, 50)}`);
  }

  // 3. Check OData v4 directly for recent vote results count
  console.log('\n=== Direct OData v4 check for recent votes ===');
  const testVoteIds = [45854, 45850, 45800, 45000, 44000, 43000, 42000, 40000, 39000, 38000];
  for (const voteId of testVoteIds) {
    try {
      const url = `https://knesset.gov.il/OdataV4/ParliamentInfo/KNS_PlenumVoteResult?$filter=VoteID eq ${voteId}&$count=true&$top=0&$format=json`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (res.ok) {
        const data = await res.json();
        console.log(`  VoteID ${voteId}: ${data['@odata.count'] ?? data.value?.length ?? '?'} results`);
      }
    } catch (err: any) {
      console.log(`  VoteID ${voteId}: ERROR - ${err.message}`);
    }
  }

  // 4. Check Open Knesset data
  console.log('\n=== Open Knesset data check ===');
  const okPaths = [
    'votes/view_vote_mk_individual/',
    'votes/view_vote_rslts_hdr_approved/',
    'votes/vote_rslts_kmmbr_shadow/',
    'votes/vote_rslts_kmmbr_shadow_extra/',
  ];

  for (const path of okPaths) {
    try {
      const url = `https://production.oknesset.org/pipelines/data/${path}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      const text = await res.text();
      const links = text.match(/href="[^"]+"/g) || [];
      console.log(`\n${path}:`);
      for (const link of links.filter(l => !l.includes('../')).slice(0, 20)) {
        console.log(`  ${link}`);
      }
    } catch (err: any) {
      console.log(`${path}: ERROR - ${err.message}`);
    }
  }

  // 5. Try to fetch a sample CSV from Open Knesset
  console.log('\n=== Trying Open Knesset vote_rslts_kmmbr_shadow datapackage ===');
  try {
    const url = 'https://production.oknesset.org/pipelines/data/votes/vote_rslts_kmmbr_shadow/datapackage.json';
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (res.ok) {
      const pkg = await res.json();
      console.log(`Package name: ${pkg.name}`);
      console.log(`Resources: ${pkg.resources?.length}`);
      for (const r of pkg.resources || []) {
        console.log(`  - ${r.name}: ${r.path} (${r.format})`);
      }
    } else {
      console.log(`Status: ${res.status}`);
    }
  } catch (err: any) {
    console.log(`Error: ${err.message}`);
  }

  process.exit(0);
}

main().catch(console.error);
