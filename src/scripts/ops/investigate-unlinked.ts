/**
 * Investigate unlinked K25 votes — writes output to docs/unlinked-votes-report.txt
 * Usage: npx tsx src/scripts/investigate-unlinked.ts
 */
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
config({ path: '.env.local' });

const outPath = path.join(process.cwd(), 'docs', 'unlinked-votes-report.txt');
const out: string[] = [];
function log(s = '') {
  out.push(s);
}

async function main() {
  const { db } = await import('../../lib/db');
  const { sql } = await import('drizzle-orm');

  log('=== UNLINKED K25 LEGISLATION VOTES — INVESTIGATION ===');
  log(`Generated: ${new Date().toISOString()}`);
  log('');

  // GROUP A: "חוק" but not seder-hayom / no-confidence / "הצעת"
  const withChok = await db.execute<{
    id: number;
    knesset_id: number;
    title: string;
    vote_date: string;
    sess_item_id: number | null;
  }>(sql`
    SELECT id, knesset_id, title, vote_date::date::text AS vote_date, sess_item_id
    FROM votes
    WHERE knesset_num = 25 AND bill_id IS NULL
      AND title ILIKE '%חוק%'
      AND title NOT ILIKE '%סדר היום%'
      AND title NOT ILIKE '%אי אמון%'
      AND title NOT ILIKE '%הצעת%'
    ORDER BY vote_date DESC
  `);
  log(
    `=== GROUP A: includes "חוק" (not seder-hayom/no-confidence/hatzaa) — ${withChok.length} votes ===`,
  );
  for (const r of withChok) {
    log(
      `  [${r.vote_date}] sessItem=${r.sess_item_id} | knessetId=${r.knesset_id}`,
    );
    log(`    ${r.title}`);
  }
  log('');

  // GROUP B: "הצעת חוק"
  const hatzaatChok = await db.execute<{
    id: number;
    knesset_id: number;
    title: string;
    vote_date: string;
    sess_item_id: number | null;
  }>(sql`
    SELECT id, knesset_id, title, vote_date::date::text AS vote_date, sess_item_id
    FROM votes
    WHERE knesset_num = 25 AND bill_id IS NULL
      AND title ILIKE '%הצעת חוק%'
    ORDER BY vote_date DESC
  `);
  log(`=== GROUP B: "הצעת חוק" — ${hatzaatChok.length} votes ===`);
  for (const r of hatzaatChok) {
    log(
      `  [${r.vote_date}] sessItem=${r.sess_item_id} | knessetId=${r.knesset_id}`,
    );
    log(`    ${r.title}`);
  }
  log('');

  // GROUP C: "הצעת" other (not chok, not seder-hayom, not no-confidence)
  const otherHatzaa = await db.execute<{
    id: number;
    knesset_id: number;
    title: string;
    vote_date: string;
    sess_item_id: number | null;
  }>(sql`
    SELECT id, knesset_id, title, vote_date::date::text AS vote_date, sess_item_id
    FROM votes
    WHERE knesset_num = 25 AND bill_id IS NULL
      AND title ILIKE '%הצעת%'
      AND title NOT ILIKE '%הצעת חוק%'
      AND title NOT ILIKE '%סדר היום%'
      AND title NOT ILIKE '%אי אמון%'
    ORDER BY vote_date DESC
  `);
  log(
    `=== GROUP C: "הצעת" other (not chok/seder-hayom/no-confidence) — ${otherHatzaa.length} votes ===`,
  );
  for (const r of otherHatzaa) {
    log(
      `  [${r.vote_date}] sessItem=${r.sess_item_id} | knessetId=${r.knesset_id}`,
    );
    log(`    ${r.title}`);
  }
  log('');

  // GROUP D: "אחר" — none of the above keyword patterns
  const other = await db.execute<{
    id: number;
    knesset_id: number;
    title: string;
    vote_date: string;
    sess_item_id: number | null;
  }>(sql`
    SELECT id, knesset_id, title, vote_date::date::text AS vote_date, sess_item_id
    FROM votes
    WHERE knesset_num = 25 AND bill_id IS NULL
      AND title NOT ILIKE '%חוק%'
      AND title NOT ILIKE '%הצעת%'
      AND title NOT ILIKE '%סדר היום%'
      AND title NOT ILIKE '%אי אמון%'
      AND title NOT ILIKE '%הסתייג%'
    ORDER BY vote_date DESC
  `);
  log(
    `=== GROUP D: "other" (not chok/hatzaa/seder-hayom/no-confidence/reservation) — ${other.length} votes ===`,
  );
  for (const r of other) {
    log(
      `  [${r.vote_date}] sessItem=${r.sess_item_id} | knessetId=${r.knesset_id}`,
    );
    log(`    ${r.title}`);
  }
  log('');

  // CROSS-CHECK: unlinked votes with sessItemId that has a linked sibling
  const withSiblings = await db.execute<{
    id: number;
    knesset_id: number;
    title: string;
    sess_item_id: number;
    sibling_bill_id: number;
    sibling_title: string;
  }>(sql`
    SELECT
      v.id, v.knesset_id, v.title, v.sess_item_id,
      linked.bill_id AS sibling_bill_id,
      linked.title AS sibling_title
    FROM votes v
    JOIN LATERAL (
      SELECT v2.bill_id, v2.title
      FROM votes v2
      WHERE v2.sess_item_id = v.sess_item_id
        AND v2.bill_id IS NOT NULL
        AND v2.knesset_num = 25
      LIMIT 1
    ) linked ON true
    WHERE v.knesset_num = 25
      AND v.bill_id IS NULL
      AND v.sess_item_id IS NOT NULL
    ORDER BY v.vote_date DESC
  `);
  log(
    `=== CROSS-CHECK: Unlinked with linked sessItemId siblings — ${withSiblings.length} votes ===`,
  );
  log('(These can be fixed by Layer 3 of linkVotesToBills)');
  log('');
  for (const r of withSiblings) {
    log(
      `  knessetId=${r.knesset_id} | sessItem=${r.sess_item_id} -> bill_id=${r.sibling_bill_id}`,
    );
    log(`    UNLINKED: ${r.title}`);
    log(`    SIBLING:  ${r.sibling_title}`);
    log('');
  }

  log('=== SUMMARY ===');
  log(`  Group A (has "chok", not seder/no-conf/hatzaa): ${withChok.length}`);
  log(
    `  Group B ("hatzaat chok"):                       ${hatzaatChok.length}`,
  );
  log(
    `  Group C ("hatzaat" other):                      ${otherHatzaa.length}`,
  );
  log(`  Group D (other patterns):                       ${other.length}`);
  log(
    `  Can fix via sessItemId siblings:                ${withSiblings.length}`,
  );
  log('');

  fs.writeFileSync(outPath, out.join('\n'), { encoding: 'utf8' });
  console.log(`Report written to: ${outPath}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
