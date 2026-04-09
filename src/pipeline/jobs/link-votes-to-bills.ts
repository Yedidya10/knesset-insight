import { sql, eq, isNull, isNotNull, and, inArray } from 'drizzle-orm';
import { db } from '../../lib/db';
import { votes, bills, billNames } from '../../lib/db/schema';
import { BillStage } from '../../lib/knesset/bill-stages';
import { runSyncJob } from '../utils';

const UPDATE_BATCH = 200;

/**
 * Link votes to bills using a hybrid in-memory + SQL strategy:
 *   Layer 1: In-memory substring matching (bill.name appears in vote.title)
 *   Layer 2: pg_trgm similarity per knesset (avoids Supabase timeout)
 *   Layer 3: Propagate via sessItemId groups (bulk SQL)
 *   Layer 4: Derive bill_stage from vote title keywords (bulk SQL)
 */
export async function linkVotesToBills(): Promise<void> {
  await runSyncJob('link-votes-to-bills', async () => {
    const [{ cnt: unlinkedBefore }] = await db.execute<{ cnt: string }>(sql`
      SELECT count(*)::text AS cnt FROM votes WHERE bill_id IS NULL
    `);
    console.log(`[link-votes-to-bills] ${unlinkedBefore} unlinked votes`);

    // ── Load data into memory ───────────────────────────────────
    console.log(`[link-votes-to-bills] Loading bills...`);
    const allBills = await db
      .select({ id: bills.id, name: bills.name, knessetNum: bills.knessetNum })
      .from(bills);
    console.log(`[link-votes-to-bills] Loaded ${allBills.length} bills`);

    console.log(`[link-votes-to-bills] Loading bill_names...`);
    const allBillNameRows = await db
      .select({ billId: billNames.billId, name: billNames.name })
      .from(billNames);
    console.log(
      `[link-votes-to-bills] Loaded ${allBillNameRows.length} bill_names`,
    );

    console.log(`[link-votes-to-bills] Loading unlinked votes...`);
    const unlinkedVotes = await db
      .select({
        id: votes.id,
        title: votes.title,
        knessetNum: votes.knessetNum,
      })
      .from(votes)
      .where(isNull(votes.billId));
    console.log(
      `[link-votes-to-bills] Loaded ${unlinkedVotes.length} unlinked votes`,
    );

    // Index bills by knesset_num for fast lookup
    const billsByKnesset = new Map<number, { id: number; name: string }[]>();
    for (const b of allBills) {
      if (!b.name || b.name.length <= 10) continue;
      const arr = billsByKnesset.get(b.knessetNum) ?? [];
      arr.push({ id: b.id, name: b.name });
      billsByKnesset.set(b.knessetNum, arr);
    }

    // Index bill_names by bill → lookup knesset from allBills
    const billKnessetMap = new Map<number, number>();
    for (const b of allBills) billKnessetMap.set(b.id, b.knessetNum);
    for (const bn of allBillNameRows) {
      if (!bn.name || bn.name.length <= 10) continue;
      const kn = billKnessetMap.get(bn.billId);
      if (kn == null) continue;
      const arr = billsByKnesset.get(kn) ?? [];
      arr.push({ id: bn.billId, name: bn.name });
      billsByKnesset.set(kn, arr);
    }

    // Sort each knesset's bills by name length DESC (longest match first)
    for (const arr of billsByKnesset.values()) {
      arr.sort((a, b) => b.name.length - a.name.length);
    }

    // ── Layer 1: In-memory substring match ──────────────────────
    console.log(`[link-votes-to-bills] Running Layer 1 in-memory matching...`);
    const layer1Updates: { voteId: number; billId: number }[] = [];
    const stillUnlinked: typeof unlinkedVotes = [];

    for (const vote of unlinkedVotes) {
      const candidates = billsByKnesset.get(vote.knessetNum) ?? [];
      const titleLower = vote.title.toLowerCase();
      let matched = false;
      for (const bill of candidates) {
        if (titleLower.includes(bill.name.toLowerCase())) {
          layer1Updates.push({ voteId: vote.id, billId: bill.id });
          matched = true;
          break; // longest already sorted first
        }
      }
      if (!matched) stillUnlinked.push(vote);
    }
    console.log(
      `[link-votes-to-bills] Layer 1 found ${layer1Updates.length} matches, writing to DB...`,
    );

    // Batch update Layer 1 matches — use sequential batches of 50 to avoid connection pool exhaustion
    for (let i = 0; i < layer1Updates.length; i += 50) {
      const batch = layer1Updates.slice(i, i + 50);
      await Promise.all(
        batch.map(({ voteId, billId }) =>
          db.update(votes).set({ billId }).where(eq(votes.id, voteId)),
        ),
      );
      if ((i + 50) % 500 === 0 || i + 50 >= layer1Updates.length) {
        console.log(
          `[link-votes-to-bills] Layer 1 written ${Math.min(i + 50, layer1Updates.length)}/${layer1Updates.length}`,
        );
      }
    }
    console.log(
      `[link-votes-to-bills] Layer 1 (name substring): ${layer1Updates.length}`,
    );

    // ── Layer 2: pg_trgm similarity (batched by vote IDs) ──────
    // Batch small groups of vote IDs instead of whole knessets to avoid Supabase timeout
    const LAYER2_BATCH = 150;
    console.log(
      `[link-votes-to-bills] Layer 2: processing ${stillUnlinked.length} votes in batches of ${LAYER2_BATCH}...`,
    );
    let layer2Count = 0;
    for (let i = 0; i < stillUnlinked.length; i += LAYER2_BATCH) {
      const batch = stillUnlinked.slice(i, i + LAYER2_BATCH);
      const idList = sql.join(
        batch.map((v) => sql`${v.id}`),
        sql`, `,
      );
      try {
        const result = await db.execute<{ id: number }>(sql`
          WITH best AS (
            SELECT DISTINCT ON (v.id) v.id AS vote_id, sub.bill_id
            FROM votes v
            CROSS JOIN LATERAL (
              SELECT b.id AS bill_id, similarity(b.name, v.title) AS sim
              FROM bills b
              WHERE b.knesset_num = v.knesset_num
                AND similarity(b.name, v.title) > 0.3
              ORDER BY sim DESC
              LIMIT 1
            ) sub
            WHERE v.id IN (${idList})
              AND v.bill_id IS NULL
            ORDER BY v.id
          )
          UPDATE votes v SET bill_id = best.bill_id
          FROM best WHERE v.id = best.vote_id
          RETURNING v.id
        `);
        layer2Count += result.length;
      } catch (err) {
        console.warn(
          `[link-votes-to-bills] Layer 2 batch ${i}: error`,
          (err as Error).message,
        );
      }
      if (
        (i + LAYER2_BATCH) % 1500 === 0 ||
        i + LAYER2_BATCH >= stillUnlinked.length
      ) {
        console.log(
          `[link-votes-to-bills] Layer 2 progress: ${Math.min(i + LAYER2_BATCH, stillUnlinked.length)}/${stillUnlinked.length}, ${layer2Count} matched`,
        );
      }
    }
    console.log(
      `[link-votes-to-bills] Layer 2 (similarity) total: ${layer2Count}`,
    );

    // ── Layer 3: Propagate via sessItemId ───────────────────────
    const layer3 = await db.execute<{ id: number }>(sql`
      WITH linked AS (
        SELECT DISTINCT ON (sess_item_id) sess_item_id, bill_id
        FROM votes
        WHERE sess_item_id IS NOT NULL AND bill_id IS NOT NULL
      )
      UPDATE votes v
      SET bill_id = l.bill_id
      FROM linked l
      WHERE v.sess_item_id = l.sess_item_id AND v.bill_id IS NULL
      RETURNING v.id
    `);
    console.log(
      `[link-votes-to-bills] Layer 3 (sessItemId propagation): ${layer3.length}`,
    );

    // ── Layer 4: Derive bill_stage from title keywords (bulk) ───
    const layer4 = await db.execute<{ id: number }>(sql`
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
    console.log(
      `[link-votes-to-bills] Layer 4 (bill_stage derivation): ${layer4.length}`,
    );

    const [{ cnt: unlinkedAfter }] = await db.execute<{ cnt: string }>(sql`
      SELECT count(*)::text AS cnt FROM votes WHERE bill_id IS NULL
    `);
    const totalLinked = Number(unlinkedBefore) - Number(unlinkedAfter);
    console.log(
      `[link-votes-to-bills] TOTAL: ${totalLinked} newly linked (${unlinkedAfter} still unlinked)`,
    );

    return totalLinked;
  });
}
