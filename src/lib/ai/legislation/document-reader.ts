import { eq } from 'drizzle-orm';
import { appConfig } from '../../../../app.config';
import { db } from '../../db';
import { billDocuments } from '../../db/schema';
import { BillStage } from '../../knesset/bill-stages';

// ── Types ───────────────────────────────────────────────────────

export interface BillDocument {
  id: number;
  knessetDocId: number;
  billId: number | null;
  groupTypeId: number;
  groupTypeDesc: string;
  applicationDesc: string;
  filePath: string;
}

export interface DocumentReadResult {
  text: string;
  documentId: number;
  groupTypeId: number;
  stage: BillStage;
}

// ── GroupTypeID → BillStage mapping ─────────────────────────────

const DOC_TYPE_TO_STAGE: Record<number, BillStage> = {
  1: BillStage.PRELIMINARY,
  2: BillStage.FIRST_READING,
  3: BillStage.FIRST_READING,
  4: BillStage.SECOND_THIRD_READING,
  60: BillStage.COMMITTEE_SECOND,
  17: BillStage.SUBMITTED,
};

/**
 * Determine the BillStage a document belongs to.
 * Types 59 (background) and 12 (research) don't map to a specific stage
 * — returns null, and caller should use the bill's current stage.
 */
export function getDocumentStage(groupTypeId: number): BillStage | null {
  return DOC_TYPE_TO_STAGE[groupTypeId] ?? null;
}

// ── Fetch documents for a bill ──────────────────────────────────

/**
 * Fetch and sort bill documents by type priority (highest first).
 */
export async function fetchBillDocuments(
  billId: number,
): Promise<BillDocument[]> {
  const { typePriority } = appConfig.billSummary.documentReader;

  const docs = await db
    .select({
      id: billDocuments.id,
      knessetDocId: billDocuments.knessetDocId,
      billId: billDocuments.billId,
      groupTypeId: billDocuments.groupTypeId,
      groupTypeDesc: billDocuments.groupTypeDesc,
      applicationDesc: billDocuments.applicationDesc,
      filePath: billDocuments.filePath,
    })
    .from(billDocuments)
    .where(eq(billDocuments.billId, billId));

  // Sort by type priority (lower index = higher priority)
  const priorityMap = new Map(typePriority.map((id, idx) => [id, idx]));
  docs.sort(
    (a, b) =>
      (priorityMap.get(a.groupTypeId) ?? 999) -
      (priorityMap.get(b.groupTypeId) ?? 999),
  );

  return docs;
}

// ── Read document content ───────────────────────────────────────

/**
 * Read text content from a bill document.
 * - PDF → unpdf for local text extraction (no AI needed)
 * - DOC/DOCX → officeparser for local text extraction
 * - DOC/DOCX → officeparser for local text extraction
 */
export async function readDocument(doc: BillDocument): Promise<string | null> {
  const ext = doc.applicationDesc.toLowerCase();

  try {
    if (ext === 'pdf') {
      return await readPdfWithPdfParse(doc.filePath);
    } else if (ext === 'doc' || ext === 'docx') {
      return await readDocWithOfficeparser(doc.filePath);
    } else {
      console.warn(
        `[doc-reader] Unsupported format "${ext}" for doc ${doc.knessetDocId}`,
      );
      return null;
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(
      `[doc-reader] Failed to read doc ${doc.knessetDocId} (${ext}): ${msg}`,
    );
    return null;
  }
}

/**
 * Read a PDF document using unpdf for local text extraction (no AI needed).
 */
async function readPdfWithPdfParse(url: string): Promise<string | null> {
  // Download PDF
  const response = await fetch(url, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    console.warn(`[doc-reader] PDF fetch failed: ${response.status} ${url}`);
    return null;
  }
  const pdfBuffer = new Uint8Array(await response.arrayBuffer());

  const { extractText } = await import('unpdf');
  const { text } = await extractText(pdfBuffer, { mergePages: true });

  return text?.trim() || null;
}

/**
 * Read a DOC/DOCX file using officeparser (local text extraction, no AI).
 */
async function readDocWithOfficeparser(url: string): Promise<string | null> {
  const officeparser = await import('officeparser');
  const parseOffice =
    officeparser.parseOffice ?? officeparser.default?.parseOffice;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    console.warn(`[doc-reader] DOC fetch failed: ${response.status} ${url}`);
    return null;
  }
  const buffer = Buffer.from(await response.arrayBuffer());

  const result = await parseOffice(buffer);
  let text: string;
  if (typeof result === 'string') {
    text = result;
  } else if (result && typeof result === 'object') {
    const obj = result as unknown as {
      toText?: () => string;
      content?: string;
    };
    text =
      typeof obj.toText === 'function'
        ? obj.toText()
        : (obj.content ?? String(result));
  } else {
    text = String(result ?? '');
  }
  return text.trim() || null;
}

// ── Extract explanatory notes ───────────────────────────────────

