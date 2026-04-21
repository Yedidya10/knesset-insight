import { sql, eq, isNull, isNotNull, and, inArray } from 'drizzle-orm';
import { db } from '../../lib/db';
import { votes, bills, billNames } from '../../lib/db/schema';
import { BillStage, NAME_TYPE_TO_STAGE } from '../../lib/knesset/bill-stages';
import { runSyncJob } from '../utils';

const UPDATE_BATCH = 200;

/**
 * Link votes to bills using a hybrid in-memory + SQL strategy:
 *   Layer 1: In-memory substring matching (bill.name appears in vote.title)
 *   Layer 2: pg_trgm similarity per knesset (avoids Supabase timeout)
 *   Layer 3: Propagate via sessItemId groups (bulk SQL)
 *   Layer 4: Name-history stage matching (bill_names.nameHistoryTypeId → BillStage)
 *   Layer 5: Keyword fallback for bill_stage (bulk SQL)
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
      const arr = billsByKnesset.get(b.knessetNum!) ?? [];
      arr.push({ id: b.id, name: b.name });
      billsByKnesset.set(b.knessetNum!, arr);
    }

    // Index bill_names by bill → lookup knesset from allBills
    const billKnessetMap = new Map<number, number>();
    for (const b of allBills) billKnessetMap.set(b.id, b.knessetNum!);
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
      const candidates = billsByKnesset.get(vote.knessetNum!) ?? [];
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
          db
            .update(votes)
            .set({ billId, activityType: 'bill' })
            .where(eq(votes.id, voteId)),
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
                AND similarity(b.name, v.title) > 0.25
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

    // ── Layer 4: Name-history stage matching ───────────────────
    // Match vote titles against bill_names that have known stage types
    // (nameHistoryTypeId → BillStage). This is far more accurate than
    // keyword matching because bill names change between stages.
    console.log(
      `[link-votes-to-bills] Layer 4: loading stage-specific bill names...`,
    );

    const stageTypeIds = Object.keys(NAME_TYPE_TO_STAGE).map(Number);
    const stageBillNames = await db
      .select({
        billId: billNames.billId,
        name: billNames.name,
        nameHistoryTypeId: billNames.nameHistoryTypeId,
      })
      .from(billNames)
      .where(inArray(billNames.nameHistoryTypeId, stageTypeIds));

    // Index by billId: { name, stage }[]
    const stageNamesByBill = new Map<
      number,
      { name: string; stage: BillStage }[]
    >();
    for (const sn of stageBillNames) {
      const stage = NAME_TYPE_TO_STAGE[sn.nameHistoryTypeId!];
      if (stage == null) continue;
      const arr = stageNamesByBill.get(sn.billId) ?? [];
      arr.push({ name: sn.name, stage });
      stageNamesByBill.set(sn.billId, arr);
    }
    // Sort each bill's names by length DESC (longest substring match first).
    // When lengths are equal, prefer higher stage (later in legislative process)
    // so that 2nd+3rd reading names win over 1st reading names.
    for (const arr of stageNamesByBill.values()) {
      arr.sort((a, b) => b.name.length - a.name.length || b.stage - a.stage);
    }

    console.log(
      `[link-votes-to-bills] Layer 4: ${stageBillNames.length} stage names for ${stageNamesByBill.size} bills`,
    );

    // Load votes that have a bill_id but no bill_stage yet
    const votesNeedStage = await db
      .select({
        id: votes.id,
        title: votes.title,
        billId: votes.billId,
      })
      .from(votes)
      .where(and(isNotNull(votes.billId), isNull(votes.billStage)));

    console.log(
      `[link-votes-to-bills] Layer 4: ${votesNeedStage.length} votes need stage assignment`,
    );

    const nameStageUpdates: { voteId: number; stage: number }[] = [];
    for (const vote of votesNeedStage) {
      const names = stageNamesByBill.get(vote.billId!) ?? [];
      if (names.length === 0) continue;
      const titleLower = vote.title.toLowerCase();
      for (const { name, stage } of names) {
        if (titleLower.includes(name.toLowerCase())) {
          nameStageUpdates.push({ voteId: vote.id, stage });
          break; // longest match first (sorted)
        }
      }
    }

    // Batch update
    for (let i = 0; i < nameStageUpdates.length; i += 50) {
      const batch = nameStageUpdates.slice(i, i + 50);
      await Promise.all(
        batch.map(({ voteId, stage }) =>
          db
            .update(votes)
            .set({ billStage: stage })
            .where(eq(votes.id, voteId)),
        ),
      );
    }
    console.log(
      `[link-votes-to-bills] Layer 4 (name-history stage): ${nameStageUpdates.length}`,
    );

    // ── Layer 5: Keyword fallback for bill_stage (bulk SQL) ─────
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
    console.log(
      `[link-votes-to-bills] Layer 5 (keyword fallback): ${layer5.length}`,
    );

    // ── Layer 6: Date-based disambiguation ───────────────────────
    // When Layer 4 assigned ALL votes of a bill to the SAME stage,
    // but the bill clearly progressed further (status → passed/later),
    // use vote dates to split: earliest date group keeps the stage,
    // later date groups move to SECOND_THIRD_READING.
    // This is data-driven — uses synced dates + bill status.
    const billsWithStage = await db.execute<{
      bill_id: number;
      stage: number;
      cnt: string;
      distinct_stages: string;
    }>(sql`
      SELECT bill_id, bill_stage AS stage, count(*)::text AS cnt,
             count(DISTINCT bill_stage)::text AS distinct_stages
      FROM votes
      WHERE bill_id IS NOT NULL AND bill_stage IS NOT NULL
      GROUP BY bill_id, bill_stage
    `);

    // Find bills where ALL votes share ONE stage
    const billStageCounts = new Map<number, Map<number, number>>();
    for (const row of billsWithStage) {
      const map = billStageCounts.get(row.bill_id) ?? new Map();
      map.set(row.stage, Number(row.cnt));
      billStageCounts.set(row.bill_id, map);
    }

    // Load bill status to determine progression
    const billStatusMap = new Map<number, string>();
    const allBillStatuses = await db
      .select({ id: bills.id, status: bills.status })
      .from(bills);
    for (const b of allBillStatuses) {
      if (b.status) billStatusMap.set(b.id, b.status);
    }

    // Status IDs that indicate the bill passed through 2nd+3rd reading
    const PASSED_BEYOND_FIRST = new Set([
      '113',
      '114',
      '115',
      '117',
      '118', // committee 2nd, 2nd+3rd reading, passed
      '122',
      '126',
      '169', // merged (during committee 2nd)
      '178',
      '179', // committee second variants
    ]);

    let layer6Count = 0;
    for (const [billId, stageMap] of billStageCounts) {
      // Only fix bills with a SINGLE assigned stage
      if (stageMap.size !== 1) continue;
      const [assignedStage, voteCount] = [...stageMap.entries()][0];
      // Only fix early stages (FIRST_READING or before) with multiple votes
      if (assignedStage > BillStage.FIRST_READING || voteCount <= 1) continue;
      // Only fix if the bill progressed beyond the assigned stage
      const status = billStatusMap.get(billId);
      if (!status || !PASSED_BEYOND_FIRST.has(status)) continue;

      // Get all votes for this bill, sorted by date
      const billVotes = await db
        .select({ id: votes.id, voteDate: votes.voteDate })
        .from(votes)
        .where(and(eq(votes.billId, billId), isNotNull(votes.billStage)))
        .orderBy(votes.voteDate);

      if (billVotes.length <= 1) continue;

      // Find the earliest vote date (this is the actual first-reading vote)
      const firstDate = billVotes[0].voteDate;
      if (!firstDate) continue;

      // Votes on a LATER day than the first vote → SECOND_THIRD_READING
      const firstDay = firstDate.toISOString().slice(0, 10);
      const laterVoteIds = billVotes
        .filter(
          (v) =>
            v.voteDate && v.voteDate.toISOString().slice(0, 10) !== firstDay,
        )
        .map((v) => v.id);

      if (laterVoteIds.length === 0) continue;

      // Batch update later votes to SECOND_THIRD_READING
      for (let i = 0; i < laterVoteIds.length; i += UPDATE_BATCH) {
        const batch = laterVoteIds.slice(i, i + UPDATE_BATCH);
        await db
          .update(votes)
          .set({ billStage: BillStage.SECOND_THIRD_READING })
          .where(inArray(votes.id, batch));
      }
      layer6Count += laterVoteIds.length;
    }
    console.log(
      `[link-votes-to-bills] Layer 6 (date disambiguation): ${layer6Count}`,
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
