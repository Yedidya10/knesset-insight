import { sql, eq, isNull, and, isNotNull } from 'drizzle-orm';
import { db } from '../../lib/db';
import { votes, bills } from '../../lib/db/schema';
import { runSyncJob } from '../utils';

const BATCH_SIZE = 500;

/**
 * Stage keywords found in vote titles → BillStage enum value.
 * Order matters: check more specific patterns first.
 */
const STAGE_KEYWORDS: { pattern: RegExp; stage: number }[] = [
  { pattern: /קריאה שנייה ושלישית|קריאה שניה ושלישית/, stage: 5 },
  { pattern: /קריאה ראשונה/, stage: 3 },
  { pattern: /דיון מוקדם/, stage: 1 },
  { pattern: /הצעת חוק.*ועדה|ועדה.*הצעת חוק/, stage: 2 },
];

/**
 * Derive bill_stage from vote title keywords.
 */
function deriveBillStage(title: string): number | null {
  for (const { pattern, stage } of STAGE_KEYWORDS) {
    if (pattern.test(title)) return stage;
  }
  return null;
}

/**
 * Link votes to bills using pg_trgm title similarity,
 * then propagate via sessItemId groups.
 */
export async function linkVotesToBills(): Promise<void> {
  await runSyncJob('link-votes-to-bills', async () => {
    let totalLinked = 0;

    // Step 1: Title similarity matching using pg_trgm
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
        // Use pg_trgm to find best matching bill by title similarity
        const matches = await db.execute<{
          id: number;
          similarity: number;
        }>(sql`
          SELECT b.id, similarity(b.name, ${vote.title}) AS similarity
          FROM bills b
          WHERE b.knesset_num = ${vote.knessetNum}
            AND similarity(b.name, ${vote.title}) > 0.6
          ORDER BY similarity DESC
          LIMIT 1
        `);

        if (matches.length > 0) {
          await db
            .update(votes)
            .set({ billId: matches[0].id })
            .where(eq(votes.id, vote.id));
          totalLinked++;
        }
      }

      console.log(
        `[link-votes-to-bills] Processed ${Math.min(i + BATCH_SIZE, unlinkedVotes.length)}/${unlinkedVotes.length} votes (${totalLinked} linked)`,
      );
    }

    // Step 2: Propagate billId via sessItemId groups
    // If one vote in a sessItemId group has billId, propagate to siblings
    const propagated = await db.execute<{ count: number }>(sql`
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
    totalLinked += propagatedCount;
    console.log(`[link-votes-to-bills] Propagated ${propagatedCount} via sessItemId`);

    // Step 3: Derive bill_stage from vote title keywords
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

    return totalLinked;
  });
}