/**
 * Extract the "דברי הסבר" (explanatory notes) section from bill text.
 * This section describes the bill's purpose and impact — the most valuable part.
 * Falls back to the full text if no section is found.
 */
export function extractExplanatoryNotes(
  fullText: string,
  maxChars?: number,
): string {
  const limit =
    maxChars ?? appConfig.billSummary.documentReader.maxDocumentChars;

  // Common headings for explanatory notes
  const patterns = [
    /דברי[\s\u200f]*הסבר/i,
    /הסבר[\s\u200f]*להצעת[\s\u200f]*חוק/i,
    /explanatory[\s]*notes/i,
  ];

  for (const pattern of patterns) {
    const match = fullText.match(pattern);
    if (match && match.index !== undefined) {
      const extracted = fullText.slice(match.index);
      return extracted.slice(0, limit);
    }
  }

  // No explanatory notes section found — return from the beginning
  return fullText.slice(0, limit);
}

// ── Background document relevance check ─────────────────────────

/** Document types that are official bill texts (not background/research) */
const OFFICIAL_DOC_TYPES = new Set([1, 2, 3, 4, 17, 60]);

/** Document types that are background/research material */
const BACKGROUND_DOC_TYPES = new Set([59, 12]);

/**
 * Quick keyword-based relevance check for background/research documents.
 * Extracts key terms from the bill name and checks whether they appear in the
 * document text. Returns false when the document is clearly unrelated to the
 * bill (e.g. a comparative-law paper about Sierra Leone attached to an Israeli
 * criminal-law bill), so we can skip sending it to the AI and save tokens.
 */
