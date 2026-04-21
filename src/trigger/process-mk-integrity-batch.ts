/**
 * Trigger.dev tasks: Per-MK integrity web-search pipeline.
 *
 * Parent task `processMkIntegrityAll` fetches all current MKs
 * (Knesset 25), splits into batches of N (default 10), and fans out
 * child `processMkIntegrityBatch` runs via batchTriggerAndWait.
 *
 * Each child runs Tavily + Claude per-MK, then upserts into
 * `integrity_cases` with verified=false. Non-government sources always
 * route to admin review regardless of confidence.
 */
import { task, logger } from '@trigger.dev/sdk';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { appConfig } from '../../app.config';
import { db } from '@/lib/db';
import { members, integrityCases } from '@/lib/db/schema';
import {
  searchMkIntegrity,
  analyzeWebSnippets,
  type WebIntegrityEvent,
} from '@/lib/ai/integrity/web-search-integrity';

const MkInputSchema = z.object({
  memberId: z.number().int(),
  knessetId: z.number().int(),
  firstName: z.string(),
  lastName: z.string(),
});
type MkInput = z.infer<typeof MkInputSchema>;

const BatchInputSchema = z.object({
  members: z.array(MkInputSchema).min(1).max(50),
});

const ParentInputSchema = z.object({
  knessetNum: z.number().int().default(25),
  batchSize: z.number().int().min(1).max(50).optional(),
  /** Optional override: process only this subset of member IDs. */
  onlyMemberIds: z.array(z.number().int()).optional(),
});

interface MkResult {
  memberId: number;
  name: string;
  snippetsFound: number;
  eventsExtracted: number;
  casesInserted: number;
  autoVerified: number;
  routedToReview: number;
  error?: string;
}

export const processMkIntegrityBatch = task({
  id: 'process-mk-integrity-batch',
  maxDuration: 1800, // 30 min per 10-MK batch
  retry: {
    maxAttempts: 2,
    factor: 2,
    minTimeoutInMs: 30_000,
    maxTimeoutInMs: 300_000,
  },
  queue: {
    // Cap concurrent batches to protect Tavily + Anthropic rate limits.
    concurrencyLimit: 2,
  },
  run: async (raw: unknown): Promise<{ results: MkResult[] }> => {
    const { members: mkList } = BatchInputSchema.parse(raw);
    logger.info(`[integrity-batch] Processing ${mkList.length} MKs`);

    const results: MkResult[] = [];
    for (const mk of mkList) {
      results.push(await processSingleMk(mk));
    }

    logger.info('[integrity-batch] Batch complete', {
      summary: results.map((r) => ({
        name: r.name,
        cases: r.casesInserted,
        reviewed: r.routedToReview,
      })),
    });
    return { results };
  },
});

export const processMkIntegrityAll = task({
  id: 'process-mk-integrity-all',
  maxDuration: 3600,
  queue: { concurrencyLimit: 1 },
  run: async (raw: unknown) => {
    const input = ParentInputSchema.parse(raw ?? {});
    const { knessetNum, batchSize: overrideBatchSize, onlyMemberIds } = input;
    const batchSize =
      overrideBatchSize ?? appConfig.integrity.webSearch.batchSize;

    // Fetch current MKs for the target Knesset
    const rows = await db
      .select({
        memberId: members.id,
        knessetId: members.knessetId,
        firstName: members.firstName,
        lastName: members.lastName,
        isCurrent: members.isCurrent,
        knessetNum: members.knessetNum,
      })
      .from(members)
      .where(eq(members.isCurrent, true));

    let candidates: MkInput[] = rows
      .filter((r) => r.knessetNum === knessetNum || r.knessetNum === null)
      .map((r) => ({
        memberId: r.memberId,
        knessetId: r.knessetId,
        firstName: r.firstName,
        lastName: r.lastName,
      }));

    if (onlyMemberIds && onlyMemberIds.length > 0) {
      const allow = new Set(onlyMemberIds);
      candidates = candidates.filter((c) => allow.has(c.memberId));
    }

    logger.info(
      `[integrity-all] K${knessetNum}: ${candidates.length} MKs, batchSize=${batchSize}`,
    );

    if (candidates.length === 0) {
      return { totalMks: 0, batches: 0, results: [] };
    }

    // Split into batches
    const batches: MkInput[][] = [];
    for (let i = 0; i < candidates.length; i += batchSize) {
      batches.push(candidates.slice(i, i + batchSize));
    }

    logger.info(`[integrity-all] Fanning out ${batches.length} batches`);

    const batchRun = await processMkIntegrityBatch.batchTriggerAndWait(
      batches.map((members) => ({ payload: { members } })),
    );

    const allResults: MkResult[] = [];
    for (const run of batchRun.runs) {
      if (run.ok) {
        allResults.push(...run.output.results);
      } else {
        logger.error(`[integrity-all] Child batch failed: ${run.error}`);
      }
    }

    const totals = allResults.reduce(
      (acc, r) => {
        acc.casesInserted += r.casesInserted;
        acc.autoVerified += r.autoVerified;
        acc.routedToReview += r.routedToReview;
        return acc;
      },
      { casesInserted: 0, autoVerified: 0, routedToReview: 0 },
    );

    logger.info('[integrity-all] Complete', {
      totalMks: candidates.length,
      batches: batches.length,
      ...totals,
    });

    return {
      totalMks: candidates.length,
      batches: batches.length,
      ...totals,
      results: allResults,
    };
  },
});

