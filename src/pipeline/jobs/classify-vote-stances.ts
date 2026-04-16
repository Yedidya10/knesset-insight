import {
  sql,
  eq,
  and,
  isNull,
  isNotNull,
  notInArray,
  inArray,
} from 'drizzle-orm';
import { db } from '../../lib/db';
import {
  votes,
  bills,
  policyStances,
  voteStanceAlignment,
  billClassificationContext,
  pipelineRunLog,
  pipelineItemLog,
} from '../../lib/db/schema';
import {
  classifyVoteStance,
  type VoteForClassification,
  type ExistingStance,
} from '../../lib/ai/legislation/stance-classifier';
import {
  fetchBillDocuments,
  readDocument,
  extractExplanatoryNotes,
} from '../../lib/ai/legislation/document-reader';
import { appConfig } from '../../../app.config';
import { runSyncJob } from '../utils';

// ── Types ────────────────────────────────────────────────

interface StanceClassificationCheckpoint {
  lastProcessedVoteId?: number;
  tokensUsedToday?: number;
  lastRunDate?: string;
  totalClassified?: number;
  stancesCreated?: number;
}

// ── Pipeline job ─────────────────────────────────────────

/**
 * Classify votes into policy stances using AI.
 *
 * Process:
 * 1. Find votes linked to bills with AI summaries that haven't been classified yet
 * 2. For each vote, load bill context (summary, topics, document text)
 * 3. Call Claude to classify: proPosition + stance matching + alignment
 * 4. Store results in vote_stance_alignment
 * 5. Create new policy stances if AI suggests them with high confidence
 * 6. Update vote_count on affected stances
 */
