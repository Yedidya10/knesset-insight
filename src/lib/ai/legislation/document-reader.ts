import { eq, and, inArray, sql } from 'drizzle-orm';
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
 * - PDF → Gemini Flash for OCR/text extraction
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
    text =
      typeof result.toText === 'function'
        ? result.toText()
        : (result.content ?? String(result));
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

// ── Main entry point ────────────────────────────────────────────

/**
 * Read the highest-priority document for a bill and extract context.
 * Returns the document text (preferring דברי הסבר), the document metadata,
 * and the legislative stage the document belongs to.
 */
export async function readBillDocumentContext(
  billId: number,
): Promise<DocumentReadResult | null> {
  const docs = await fetchBillDocuments(billId);
  if (docs.length === 0) return null;

  // Try documents in priority order until one succeeds
  for (const doc of docs) {
    const rawText = await readDocument(doc);
    if (!rawText) continue;

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