async function processSingleMk(mk: MkInput): Promise<MkResult> {
  const fullName = `${mk.firstName} ${mk.lastName}`.trim();
  const base: MkResult = {
    memberId: mk.memberId,
    name: fullName,
    snippetsFound: 0,
    eventsExtracted: 0,
    casesInserted: 0,
    autoVerified: 0,
    routedToReview: 0,
  };

  try {
    const snippets = await searchMkIntegrity(fullName);
    base.snippetsFound = snippets.length;
    if (snippets.length === 0) {
      logger.info(`[integrity:mk] ${fullName} — no snippets`);
      return base;
    }

    const events = await analyzeWebSnippets(fullName, snippets);
    base.eventsExtracted = events.length;
    if (events.length === 0) {
      logger.info(
        `[integrity:mk] ${fullName} — ${snippets.length} snippets, 0 events extracted`,
      );
      return base;
    }

    const { governmentDomains, confidenceThreshold } =
      appConfig.integrity.webSearch;
    const govSet = new Set(governmentDomains);

    for (const ev of events) {
      const domain = ev.metadata?.domain ?? '';
      const isGovSource = [...govSet].some(
        (d) => domain === d || domain.endsWith('.' + d),
      );

      // Route to review: non-government source OR low confidence.
      const autoVerify = isGovSource && ev.confidence >= confidenceThreshold;

      const inserted = await db
        .insert(integrityCases)
        .values({
          memberId: mk.memberId,
          category: ev.category,
          severity: (ev.severity as string) ?? 'info',
          status: (ev.status as string) ?? 'reported',
          title: ev.description.substring(0, 200),
          titleEn: ev.description_en?.substring(0, 200) ?? null,
          description: ev.description,
          descriptionEn: ev.description_en ?? null,
          sourceType: isGovSource
            ? mapGovDomainToSourceType(domain)
            : 'web_search',
          sourceName: ev.metadata?.source_title ?? domain,
          sourceUrl: ev.metadata?.source_url ?? null,
          sourceDocId: null,
          eventDate: ev.event_date,
          decision: ev.decision ?? null,
          sanctionType: ev.sanction_type ?? null,
          financialAmount:
            ev.financial_amount != null ? String(ev.financial_amount) : null,
          metadata: ev.metadata as Record<string, unknown>,
          aiSummary: ev.description,
          aiConfidence: ev.confidence,
          verified: autoVerify,
          verifiedBy: autoVerify ? 'auto:gov-source' : null,
          verifiedAt: autoVerify ? new Date() : null,
        })
        .returning({ id: integrityCases.id });

      if (inserted.length > 0) {
        base.casesInserted++;
        if (autoVerify) base.autoVerified++;
        else base.routedToReview++;
      }
    }

    logger.info(
      `[integrity:mk] ${fullName} — ${base.casesInserted} cases inserted ` +
        `(${base.autoVerified} auto-verified, ${base.routedToReview} pending)`,
    );
    return base;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[integrity:mk] ${fullName} failed: ${message}`);
    return { ...base, error: message };
  }
}

function mapGovDomainToSourceType(domain: string): string {
  if (domain.includes('mevaker.gov.il')) return 'state_comptroller';
  if (domain.includes('court.gov.il')) return 'court_ruling';
  if (domain.includes('justice.gov.il')) return 'government_registry';
  if (domain.includes('knesset.gov.il')) return 'knesset_ethics_committee';
  return 'government_registry';
}