export async function classifyVoteStances(): Promise<void> {
  await runSyncJob('classify-vote-stances', async (prevCheckpoint) => {
    const checkpoint = (prevCheckpoint as StanceClassificationCheckpoint) ?? {};
    const { batchSize, directReviewThreshold } = appConfig.policyStances;
    const dailyTokenBudget = 500_000; // ~$1.50/day safety cap

    let tokensUsedToday = checkpoint.tokensUsedToday ?? 0;
    let totalClassified = checkpoint.totalClassified ?? 0;
    let stancesCreated = checkpoint.stancesCreated ?? 0;

    // Reset daily counter
    const today = new Date().toISOString().split('T')[0];
    if (checkpoint.lastRunDate !== today) {
      tokensUsedToday = 0;
    }

    if (tokensUsedToday >= dailyTokenBudget) {
      console.log(
        `[classify-vote-stances] Daily token budget exhausted (${tokensUsedToday}/${dailyTokenBudget})`,
      );
      return {
        count: 0,
        checkpoint: { ...checkpoint, tokensUsedToday, lastRunDate: today },
      };
    }

    // Create pipeline run log entry
    const [runLog] = await db
      .insert(pipelineRunLog)
      .values({
        jobName: 'classify-vote-stances',
        runStatus: 'running',
        configSnapshot: {
          batchSize,
          directReviewThreshold,
          dailyTokenBudget,
        },
      })
      .returning({ id: pipelineRunLog.id });

    const runId = runLog.id;

    try {
      // Fetch existing stances for matching
      const rawStances = await db
        .select({
          id: policyStances.id,
          label: policyStances.label,
          domain: policyStances.domain,
          stanceType: policyStances.stanceType,
        })
        .from(policyStances)
        .where(eq(policyStances.isActive, true));

      const existingStances: ExistingStance[] = rawStances.map((s) => ({
        id: s.id,
        label: s.label as Record<string, string>,
        domain: s.domain,
        stanceType: s.stanceType,
      }));

      // Find votes that need classification:
      // - Linked to a bill with AI summary
      // - Not yet classified (no entry in vote_stance_alignment)
      const alreadyClassified = db
        .select({ voteId: voteStanceAlignment.voteId })
        .from(voteStanceAlignment);

      const candidates = await db
        .select({
          voteId: votes.id,
          title: votes.title,
          voteDate: votes.voteDate,
          forCount: votes.forCount,
          againstCount: votes.againstCount,
          isAccepted: votes.isAccepted,
          billId: votes.billId,
          billName: bills.name,
          billSummary: bills.aiSummary,
          billTopics: bills.aiTopics,
        })
        .from(votes)
        .innerJoin(bills, eq(votes.billId, bills.id))
        .where(
          and(
            isNotNull(bills.aiSummary),
            notInArray(votes.id, alreadyClassified),
          ),
        )
        .orderBy(sql`${votes.voteDate} DESC`)
        .limit(batchSize);

      if (candidates.length === 0) {
        console.log(
          '[classify-vote-stances] No unclassified votes with bill summaries found',
        );
        await db
          .update(pipelineRunLog)
          .set({
            runStatus: 'completed',
            completedAt: new Date(),
            itemsProcessed: 0,
          })
          .where(eq(pipelineRunLog.id, runId));

        return {
          count: 0,
          checkpoint: { ...checkpoint, tokensUsedToday, lastRunDate: today },
        };
      }

      console.log(
        `[classify-vote-stances] Processing ${candidates.length} votes (${existingStances.length} existing stances)`,
      );

      let processed = 0;
      let failed = 0;
      let skipped = 0;

      for (const candidate of candidates) {
        if (tokensUsedToday >= dailyTokenBudget) {
          console.log(`[classify-vote-stances] Daily token budget exhausted`);
          break;
        }

        const startMs = Date.now();

        try {
          // Load bill document text (cached or fresh)
          let documentText: string | null = null;
          if (candidate.billId) {
            documentText = await getBillDocumentText(candidate.billId);
          }

          const voteInput: VoteForClassification = {
            voteId: candidate.voteId,
            title: candidate.title,
            voteDate: candidate.voteDate.toISOString().split('T')[0],
            forCount: candidate.forCount ?? 0,
            againstCount: candidate.againstCount ?? 0,
            isAccepted: candidate.isAccepted,
            billId: candidate.billId,
            billName: candidate.billName,
            billSummary: candidate.billSummary as Record<string, string> | null,
            billTopics: candidate.billTopics as Record<string, string[]> | null,
            billDocumentText: documentText,
          };

          const result = await classifyVoteStance(voteInput, existingStances);
          tokensUsedToday += result.tokensUsed;

          // Skip procedural votes
          if (!result.proPosition) {
            skipped++;
            await db.insert(pipelineItemLog).values({
              runId,
              itemType: 'vote',
              itemId: candidate.voteId,
              status: 'skipped',
              durationMs: Date.now() - startMs,
              tokensUsed: result.tokensUsed,
              metadata: { reason: 'procedural_or_unclassifiable' },
            });
            continue;
          }

          // Handle new stance suggestions: create them with needs_review if high confidence
          for (const ns of result.newStances) {
            if (ns.confidence >= directReviewThreshold) {
              // Check if a very similar stance already exists (by Hebrew label)
              const existingMatch = existingStances.find(
                (s) => (s.label as Record<string, string>).he === ns.label.he,
              );
              if (existingMatch) {
                // Add as a match to the existing stance instead
                result.matches.push({
                  stanceId: existingMatch.id,
                  alignment: ns.alignment,
                  confidence: ns.confidence,
                });
                continue;
              }

              // Create new stance
              const [newStance] = await db
                .insert(policyStances)
                .values({
                  label: ns.label,
                  description: ns.description,
                  domain: ns.domain,
                  stanceType: 'direct',
                  isActive: true,
                  voteCount: 0,
                })
                .returning({ id: policyStances.id });

              console.log(
                `[classify-vote-stances] Created new stance: "${ns.label.he}" (id=${newStance.id}, domain=${ns.domain})`,
              );

              // Add it to existing stances for future iterations + matches for this vote
              existingStances.push({
                id: newStance.id,
                label: ns.label,
                domain: ns.domain,
                stanceType: 'direct',
              });
              result.matches.push({
                stanceId: newStance.id,
                alignment: ns.alignment,
                confidence: ns.confidence,
              });
              stancesCreated++;
            }
          }

          // Store matches in vote_stance_alignment
          for (const match of result.matches) {
            const needsReview = match.confidence < directReviewThreshold;

            await db
              .insert(voteStanceAlignment)
              .values({
                voteId: candidate.voteId,
                stanceId: match.stanceId,
                alignment: match.alignment,
                proPosition: result.proPosition,
                confidence: match.confidence,
                needsReview,
              })
              .onConflictDoNothing();

            // Update vote_count on the stance
            await db
              .update(policyStances)
              .set({
                voteCount: sql`(
                    SELECT count(*) FROM vote_stance_alignment
                    WHERE stance_id = ${match.stanceId}
                  )`,
                updatedAt: new Date(),
              })
              .where(eq(policyStances.id, match.stanceId));
          }

          processed++;
          totalClassified++;

          await db.insert(pipelineItemLog).values({
            runId,
            itemType: 'vote',
            itemId: candidate.voteId,
            status: result.matches.length > 0 ? 'success' : 'skipped',
            durationMs: Date.now() - startMs,
            tokensUsed: result.tokensUsed,
            aiResponse: {
              proPosition: result.proPosition,
              matchCount: result.matches.length,
              newStancesCreated: result.newStances.filter(
                (ns) => ns.confidence >= directReviewThreshold,
              ).length,
            },
          });
        } catch (error) {
          failed++;
          const msg = error instanceof Error ? error.message : String(error);
          console.error(
            `[classify-vote-stances] Failed vote ${candidate.voteId}: ${msg}`,
          );
          await db.insert(pipelineItemLog).values({
            runId,
            itemType: 'vote',
            itemId: candidate.voteId,
            status: 'failed',
            durationMs: Date.now() - startMs,
            errorMessage: msg,
          });
        }
      }

      // Update pipeline run log
      await db
        .update(pipelineRunLog)
        .set({
          runStatus: failed > 0 && processed === 0 ? 'failed' : 'completed',
          completedAt: new Date(),
          itemsProcessed: processed,
          itemsFailed: failed,
          itemsSkipped: skipped,
          tokensUsed: tokensUsedToday,
          estimatedCostUsd: (tokensUsedToday / 1_000_000) * 3, // ~$3/M tokens for Sonnet
        })
        .where(eq(pipelineRunLog.id, runId));

      console.log(
        `[classify-vote-stances] Done: ${processed} classified, ${skipped} skipped, ${failed} failed, ${stancesCreated} new stances [${tokensUsedToday} tokens]`,
      );

      return {
        count: processed,
        checkpoint: {
          tokensUsedToday,
          lastRunDate: today,
          totalClassified,
          stancesCreated,
        } satisfies StanceClassificationCheckpoint,
      };
    } catch (error) {
      await db
        .update(pipelineRunLog)
        .set({
          runStatus: 'failed',
          completedAt: new Date(),
          errorSummary: error instanceof Error ? error.message : String(error),
        })
        .where(eq(pipelineRunLog.id, runId));
      throw error;
    }
  });
}

