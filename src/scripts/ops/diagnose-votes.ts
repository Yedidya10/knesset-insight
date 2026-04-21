/**
 * Diagnostic script: Votes K25 data analysis
 * Usage: npx tsx src/scripts/diagnose-votes.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { db } = await import('../../lib/db');
  const { votes, memberVotes } = await import('../../lib/db/schema');
  const { sql, eq, isNull, isNotNull, and } = await import('drizzle-orm');

  console.log('\n=== VOTES K25 — DIAGNOSTIC REPORT ===\n');

  // 1. Total votes per knesset
  const totals = await db.execute<{ knesset_num: number; total: string }>(sql`
    SELECT knesset_num, count(*)::text AS total
    FROM votes
    GROUP BY knesset_num
    ORDER BY knesset_num DESC
  `);
  console.log('--- 1. Total votes per Knesset ---');
  for (const row of totals) {
    console.log(`  Knesset ${row.knesset_num}: ${row.total}`);
  }

  // 2. K25: linked vs unlinked
  const k25Linked = await db.execute<{ linked: string; unlinked: string }>(sql`
    SELECT
      count(*) FILTER (WHERE bill_id IS NOT NULL)::text AS linked,
      count(*) FILTER (WHERE bill_id IS NULL)::text AS unlinked
    FROM votes
    WHERE knesset_num = 25
  `);
  console.log('\n--- 2. K25: bill_id linking status ---');
  console.log(`  With bill_id (linked):    ${k25Linked[0].linked}`);
  console.log(`  Without bill_id (unlinked): ${k25Linked[0].unlinked}`);

  // 3. K25: isReservation breakdown
  const k25Reservation = await db.execute<{
    is_reservation: boolean;
    total: string;
  }>(sql`
    SELECT is_reservation, count(*)::text AS total
    FROM votes
    WHERE knesset_num = 25
    GROUP BY is_reservation
  `);
  console.log('\n--- 3. K25: isReservation breakdown ---');
  for (const row of k25Reservation) {
    console.log(`  is_reservation=${row.is_reservation}: ${row.total}`);
  }

  // 4. K25: voteType distribution
  const k25VoteType = await db.execute<{ vote_type: string; cnt: string }>(sql`
    SELECT vote_type, count(*) AS cnt
    FROM votes
    WHERE knesset_num = 25
    GROUP BY vote_type
    ORDER BY cnt DESC
  `);
  console.log('\n--- 4. K25: voteType distribution ---');
  for (const row of k25VoteType) {
    console.log(`  voteType="${row.vote_type}": ${row.cnt}`);
  }

  // 5. K25: billStage breakdown (for linked votes)
  const k25BillStage = await db.execute<{
    bill_stage: number | null;
    cnt: string;
  }>(sql`
    SELECT bill_stage, count(*) AS cnt
    FROM votes
    WHERE knesset_num = 25 AND bill_id IS NOT NULL
    GROUP BY bill_stage
    ORDER BY bill_stage NULLS LAST
  `);
  console.log('\n--- 5. K25: billStage breakdown (linked votes only) ---');
  for (const row of k25BillStage) {
    console.log(`  billStage=${row.bill_stage ?? 'NULL'}: ${row.cnt}`);
  }

  // 6. K25 unlinked votes — title samples
  const k25Unlinked = await db.execute<{
    id: number;
    title: string;
    vote_date: string;
  }>(sql`
    SELECT id, title, vote_date::text
    FROM votes
    WHERE knesset_num = 25 AND bill_id IS NULL
    ORDER BY vote_date DESC
    LIMIT 20
  `);
  console.log('\n--- 6. K25 unlinked votes — sample (top 20 by date) ---');
  for (const row of k25Unlinked) {
    console.log(`  [${row.vote_date?.slice(0, 10)}] ${row.title}`);
  }

  // 7. K25 unlinked — by title pattern
  const k25UnlinkedPatterns = await db.execute<{
    pattern: string;
    cnt: string;
  }>(sql`
    SELECT
      CASE
        WHEN title ILIKE '%הסתייגות%' OR title ILIKE '%הסתייג%' THEN 'הסתייגות'
        WHEN title ILIKE '%אי-אמון%' OR title ILIKE '%אי אמון%' THEN 'אי-אמון'
        WHEN title ILIKE '%סדר היום%' THEN 'סדר היום'
        WHEN title ILIKE '%חוק%' THEN 'כולל "חוק"'
        WHEN title ILIKE '%תקנות%' THEN 'תקנות'
        WHEN title ILIKE '%הצעת%' THEN 'הצעת X'
        ELSE 'אחר'
      END AS pattern,
      count(*) AS cnt
    FROM votes
    WHERE knesset_num = 25 AND bill_id IS NULL
    GROUP BY 1
    ORDER BY cnt DESC
  `);
  console.log('\n--- 7. K25 unlinked — title pattern breakdown ---');
  for (const row of k25UnlinkedPatterns) {
    console.log(`  ${row.pattern}: ${row.cnt}`);
  }

  // 8. member_votes coverage for K25
  const k25MvCoverage = await db.execute<{ has_mv: string; no_mv: string }>(sql`
    SELECT
      count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM member_votes mv WHERE mv.vote_id = votes.id
      ))::text AS has_mv,
      count(*) FILTER (WHERE NOT EXISTS (
        SELECT 1 FROM member_votes mv WHERE mv.vote_id = votes.id
      ))::text AS no_mv
    FROM votes
    WHERE knesset_num = 25
  `);
  console.log('\n--- 8. K25: member_votes coverage ---');
  console.log(`  Votes with member_votes: ${k25MvCoverage[0].has_mv}`);
  console.log(`  Votes without member_votes: ${k25MvCoverage[0].no_mv}`);

  // 9. K25: zero-tally votes (for_count + against_count = 0)
  const k25ZeroTally = await db.execute<{ total: string }>(sql`
    SELECT count(*)::text AS total
    FROM votes
    WHERE knesset_num = 25 AND (for_count = 0 OR for_count IS NULL) AND (against_count = 0 OR against_count IS NULL)
  `);
  console.log('\n--- 9. K25: zero-tally votes ---');
  console.log(`  Votes with zero tallies: ${k25ZeroTally[0].total}`);

  // 10. Latest vote date in DB for K25
  const k25Latest = await db.execute<{ latest: string; earliest: string }>(sql`
    SELECT max(vote_date)::text AS latest, min(vote_date)::text AS earliest
    FROM votes
    WHERE knesset_num = 25
  `);
  console.log('\n--- 10. K25: date range in DB ---');
  console.log(`  Earliest: ${k25Latest[0].earliest}`);
  console.log(`  Latest:   ${k25Latest[0].latest}`);

  console.log('\n=== END OF REPORT ===\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Diagnostic failed:', err);
  process.exit(1);
});
