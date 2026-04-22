import { sql, eq, and, isNull, inArray, or, like, max } from 'drizzle-orm';
import { db } from '../../lib/db';
import { bills, billDocuments, billStageSummaries } from '../../lib/db/schema';
import {
  generateBillSummary,
  type BillForSummary,
  type SummaryResult,
} from '../../lib/ai/legislation/summary-generator';
import { detectBudgetBillType } from '../../lib/ai/legislation/budget-bill-utils';
import { appConfig } from '../../../app.config';
import { runSyncJob, type SyncCheckpoint } from '../utils';

/**
 * Fetch the chapter names for a parent omnibus budget bill so the AI has
 * the split-chapter context when summarizing the parent.
 */
async function fetchChapterNamesForParent(
  parentBill: BillForSummary,
): Promise<string[] | undefined> {
  if (detectBudgetBillType(parentBill.name) !== 'parent') return undefined;
  const parentKeywords = parentBill.name
    .replace(/^הצעת /, '')
    .replace(/^חוק /, '')
    .slice(0, 60);
  const chapters = await db
    .select({ name: bills.name })
    .from(bills)
    .where(
      and(
        like(bills.name, `%מתוך%${parentKeywords.slice(0, 30)}%`),
        parentBill.knessetNum != null
          ? eq(bills.knessetNum, parentBill.knessetNum)
          : sql`TRUE`,
      ),
    )
    .limit(50);
  if (chapters.length === 0) return undefined;
  return chapters.map((c) => c.name.split('מתוך')[0].trim());
}

/**
 * Generate + persist an AI summary for a single bill. Shared by the batch
 * pipeline and the admin manual-regeneration endpoint.
 *
 * - Writes per-stage summary to `bill_stage_summaries` (upsert).
 * - Updates `bills.aiSummary` / `aiTopics` only when this generation is for
 *   the highest stage seen so far (never regress to an older version).
 * - Tracks provenance in `bills.metadata`:
 *   `aiSummaryGeneratedAt`, `aiSummarySourceType`, `aiSummaryDocsRead`,
 *   `budgetBillType` (when applicable).
 */
export async function processBillSummary(
  bill: BillForSummary & { metadata?: unknown },
): Promise<{
  success: boolean;
  tokensUsed: number;
  result: SummaryResult;
}> {
  const chapterNames = await fetchChapterNamesForParent(bill);
  const result = await generateBillSummary(bill, chapterNames);

  if (!result.summary) {
    return { success: false, tokensUsed: result.tokensUsed, result };
  }

  const existingMetadata = (bill.metadata as Record<string, unknown>) ?? {};
  const updatedMetadata: Record<string, unknown> = {
    ...existingMetadata,
    aiSummaryGeneratedAt: new Date().toISOString(),
    aiSummarySourceType: result.sourceType,
    aiSummaryDocsRead: result.docsRead,
    ...(result.budgetType && { budgetBillType: result.budgetType }),
  };

  // Per-stage history
  if (result.stage !== null) {
    await db
      .insert(billStageSummaries)
      .values({
        billId: bill.id,
        stage: result.stage,
        summary: result.summary,
        topics: result.topics ?? undefined,
        sourceDocType: result.sourceDocType,
        sourceDocId: result.sourceDocId,
      })
      .onConflictDoUpdate({
        target: [billStageSummaries.billId, billStageSummaries.stage],
        set: {
          summary: sql`excluded.summary`,
          topics: sql`excluded.topics`,
          sourceDocType: sql`excluded.source_doc_type`,
          sourceDocId: sql`excluded.source_doc_id`,
          generatedAt: new Date(),
        },
      });
  }

  // Only overwrite bills.aiSummary if this is the highest stage
  let shouldUpdateBill = true;
  if (result.stage !== null) {
    const [maxRow] = await db
      .select({ maxStage: max(billStageSummaries.stage) })
      .from(billStageSummaries)
      .where(eq(billStageSummaries.billId, bill.id));
    const maxExistingStage = maxRow?.maxStage ?? -1;
    shouldUpdateBill = result.stage >= maxExistingStage;
  }

  if (shouldUpdateBill) {
    await db
      .update(bills)
      .set({
        aiSummary: result.summary,
        aiTopics: result.topics ?? {},
        metadata: updatedMetadata,
        updatedAt: new Date(),
      })
      .where(eq(bills.id, bill.id));
  } else {
    await db
      .update(bills)
      .set({
        metadata: updatedMetadata,
        updatedAt: new Date(),
      })
      .where(eq(bills.id, bill.id));
  }

  return { success: true, tokensUsed: result.tokensUsed, result };
}

