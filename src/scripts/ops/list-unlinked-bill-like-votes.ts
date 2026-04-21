/**
 * List K25 vote rows that look like bill votes but were NOT linked
 * to any bill row by linkVotesToBills.
 *
 * Output is intended for manual review — each row lists the vote ID,
 * date, title, and the closest bill candidate by pg_trgm similarity.
 * If a closest candidate exists with similarity > 0.2, it likely indicates
 * a near-match the fuzzy matcher missed. If no candidate is returned,
 * the bill itself is probably missing from the `bills` table.
 *
 * Usage: npx tsx src/scripts/list-unlinked-bill-like-votes.ts [knessetNum]
 *   (defaults to 25)
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const knessetNum = Number(process.argv[2] ?? 25);

  const { db } = await import('../../lib/db');
  const { sql } = await import('drizzle-orm');

  console.log(
    `\n=== K${knessetNum} — UNLINKED BILL-LIKE VOTES (manual review) ===\n`,
  );

  const rows = await db.execute<{
    id: string;
    knesset_id: string;
    vote_date: string;
    title: string;
    closest_bill_id: string | null;
    closest_bill_name: string | null;
    closest_sim: string | null;
  }>(sql`
    WITH candidates AS (
      SELECT v.id,
             v.knesset_id,
             v.vote_date,
             v.title,
             (SELECT b.id
              FROM bills b
              WHERE b.knesset_num = v.knesset_num
              ORDER BY similarity(b.name, v.title) DESC
              LIMIT 1) AS closest_bill_id,
             (SELECT b.name
              FROM bills b
              WHERE b.knesset_num = v.knesset_num
              ORDER BY similarity(b.name, v.title) DESC
              LIMIT 1) AS closest_bill_name,
             (SELECT similarity(b.name, v.title)
              FROM bills b
              WHERE b.knesset_num = v.knesset_num
              ORDER BY similarity(b.name, v.title) DESC
              LIMIT 1) AS closest_sim
      FROM votes v
      WHERE v.knesset_num = ${knessetNum}
        AND v.bill_id IS NULL
        AND (
          v.title ILIKE '%הצעת חוק%'
          OR v.title ILIKE '%הצעת%'
        )
        AND v.title NOT ILIKE '%אי אמון%'
        AND v.title NOT ILIKE '%אי-אמון%'
        AND v.title NOT ILIKE '%סדר היום%'
        AND v.title NOT ILIKE '%הודעת הממשלה%'
    )
    SELECT id::text,
           knesset_id::text,
           vote_date::text,
           title,
           closest_bill_id::text,
           closest_bill_name,
           closest_sim::text
    FROM candidates
    ORDER BY vote_date DESC
  `);

  console.log(`Found ${rows.length} unlinked bill-like votes.\n`);

  for (const row of rows) {
    const date = row.vote_date?.slice(0, 10) ?? '—';
    const sim = row.closest_sim ? Number(row.closest_sim).toFixed(3) : 'n/a';
    console.log(`[${date}] vote_id=${row.id} knesset_id=${row.knesset_id}`);
    console.log(`  title:   ${row.title}`);
    if (row.closest_bill_id) {
      console.log(
        `  closest: bill_id=${row.closest_bill_id} (sim=${sim}) — ${row.closest_bill_name}`,
      );
    } else {
      console.log(`  closest: (no bill candidates in K${knessetNum})`);
    }
    console.log('');
  }

  console.log('=== DONE ===\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
