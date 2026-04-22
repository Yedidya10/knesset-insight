import { generateText } from 'ai';
import { appConfig } from '../../../../app.config';
import { getSummaryModel } from './summary-provider';
import {
  BILL_SUMMARY_SKILL,
  BUDGET_CHAPTER_CONTEXT,
  BUDGET_PARENT_CONTEXT,
} from './skills/bill-summary';
import { searchBillContext } from './web-search';
import {
  detectBudgetBillType,
  extractChapterTopic,
  type BudgetBillType,
} from './budget-bill-utils';
import {
  readAllOfficialBillDocuments,
  type MultiDocReadResult,
} from './document-reader';
import { BillStage } from '../../knesset/bill-stages';

/**
 * Extract a JSON object from text that may contain preamble text before/after.
 * Tries direct parse first, then looks for { ... } in the string.
 */
function extractJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

export interface BillForSummary {
  id: number;
  knessetId: number;
  name: string;
  knessetNum: number | null;
  billType: string | null;
  status: string | null;
  proposedDate: string | null;
}

/** Quality/provenance of the summary source — tracked in bill metadata. */
export type SummarySourceType =
  | 'documents' // Generated from one or more official bill documents (highest quality)
  | 'web' // No documents available; based on web search only
  | 'metadata_only'; // Neither documents nor web — just bill name/type/status

export interface SummaryResult {
  billId: number;
  summary: Record<string, string> | null;
  topics: Record<string, string[]> | null;
  tokensUsed: number;
  budgetType: BudgetBillType;
  /** Legislative stage of the primary (latest) source document, if any. */
  stage: BillStage | null;
  /** ID of the primary source document in bill_documents table. */
  sourceDocId: number | null;
  /** GroupTypeID of the primary source document. */
  sourceDocType: number | null;
  /** Provenance/quality indicator — tracks what sources were available. */
  sourceType: SummarySourceType;
  /** Number of official bill-text documents read (primary + earlier stages). */
  docsRead: number;
}

const DOC_TYPE_LABEL: Record<number, string> = {
  1: 'דיון מוקדם',
  2: 'קריאה ראשונה',
  3: 'קריאה ראשונה',
  4: 'קריאה שנייה ושלישית',
  60: 'ועדה לקראת קריאה שנייה',
  17: 'הונח על שולחן הכנסת',
};

/**
 * Generate an AI summary for a single bill as a parliamentary lawyer would.
 * Reads ALL official bill-text documents (multi-stage), preferring the latest
 * version which usually embeds the reservations (הסתייגויות) section.
 *
 * @param bill - The bill to summarize
 * @param chapterNames - For parent omnibus bills, the names of split chapters from the DB
 */
