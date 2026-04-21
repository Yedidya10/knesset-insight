import { config } from 'dotenv';
config({ path: '.env.local' });

/**
 * Reset all bill_stage values and re-run Layers 4+5+6 of the vote
 * classification pipeline using bulk SQL. This ensures the date-based
 * disambiguation (Layer 6) correctly assigns later-day votes to
 * SECOND_THIRD_READING.
 */
async function main() {
  const { db } = await import('../../lib/db/index');
  const { votes, bills, billNames } = await import('../../lib/db/schema');
  const { sql, eq, isNotNull, and, inArray } = await import('drizzle-orm');
  const { BillStage, NAME_TYPE_TO_STAGE } =
    await import('../../lib/knesset/bill-stages');

  // ── Step 1: Reset all bill_stage to NULL ──────────────────────
  console.log('Step 1: Resetting all bill_stage values...');
  const [{ cnt: resetCount }] = await db.execute<{ cnt: string }>(sql`
    WITH upd AS (
      UPDATE votes SET bill_stage = NULL WHERE bill_stage IS NOT NULL
      RETURNING id
    )
    SELECT count(*)::text AS cnt FROM upd
  `);
  console.log(`  Reset ${resetCount} votes`);

  // ── Step 2: Layer 4 — Name-history stage matching (bulk SQL) ──
  // For each vote with a bill_id, find the best matching stage name
  // from bill_names and assign the stage. Uses a single SQL statement.
  console.log('Step 2: Layer 4 (name-history stage via bulk SQL)...');
  const stageTypeIds = Object.keys(NAME_TYPE_TO_STAGE).map(Number);
  // Build a SQL CASE for nameHistoryTypeId → BillStage
  const stageCaseParts = stageTypeIds
    .map((tid) => {
      const stage = NAME_TYPE_TO_STAGE[tid];
      if (stage == null) return null;
      return `WHEN ${tid} THEN ${stage}`;
    })
    .filter(Boolean)
    .join(' ');
  const stageCase = `CASE bn.name_history_type_id ${stageCaseParts} END`;

  const layer4 = await db.execute<{ id: number }>(
    sql.raw(`
    UPDATE votes v
    SET bill_stage = sub.stage
    FROM (
      SELECT DISTINCT ON (v2.id) v2.id AS vote_id,
        (${stageCase}) AS stage
      FROM votes v2
      JOIN bill_names bn ON bn.bill_id = v2.bill_id
        AND bn.name_history_type_id IN (${stageTypeIds.join(',')})
        AND lower(v2.title) LIKE '%' || lower(bn.name) || '%'
      WHERE v2.bill_id IS NOT NULL AND v2.bill_stage IS NULL
      ORDER BY v2.id, length(bn.name) DESC,
        (${stageCase}) DESC
    ) sub
    WHERE v.id = sub.vote_id AND sub.stage IS NOT NULL
    RETURNING v.id
  `),
  );
  console.log(`  Layer 4: ${layer4.length} assigned`);

  // ── Step 3: Layer 5 — Keyword fallback (bulk SQL) ─────────────
  console.log('Step 3: Layer 5 (keyword fallback)...');
  const layer5 = await db.execute<{ id: number }>(sql`
    UPDATE votes
    SET bill_stage = CASE
      WHEN title ~* 'קריאה שנייה ושלישית|קריאה שניה ושלישית'
        THEN ${BillStage.SECOND_THIRD_READING}::int
      WHEN title ~* 'קריאה שנייה|קריאה שניה'
        THEN ${BillStage.SECOND_THIRD_READING}::int
      WHEN title ~* 'קריאה ראשונה'
        THEN ${BillStage.FIRST_READING}::int
      WHEN title ~* 'דיון מוקדם'
        THEN ${BillStage.PRELIMINARY}::int
      WHEN title ~* 'הסתייגות|הסתייגויות'
        THEN ${BillStage.SECOND_THIRD_READING}::int
      WHEN title ~* 'אישור החוק'
        THEN ${BillStage.PASSED}::int
    END
    WHERE bill_id IS NOT NULL AND bill_stage IS NULL
      AND title ~* 'קריאה שנייה ושלישית|קריאה שניה ושלישית|קריאה שנייה|קריאה שניה|קריאה ראשונה|דיון מוקדם|הסתייגות|הסתייגויות|אישור החוק'
    RETURNING id
  `);
  console.log(`  Layer 5: ${layer5.length} assigned`);

  // ── Step 4: Layer 6 — Date-based disambiguation ───────────────
  // When Layer 4 assigned ALL votes of a bill to the SAME early stage,
  // but the bill progressed further, split by date: earliest day keeps
  // the original stage, later days → SECOND_THIRD_READING.
  console.log('Step 4: Layer 6 (date disambiguation)...');

  // Status IDs indicating the bill progressed beyond first reading
  const PASSED_BEYOND_FIRST = [
    '113',
    '114',
    '115',
    '117',
    '118',
    '122',
    '126',
    '169',
    '178',
    '179',
  ];
  const statusList = PASSED_BEYOND_FIRST.map((s) => `'${s}'`).join(',');

  const layer6 = await db.execute<{ id: number }>(
    sql.raw(`
    WITH single_stage_bills AS (
      -- Bills where ALL staged votes share ONE stage ≤ FIRST_READING
      SELECT v.bill_id, min(v.bill_stage) AS assigned_stage
      FROM votes v
      WHERE v.bill_id IS NOT NULL AND v.bill_stage IS NOT NULL
      GROUP BY v.bill_id
      HAVING count(DISTINCT v.bill_stage) = 1
        AND min(v.bill_stage) <= ${BillStage.FIRST_READING}
        AND count(*) > 1
    ),
    progressed_bills AS (
      -- Only bills whose status indicates they passed beyond first reading
      SELECT ssb.bill_id, ssb.assigned_stage
      FROM single_stage_bills ssb
      JOIN bills b ON b.id = ssb.bill_id
      WHERE b.status IN (${statusList})
    ),
    first_dates AS (
      -- Find the earliest vote date for each qualifying bill
      SELECT pb.bill_id, min(v.vote_date::date) AS first_day
      FROM progressed_bills pb
      JOIN votes v ON v.bill_id = pb.bill_id AND v.bill_stage IS NOT NULL
      GROUP BY pb.bill_id
    )
    UPDATE votes v
    SET bill_stage = ${BillStage.SECOND_THIRD_READING}
    FROM first_dates fd
    WHERE v.bill_id = fd.bill_id
      AND v.bill_stage IS NOT NULL
      AND v.vote_date::date > fd.first_day
    RETURNING v.id
  `),
  );
  console.log(`  Layer 6: ${layer6.length} reassigned`);

  // ── Verification ──────────────────────────────────────────────
  console.log('\n=== VERIFICATION ===');
  const b27 = await db.execute(sql`
    SELECT bill_stage, count(*) AS cnt
    FROM votes WHERE bill_id = 27
    GROUP BY bill_stage ORDER BY bill_stage
  `);
  console.log('Bill 27:', JSON.stringify(b27));

  const global = await db.execute(sql`
    SELECT
      count(*) FILTER (WHERE bill_stage IS NOT NULL) AS has_stage,
      count(*) FILTER (WHERE bill_stage IS NULL) AS no_stage,
      count(*) FILTER (WHERE bill_id IS NOT NULL) AS has_bill
    FROM votes
  `);
  console.log('Global:', JSON.stringify(global));

  process.exit(0);
}
main();
