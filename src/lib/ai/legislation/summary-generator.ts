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
  readBillDocumentContext,
  type DocumentReadResult,
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
    // Try to find JSON object in the text
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

export interface SummaryResult {
  billId: number;
  summary: Record<string, string> | null;
  topics: Record<string, string[]> | null;
  tokensUsed: number;
  /** Budget bill type detected, if any */
  budgetType: BudgetBillType;
  /** Legislative stage this summary belongs to (from document type) */
  stage: BillStage | null;
  /** ID of the source document in bill_documents table */
  sourceDocId: number | null;
  /** GroupTypeID of the source document */
  sourceDocType: number | null;
}

/**
 * Generate an AI summary for a single bill using Claude + Tavily web search.
 * First searches the web via Tavily for concise snippets, then feeds them
 * as context to Claude in a single generation call (no multi-step tools).
 * This reduces token usage by ~9x compared to provider-level web search.
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

  // Detect budget/economic-plan bill type
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

  // Step 1: Try to read official document from bill_documents
  let docResult: DocumentReadResult | null = null;
  try {
    docResult = await readBillDocumentContext(bill.id);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(
      `[bill-summary] Document reading failed for bill ${bill.knessetId}: ${msg}`,
    );
  }

  // Step 2: Search the web for context about this bill
  const searchResults = await searchBillContext(
    bill.name,
    bill.knessetNum,
    knessetUrl,
  );

  // Build context from search results
  let webContext = '';
  if (searchResults.length > 0) {
    webContext =
      '\n\nWEB SEARCH RESULTS:\n' +
      searchResults
        .map(
          (r, i) =>
            `[${i + 1}] ${r.title}\n    URL: ${r.url}\n    ${r.content}`,
        )
        .join('\n\n');
  }

  // Build document context (NEW — from actual bill PDFs/DOCs)
  let documentContext = '';
  if (docResult) {
    documentContext = `\n\nOFFICIAL BILL DOCUMENT (${docResult.groupTypeId === 1 ? 'דיון מוקדם' : docResult.groupTypeId === 2 ? 'קריאה ראשונה' : docResult.groupTypeId === 4 ? "קריאה ב'+ג'" : 'מסמך רשמי'}):
The following is the actual text of the bill (or its explanatory notes).
Use this as the PRIMARY source for your summary. Web search results serve as SUPPLEMENTARY context only.

--- BEGIN DOCUMENT ---
${docResult.text}
--- END DOCUMENT ---`;
  }

  // Build budget-specific context for the prompt
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

  const prompt = `Generate a summary for this Israeli bill:

- Bill Name: ${bill.name}
- Knesset: ${bill.knessetNum ?? 'unknown'}
- Type: ${bill.billType ?? 'unknown'}
- Status: ${bill.status ?? 'unknown'}
- Proposed Date: ${bill.proposedDate ?? 'unknown'}
- Official Knesset Page: ${knessetUrl}

Focus on the bill's LATEST version — if it went through committee discussions or readings, describe the current state, not just the original proposal.${budgetContext}${documentContext}${webContext}`;

  // Parent omnibus bills need more output tokens for the broader overview
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

  if (trimmed === 'NO_SUMMARY' || trimmed.length < 10) {
    console.log(
      `[bill-summary] No summary generated for bill ${bill.knessetId} (${bill.name})`,
    );
    return {
      billId: bill.id,
      summary: null,
      topics: null,
      tokensUsed,
      budgetType,
      stage: docResult?.stage ?? null,
      sourceDocId: docResult?.documentId ?? null,
      sourceDocType: docResult?.groupTypeId ?? null,
    };
  }

  // Parse JSON response: { summary: {he, en, ar, ru}, topics: {he: [...], ...} }
  let summary: Record<string, string> | null = null;
  let topics: Record<string, string[]> | null = null;

  const parsed = extractJson(trimmed) as Record<string, unknown> | null;
  if (parsed && typeof parsed === 'object') {
    // Validate summary object has at least Hebrew
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

    // Validate topics object
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
    // Complete fallback: no JSON at all, store as Hebrew plain text
    summary = { he: trimmed };
  }

  if (!summary || !summary.he || summary.he.length < 10) {
    return {
      billId: bill.id,
      summary: null,
      topics: null,
      tokensUsed,
      budgetType,
      stage: docResult?.stage ?? null,
      sourceDocId: docResult?.documentId ?? null,
      sourceDocType: docResult?.groupTypeId ?? null,
    };
  }

  console.log(
    `[bill-summary] Generated summary for bill ${bill.knessetId}: ${summary.he.slice(0, 80)}...` +
      ` [${Object.keys(summary).length} langs]` +
      (topics ? ` [${Object.keys(topics).length} lang topics]` : '') +
      (budgetType ? ` [budget:${budgetType}]` : '') +
      (docResult
        ? ` [doc:type${docResult.groupTypeId}→stage${docResult.stage}]`
        : '') +
      (searchResults.length ? ` (${searchResults.length} web sources)` : '') +
      ` [${tokensUsed} tokens]`,
  );

  return {
    billId: bill.id,
    summary,
    topics,
    tokensUsed,
    budgetType,
    stage: docResult?.stage ?? null,
    sourceDocId: docResult?.documentId ?? null,
    sourceDocType: docResult?.groupTypeId ?? null,
  };
}