/**
 * Generate AI summaries for bills that:
 * 1. Have no official summary (SummaryLaw) AND no AI summary yet, OR
 * 2. Have an existing AI summary but the bill has been updated since
 *    (meaning the bill progressed through a reading / committee / reservations
 *    and the summary may be stale).
 *
 * Uses Claude with web search to ground summaries in official Knesset sources.
 * Respects a daily token budget to control costs.
 */
export async function generateBillSummaries(): Promise<void> {
  await runSyncJob('generate-bill-summaries', async (prevCheckpoint) => {
    const { batchSize, targetKnessets } = appConfig.billSummary;
    const { dailyTokenBudget } = appConfig.billSummary.ai;

    let tokensUsedToday = (prevCheckpoint?.tokensUsedToday as number) ?? 0;

    const lastRunDate = prevCheckpoint?.lastRunDate as string | undefined;
    const today = new Date().toISOString().split('T')[0];
    if (lastRunDate !== today) {
      tokensUsedToday = 0;
    }

    if (tokensUsedToday >= dailyTokenBudget) {
      console.log(
        `[generate-bill-summaries] Daily token budget exhausted (${tokensUsedToday}/${dailyTokenBudget})`,
      );
      return {
        count: 0,
        checkpoint: { tokensUsedToday, lastRunDate: today },
      };
    }

    const candidates = await db
      .select({
        id: bills.id,
        knessetId: bills.knessetId,
        name: bills.name,
        knessetNum: bills.knessetNum,
        billType: bills.billType,
        status: bills.status,
        proposedDate: bills.proposedDate,
        lastUpdate: bills.lastUpdate,
        metadata: bills.metadata,
      })
      .from(bills)
      .where(
        and(
          isNull(bills.summary),
          inArray(bills.knessetNum, [...targetKnessets]),
          or(
            isNull(bills.aiSummary),
            sql`${bills.lastUpdate} > COALESCE((${bills.metadata}->>'aiSummaryGeneratedAt')::timestamptz, '1970-01-01'::timestamptz)`,
          ),
        ),
      )
      .orderBy(
        sql`(EXISTS (SELECT 1 FROM ${billDocuments} WHERE ${billDocuments.billId} = ${bills.id})) DESC`,
        sql`${bills.lastUpdate} DESC NULLS LAST`,
      )
      .limit(batchSize);

    if (candidates.length === 0) {
      console.log('[generate-bill-summaries] No candidates found');
      return {
        count: 0,
        checkpoint: { tokensUsedToday, lastRunDate: today },
      };
    }

    console.log(
      `[generate-bill-summaries] Processing ${candidates.length} bills`,
    );

    let generated = 0;

    for (const bill of candidates) {
      if (tokensUsedToday >= dailyTokenBudget) {
        console.log(
          `[generate-bill-summaries] Daily token budget exhausted (${tokensUsedToday}/${dailyTokenBudget})`,
        );
        break;
      }

      try {
        const outcome = await processBillSummary(bill);
        tokensUsedToday += outcome.tokensUsed;
        if (outcome.success) generated++;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        console.error(
          `[generate-bill-summaries] Failed for bill ${bill.knessetId}: ${message}`,
        );
      }
    }

    const checkpoint: SyncCheckpoint = {
      tokensUsedToday,
      lastRunDate: today,
    };

    console.log(
      `[generate-bill-summaries] Generated ${generated}/${candidates.length} summaries (${tokensUsedToday} tokens used today)`,
    );

    return { count: generated, checkpoint };
  });
}
