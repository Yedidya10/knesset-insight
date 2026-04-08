import { sql, eq, isNull, and, isNotNull } from 'drizzle-orm';
import { db } from '../../lib/db';
import { votes, bills } from '../../lib/db/schema';
import { BillStage } from '../../lib/knesset/bill-stages';
import { runSyncJob } from '../utils';

const BATCH_SIZE = 500;

/**
 * Regex to extract bill name from vote titles.
 * Matches patterns like:
 *   "הצעת חוק לתיקון פקודת הבנקאות (מס' 33) ... התשע"ח-2018"
 *   "הצעת חוק השיפוט הצבאי (תיקון מס' 43), התשס"ד-2003"
 */
const BILL_NAME_RE = /הצעת חוק\s+(.+?)(?:,\s*הת|$)/;

/**
 * Stage keywords found in vote titles → BillStage enum value.
 * Order matters: check more specific patterns first.
 */
const STAGE_KEYWORDS: { pattern: RegExp; stage: BillStage }[] = [
  { pattern: /קריאה שנייה ושלישית|קריאה שניה ושלישית/, stage: BillStage.SECOND_THIRD_READING },
  { pattern: /קריאה ראשונה/, stage: BillStage.FIRST_READING },
  { pattern: /דיון מוקדם/, stage: BillStage.PRELIMINARY },
  { pattern: /הצעת חוק.*ועדה|ועדה.*הצעת חוק/, stage: BillStage.COMMITTEE_FIRST },
];

/**
 * Derive bill_stage from vote title keywords.
 */
function deriveBillStage(title: string): BillStage | null {
  for (const { pattern, stage } of STAGE_KEYWORDS) {
    if (pattern.test(title)) return stage;
  }
  return null;
}

/**
 * Link votes to bills using a multi-layer matching strategy:
 *   Layer 1: Extract bill name from vote title → exact match against bills.name
 *   Layer 2: pg_trgm title similarity > 0.6 (also checks bill_names table)
 *   Layer 3: Propagate via sessItemId groups
 *   Layer 4: Derive bill_stage from vote title keywords
 */
export async function linkVotesToBills(): Promise<void> {
  await runSyncJob('link-votes-to-bills', async () => {
    let exactCount = 0;
    let similarityCount = 0;

    // Only process votes that don't already have a billId
    const unlinkedVotes = await db
      .select({
        id: votes.id,
        title: votes.title,
        knessetNum: votes.knessetNum,
        sessItemId: votes.sessItemId,
      })
      .from(votes)
      .where(isNull(votes.billId));

    console.log(`[link-votes-to-bills] ${unlinkedVotes.length} unlinked votes to process`);

    for (let i = 0; i < unlinkedVotes.length; i += BATCH_SIZE) {
      const batch = unlinkedVotes.slice(i, i + BATCH_SIZE);

      for (const vote of batch) {
        let matched = false;

        // Layer 1: Extract bill name from vote title → exact match
        const nameMatch = BILL_NAME_RE.exec(vote.title);
        if (nameMatch) {
          const extractedName = nameMatch[1].trim();
          const exactMatches = await db.execute<{ id: number }>(sql`
            SELECT b.id FROM bills b
            WHERE b.knesset_num = ${vote.knessetNum}
              AND b.name ILIKE ${'%' + extractedName + '%'}
            LIMIT 1
          `);
          if (exactMatches.length > 0) {
            await db.update(votes).set({ billId: exactMatches[0].id }).where(eq(votes.id, vote.id));
            exactCount++;
            matched = true;
          }
        }

        // Layer 2: pg_trgm similarity matching against bills.name + bill_names.name
        if (!matched) {
          const simMatches = await db.execute<{ id: number; sim: number }>(sql`
            SELECT id, sim FROM (
              SELECT b.id, similarity(b.name, ${vote.title}) AS sim
              FROM bills b
              WHERE b.knesset_num = ${vote.knessetNum}
                AND similarity(b.name, ${vote.title}) > 0.6
              UNION ALL
              SELECT bn.bill_id AS id, similarity(bn.name, ${vote.title}) AS sim
              FROM bill_names bn
              INNER JOIN bills b ON b.id = bn.bill_id
              WHERE b.knesset_num = ${vote.knessetNum}
                AND similarity(bn.name, ${vote.title}) > 0.6
            ) matches
            ORDER BY sim DESC
            LIMIT 1
          `);

          if (simMatches.length > 0) {
            await db.update(votes).set({ billId: simMatches[0].id }).where(eq(votes.id, vote.id));
            similarityCount++;
          }
        }
      }

      const processed = Math.min(i + BATCH_SIZE, unlinkedVotes.length);
      console.log(
        `[link-votes-to-bills] Processed ${processed}/${unlinkedVotes.length} (exact: ${exactCount}, similarity: ${similarityCount})`,
      );
    }

    // Layer 3: Propagate billId via sessItemId groups
    const propagated = await db.execute<{ id: number }>(sql`
      WITH linked AS (
        SELECT DISTINCT sess_item_id, bill_id
        FROM votes
        WHERE sess_item_id IS NOT NULL
          AND bill_id IS NOT NULL
      )
      UPDATE votes v
      SET bill_id = l.bill_id
      FROM linked l
      WHERE v.sess_item_id = l.sess_item_id
        AND v.bill_id IS NULL
      RETURNING v.id
    `);

    const propagatedCount = propagated.length;
    console.log(`[link-votes-to-bills] Propagated ${propagatedCount} via sessItemId`);

    // Layer 4: Derive bill_stage from vote title keywords
    const votesWithBills = await db
      .select({ id: votes.id, title: votes.title })
      .from(votes)
      .where(and(isNotNull(votes.billId), isNull(votes.billStage)));

    let stageCount = 0;
    for (let i = 0; i < votesWithBills.length; i += BATCH_SIZE) {
      const batch = votesWithBills.slice(i, i + BATCH_SIZE);
      for (const vote of batch) {
        const stage = deriveBillStage(vote.title);
        if (stage !== null) {
          await db
            .update(votes)
            .set({ billStage: stage })
            .where(eq(votes.id, vote.id));
          stageCount++;
        }
      }
    }

    console.log(`[link-votes-to-bills] Derived bill_stage for ${stageCount} votes`);
    console.log(
      `[link-votes-to-bills] TOTAL: exact=${exactCount} similarity=${similarityCount} propagated=${propagatedCount} staged=${stageCount}`,
    );

    return exactCount + similarityCount + propagatedCount;
  });
}
