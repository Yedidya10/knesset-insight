import { sql, eq, and, isNull, inArray, or, like, max } from 'drizzle-orm';
import { db } from '../../lib/db';
import { bills, billStageSummaries } from '../../lib/db/schema';
import { generateBillSummary } from '../../lib/ai/legislation/summary-generator';
import { detectBudgetBillType } from '../../lib/ai/legislation/budget-bill-utils';
import { appConfig } from '../../../app.config';
import { runSyncJob, type SyncCheckpoint } from '../utils';

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

    // Reset daily counter if last run was on a different day
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

    // Find bills needing summaries:
    // - No official summary AND no AI summary (new bills)
    // - Has AI summary but bill was updated after AI generation (stale summary)
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
            // Never had an AI summary
            isNull(bills.aiSummary),
            // AI summary is stale: bill was updated after AI summary was generated
            // We store aiSummaryGeneratedAt in metadata for comparison
            sql`${bills.lastUpdate} > COALESCE((${bills.metadata}->>'aiSummaryGeneratedAt')::timestamptz, '1970-01-01'::timestamptz)`,
          ),
        ),
      )
      .orderBy(sql`${bills.lastUpdate} DESC NULLS LAST`)
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
        // For parent omnibus budget bills, fetch the chapter names from the DB
        let chapterNames: string[] | undefined;
        const budgetType = detectBudgetBillType(bill.name);
        if (budgetType === 'parent') {
          // Extract the identifying part of the bill name to find its chapters
          // Chapters contain "מתוך" + a substring of the parent name
          const parentKeywords = bill.name
            .replace(/^הצעת /, '')
            .replace(/^חוק /, '')
            .slice(0, 60);
          const chapters = await db
            .select({ name: bills.name })
            .from(bills)
            .where(
              and(
                like(bills.name, `%מתוך%${parentKeywords.slice(0, 30)}%`),
                eq(bills.knessetNum, bill.knessetNum!),
              ),
            )
            .limit(50);
          if (chapters.length > 0) {
            chapterNames = chapters.map((c) => c.name.split('מתוך')[0].trim());
          }
        }

        const result = await generateBillSummary(
          {
            id: bill.id,
            knessetId: bill.knessetId,
            name: bill.name,
            knessetNum: bill.knessetNum,
            billType: bill.billType,
            status: bill.status,
            proposedDate: bill.proposedDate,
          },
          chapterNames,
        );

        tokensUsedToday += result.tokensUsed;

        if (result.summary) {
          // Store summary + topics + track generation timestamp in metadata
          const existingMetadata =
            (bill.metadata as Record<string, unknown>) ?? {};
          const updatedMetadata = {
            ...existingMetadata,
            aiSummaryGeneratedAt: new Date().toISOString(),
            ...(result.budgetType && { budgetBillType: result.budgetType }),
          };

          // Write per-stage summary if a stage was determined
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

          // Only update bills.aiSummary if this is the highest stage
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
            // Still update metadata timestamp even if not the highest stage
            await db
              .update(bills)
              .set({
                metadata: updatedMetadata,
                updatedAt: new Date(),
              })
              .where(eq(bills.id, bill.id));
          }

          generated++;
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        console.error(
          `[generate-bill-summaries] Failed for bill ${bill.knessetId}: ${message}`,
        );
        // Continue with next bill rather than failing the entire batch
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