// ── Helper: get cached or fresh bill document text ───────

/**
 * Get bill document text, using the cache table (bill_classification_context)
 * to avoid re-reading PDFs on every classification run.
 */
async function getBillDocumentText(billId: number): Promise<string | null> {
  // Check cache first
  const [cached] = await db
    .select({ documentText: billClassificationContext.documentText })
    .from(billClassificationContext)
    .where(eq(billClassificationContext.billId, billId))
    .limit(1);

  if (cached) {
    return cached.documentText;
  }

  // Read document and cache
  try {
    const docs = await fetchBillDocuments(billId);
    if (docs.length === 0) {
      // Cache empty result to avoid re-reading
      await db
        .insert(billClassificationContext)
        .values({ billId, documentText: null })
        .onConflictDoNothing();
      return null;
    }

    // Try reading the highest-priority document
    for (const doc of docs) {
      const text = await readDocument(doc);
      if (text && text.length > 50) {
        const extractedText = extractExplanatoryNotes(text);

        // Cache the result
        await db
          .insert(billClassificationContext)
          .values({ billId, documentText: extractedText })
          .onConflictDoNothing();

        return extractedText;
      }
    }

    // No readable document found
    await db
      .insert(billClassificationContext)
      .values({ billId, documentText: null })
      .onConflictDoNothing();
    return null;
  } catch (error) {
    console.warn(
      `[classify-vote-stances] Failed to read docs for bill ${billId}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}