export function isDocumentRelevant(
  billName: string,
  documentText: string,
  minMatches = 2,
): boolean {
  // Extract meaningful Hebrew words (≥3 chars) from the bill name,
  // excluding common legal boilerplate
  const boilerplate = new Set([
    'הצעת',
    'חוק',
    'תיקון',
    'הוראת',
    'שעה',
    'התשפ',
    'מספר',
  ]);
  const words = billName
    .replace(/[^א-תa-zA-Z\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !boilerplate.has(w));

  if (words.length === 0) return true; // can't check, allow through

  const lowerDoc = documentText.toLowerCase();
  let matches = 0;
  for (const word of words) {
    if (lowerDoc.includes(word.toLowerCase())) {
      matches++;
      if (matches >= minMatches) return true;
    }
  }

  return false;
}

// ── Main entry points ───────────────────────────────────────────

/**
 * Read the highest-priority document for a bill and extract context.
 * Returns the document text (preferring דברי הסבר), the document metadata,
 * and the legislative stage the document belongs to.
 *
 * Background/research docs (types 59, 12) are skipped when official bill
 * documents exist. When they are the only option, a keyword relevance check
 * filters out clearly unrelated material to avoid wasting AI tokens.
 */
export async function readBillDocumentContext(
  billId: number,
  billName?: string,
): Promise<DocumentReadResult | null> {
  const docs = await fetchBillDocuments(billId);
  if (docs.length === 0) return null;

  const hasOfficialDocs = docs.some((d) =>
    OFFICIAL_DOC_TYPES.has(d.groupTypeId),
  );

  // Try documents in priority order until one succeeds
  for (const doc of docs) {
    // Skip background/research docs when official bill texts exist
    if (hasOfficialDocs && BACKGROUND_DOC_TYPES.has(doc.groupTypeId)) {
      console.log(
        `[doc-reader] Skipping background doc ${doc.knessetDocId} (type ${doc.groupTypeId}) — official docs available`,
      );
      continue;
    }

    const rawText = await readDocument(doc);
    if (!rawText) continue;

    // For background docs, check relevance before spending AI tokens
    if (BACKGROUND_DOC_TYPES.has(doc.groupTypeId) && billName) {
      if (!isDocumentRelevant(billName, rawText)) {
        console.log(
          `[doc-reader] Skipping irrelevant background doc ${doc.knessetDocId} ` +
            `(type ${doc.groupTypeId}) — bill keywords not found in document`,
        );
        continue;
      }
    }

    const text = extractExplanatoryNotes(rawText);
    const stage = getDocumentStage(doc.groupTypeId) ?? BillStage.SUBMITTED;

    console.log(
      `[doc-reader] Read doc ${doc.knessetDocId} (type ${doc.groupTypeId}: ${doc.groupTypeDesc}) ` +
        `→ ${text.length} chars, stage ${stage}`,
    );

    return {
      text,
      documentId: doc.id,
      groupTypeId: doc.groupTypeId,
      stage,
    };
  }

  return null;
}

// ── Multi-document reader (parliamentary-lawyer mode) ───────────

export interface MultiDocReadResult {
  /** All official bill-text docs read, ordered by stage descending (latest first). */
  docs: Array<
    DocumentReadResult & {
      groupTypeDesc: string;
      knessetDocId: number;
    }
  >;
  /** The highest-stage doc — the one that governs the current version of the bill. */
  primary: DocumentReadResult & {
    groupTypeDesc: string;
    knessetDocId: number;
  };
  /** Total characters across all read docs (after truncation). */
  totalChars: number;
}

/**
 * Read ALL official bill-text documents (left column on the Knesset bill page)
 * for parliamentary-lawyer-grade summarization. The AI receives each document
 * labeled with its legislative stage so it can reason about bill evolution
 * and the reservations embedded in the 2nd/3rd reading doc.
 *
 * Background/research docs (types 59, 12 — committee minutes, research) are
 * EXCLUDED when any official doc exists. When no official doc exists, falls
 * back to the single-doc reader.
 *
 * Budget: each doc is truncated to `maxDocumentChars`; we then stop adding
 * further docs once the combined budget is reached.
 */
export async function readAllOfficialBillDocuments(
  billId: number,
  billName?: string,
): Promise<MultiDocReadResult | null> {
  const { maxDocumentChars } = appConfig.billSummary.documentReader;
  const allDocs = await fetchBillDocuments(billId);
  if (allDocs.length === 0) return null;

  const officialDocs = allDocs.filter((d) =>
    OFFICIAL_DOC_TYPES.has(d.groupTypeId),
  );

  // No official docs → defer to single-doc reader (which handles background relevance)
  if (officialDocs.length === 0) {
    const single = await readBillDocumentContext(billId, billName);
    if (!single) return null;
    const meta = allDocs.find((d) => d.id === single.documentId);
    const enriched = {
      ...single,
      groupTypeDesc: meta?.groupTypeDesc ?? '',
      knessetDocId: meta?.knessetDocId ?? 0,
    };
    return {
      docs: [enriched],
      primary: enriched,
      totalChars: single.text.length,
    };
  }

  // Read all official docs, sorted by stage DESC so the latest comes first
  const readResults: MultiDocReadResult['docs'] = [];
  let budgetRemaining = maxDocumentChars * 3; // allow up to 3× single-doc budget across multi

  // Sort by DOC_TYPE_TO_STAGE descending (latest stage first)
  const stageOf = (id: number) => DOC_TYPE_TO_STAGE[id] ?? BillStage.SUBMITTED;
  const sortedDocs = [...officialDocs].sort(
    (a, b) => stageOf(b.groupTypeId) - stageOf(a.groupTypeId),
  );

  for (const doc of sortedDocs) {
    if (budgetRemaining <= 500) break; // not worth reading if almost no budget left

    const rawText = await readDocument(doc);
    if (!rawText) continue;

    // For the latest-stage doc we keep reservations (which appear at the end);
    // for earlier-stage docs we prefer explanatory notes (דברי הסבר).
    const stage = stageOf(doc.groupTypeId);
    const isLatest = readResults.length === 0;
    const perDocLimit = Math.min(maxDocumentChars, budgetRemaining);
    const text = isLatest
      ? truncateLatestStageDoc(rawText, perDocLimit)
      : extractExplanatoryNotes(rawText, perDocLimit);

    readResults.push({
      text,
      documentId: doc.id,
      groupTypeId: doc.groupTypeId,
      stage,
      groupTypeDesc: doc.groupTypeDesc,
      knessetDocId: doc.knessetDocId,
    });
    budgetRemaining -= text.length;

    console.log(
      `[doc-reader:multi] Read doc ${doc.knessetDocId} (type ${doc.groupTypeId}: ${doc.groupTypeDesc}) ` +
        `stage ${stage} → ${text.length} chars${isLatest ? ' [primary]' : ''}`,
    );
  }

  if (readResults.length === 0) return null;

  return {
    docs: readResults,
    primary: readResults[0],
    totalChars: readResults.reduce((sum, d) => sum + d.text.length, 0),
  };
}

/**
 * For the latest-stage document, the final section typically contains the
 * הסתייגויות (reservations). If the text is within budget we keep it all;
 * otherwise we try to keep BOTH the opening (main bill text + explanatory
 * notes) AND the closing (reservations) sections at the expense of the middle.
 */
function truncateLatestStageDoc(fullText: string, limit: number): string {
  if (fullText.length <= limit) return fullText;

  // Find the reservations section to ensure we keep it
  const reservationsMatch = fullText.match(
    /הסתייגויות(?:\s+ובקשות\s+רשות\s+דיבור)?/,
  );
  if (!reservationsMatch || reservationsMatch.index === undefined) {
    // No reservations section found — keep from explanatory notes forward
    return extractExplanatoryNotes(fullText, limit);
  }

  const reservationsStart = reservationsMatch.index;
  // Reserve ~40% of the budget for the reservations tail
  const reservationsBudget = Math.floor(limit * 0.4);
  const bodyBudget = limit - reservationsBudget - 50; // 50 chars for separator

  const body = extractExplanatoryNotes(
    fullText.slice(0, reservationsStart),
    bodyBudget,
  );
  const reservations = fullText.slice(
    reservationsStart,
    reservationsStart + reservationsBudget,
  );

  return `${body}\n\n--- [TRUNCATED — jumping to reservations section] ---\n\n${reservations}`;
}