export async function generateBillSummary(
  bill: BillForSummary,
  chapterNames?: string[],
): Promise<SummaryResult> {
  const model = getSummaryModel();
  const { maxTokens } = appConfig.billSummary.ai;

  const budgetType = detectBudgetBillType(bill.name);
  const chapterTopic =
    budgetType === 'chapter' ? extractChapterTopic(bill.name) : null;

  if (budgetType) {
    console.log(
      `[bill-summary] Budget bill detected: type=${budgetType}` +
        (chapterTopic ? ` topic="${chapterTopic}"` : ''),
    );
  }

  const knessetUrl = `https://main.knesset.gov.il/Activity/Legislation/Laws/Pages/LawBill.aspx?t=LawsTable&lawItemID=${bill.knessetId}`;

  // Step 1: Read all official bill documents (multi-doc lawyer mode)
  let multiDoc: MultiDocReadResult | null = null;
  try {
    multiDoc = await readAllOfficialBillDocuments(bill.id, bill.name);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(
      `[bill-summary] Document reading failed for bill ${bill.knessetId}: ${msg}`,
    );
  }

  // Step 2: Search the web for supplementary context
  const searchResults = await searchBillContext(
    bill.name,
    bill.knessetNum,
    knessetUrl,
  );

  // Build web context
  let webContext = '';
  if (searchResults.length > 0) {
    webContext =
      '\n\nWEB SEARCH RESULTS (supplementary only):\n' +
      searchResults
        .map(
          (r, i) =>
            `[${i + 1}] ${r.title}\n    URL: ${r.url}\n    ${r.content}`,
        )
        .join('\n\n');
  }

  // Build multi-document context — earliest stage first for chronological reading
  let documentContext = '';
  if (multiDoc && multiDoc.docs.length > 0) {
    const docsChronological = [...multiDoc.docs].reverse(); // earliest first
    const sections = docsChronological.map((d) => {
      const label = DOC_TYPE_LABEL[d.groupTypeId] ?? `סוג ${d.groupTypeId}`;
      const isPrimary = d.knessetDocId === multiDoc.primary.knessetDocId;
      const header = isPrimary
        ? `=== PRIMARY DOCUMENT — stage ${d.stage} (${label}) — THIS IS THE LATEST VERSION; RESERVATIONS ARE EMBEDDED AT THE END ===`
        : `=== EARLIER STAGE ${d.stage} (${label}) — for context, DO NOT treat as current ===`;
      return `${header}\n${d.text}`;
    });

    documentContext = `\n\nOFFICIAL BILL DOCUMENTS (${multiDoc.docs.length} stage${multiDoc.docs.length === 1 ? '' : 's'} read, ${multiDoc.totalChars} chars total):
These are the PRIMARY SOURCES for your summary. Web search results are supplementary only.

--- BEGIN DOCUMENTS ---
${sections.join('\n\n')}
--- END DOCUMENTS ---`;
  }

  // Budget-specific context
  let budgetContext = '';
  if (budgetType === 'chapter') {
    budgetContext = BUDGET_CHAPTER_CONTEXT;
    if (chapterTopic) {
      budgetContext += `\nThe chapter topic extracted from the bill name is: "${chapterTopic}"`;
    }
  } else if (budgetType === 'parent') {
    budgetContext = BUDGET_PARENT_CONTEXT;
    if (chapterNames && chapterNames.length > 0) {
      budgetContext +=
        '\n\nKNOWN CHAPTERS split from this omnibus bill:\n' +
        chapterNames.map((name, i) => `${i + 1}. ${name}`).join('\n');
    }
  }

  const prompt = `Generate a parliamentary-lawyer summary for this Israeli bill:

- Bill Name: ${bill.name}
- Knesset: ${bill.knessetNum ?? 'unknown'}
- Type: ${bill.billType ?? 'unknown'}
- Status: ${bill.status ?? 'unknown'}
- Proposed Date: ${bill.proposedDate ?? 'unknown'}
- Official Knesset Page: ${knessetUrl}

Describe the bill's CURRENT/LATEST version. If the primary document contains an embedded הסתייגויות section, analyze those reservations per the skill rules.${budgetContext}${documentContext}${webContext}`;

  // Parent omnibus bills need more output tokens
  const effectiveMaxTokens =
    budgetType === 'parent' ? maxTokens * 2 : maxTokens;

  const { text, usage } = await generateText({
    model,
    maxOutputTokens: effectiveMaxTokens,
    system: BILL_SUMMARY_SKILL,
    prompt,
  });

  const tokensUsed = usage?.totalTokens ?? 0;
  const trimmed = text.trim();

  // Determine provenance for telemetry
  const sourceType: SummarySourceType = multiDoc
    ? 'documents'
    : searchResults.length > 0
      ? 'web'
      : 'metadata_only';

  const baseResult = {
    billId: bill.id,
    tokensUsed,
    budgetType,
    stage: multiDoc?.primary.stage ?? null,
    sourceDocId: multiDoc?.primary.documentId ?? null,
    sourceDocType: multiDoc?.primary.groupTypeId ?? null,
    sourceType,
    docsRead: multiDoc?.docs.length ?? 0,
  };

  if (trimmed === 'NO_SUMMARY' || trimmed.length < 10) {
    console.log(
      `[bill-summary] No summary generated for bill ${bill.knessetId} (${bill.name})`,
    );
    return { ...baseResult, summary: null, topics: null };
  }

  // Parse JSON response
  let summary: Record<string, string> | null = null;
  let topics: Record<string, string[]> | null = null;

  const parsed = extractJson(trimmed) as Record<string, unknown> | null;
  if (parsed && typeof parsed === 'object') {
    if (
      parsed.summary &&
      typeof parsed.summary === 'object' &&
      !Array.isArray(parsed.summary) &&
      (parsed.summary as Record<string, string>).he
    ) {
      summary = parsed.summary as Record<string, string>;
    } else if (typeof parsed.summary === 'string') {
      summary = { he: parsed.summary };
    }

    if (
      parsed.topics &&
      typeof parsed.topics === 'object' &&
      !Array.isArray(parsed.topics)
    ) {
      topics = {};
      for (const [lang, tags] of Object.entries(
        parsed.topics as Record<string, unknown>,
      )) {
        if (Array.isArray(tags)) {
          topics[lang] = (tags as unknown[]).filter(
            (t): t is string => typeof t === 'string' && t.length > 0,
          );
        }
      }
      if (Object.keys(topics).length === 0) topics = null;
    } else if (Array.isArray(parsed.topics)) {
      topics = {
        he: (parsed.topics as unknown[]).filter(
          (t): t is string => typeof t === 'string' && t.length > 0,
        ),
      };
    }
  } else {
    summary = { he: trimmed };
  }

  if (!summary || !summary.he || summary.he.length < 10) {
    return { ...baseResult, summary: null, topics: null };
  }

  console.log(
    `[bill-summary] Generated summary for bill ${bill.knessetId}: ${summary.he.slice(0, 80)}...` +
      ` [${Object.keys(summary).length} langs]` +
      (topics ? ` [${Object.keys(topics).length} lang topics]` : '') +
      (budgetType ? ` [budget:${budgetType}]` : '') +
      (multiDoc
        ? ` [docs:${multiDoc.docs.length}, primary:type${multiDoc.primary.groupTypeId}→stage${multiDoc.primary.stage}]`
        : '') +
      ` [src:${sourceType}]` +
      (searchResults.length ? ` (${searchResults.length} web sources)` : '') +
      ` [${tokensUsed} tokens]`,
  );

  return { ...baseResult, summary, topics };
}
