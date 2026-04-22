import { NextResponse } from 'next/server';
import { inArray } from 'drizzle-orm';
import { isAdmin } from '@/lib/auth/admin';
import { db } from '@/lib/db';
import { bills } from '@/lib/db/schema';
import { processBillSummary } from '@/pipeline/jobs/generate-bill-summaries';

export const runtime = 'nodejs';
export const maxDuration = 800;

const MAX_BILLS_PER_BATCH = 25;

/**
 * POST /api/admin/bills/regenerate-summaries
 * Body: { billIds: number[] }
 * Bulk regenerates AI summaries for the selected bills. Admin-only.
 * Bills with an official Knesset summary are skipped (official text wins).
 * Returns per-bill outcomes.
 */
export async function POST(req: Request) {
  const authorized = await isAdmin();
  if (!authorized) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const billIds = (body as { billIds?: unknown })?.billIds;
  if (!Array.isArray(billIds) || billIds.length === 0) {
    return NextResponse.json(
      { error: 'billIds must be a non-empty array' },
      { status: 400 },
    );
  }
  if (billIds.length > MAX_BILLS_PER_BATCH) {
    return NextResponse.json(
      {
        error: 'too_many_bills',
        message: `Max ${MAX_BILLS_PER_BATCH} bills per batch`,
      },
      { status: 400 },
    );
  }

  const normalizedIds = billIds
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (normalizedIds.length === 0) {
    return NextResponse.json({ error: 'no_valid_bill_ids' }, { status: 400 });
  }

  const rows = await db
    .select({
      id: bills.id,
      knessetId: bills.knessetId,
      name: bills.name,
      knessetNum: bills.knessetNum,
      billType: bills.billType,
      status: bills.status,
      proposedDate: bills.proposedDate,
      summary: bills.summary,
      metadata: bills.metadata,
    })
    .from(bills)
    .where(inArray(bills.id, normalizedIds));

  const results: Array<{
    billId: number;
    status: 'ok' | 'skipped_official' | 'no_summary' | 'error';
    tokensUsed?: number;
    sourceType?: string;
    docsRead?: number;
    error?: string;
  }> = [];
  let totalTokens = 0;

  for (const bill of rows) {
    if (bill.summary && bill.summary.trim().length > 0) {
      results.push({ billId: bill.id, status: 'skipped_official' });
      continue;
    }
    try {
      const outcome = await processBillSummary(bill);
      totalTokens += outcome.tokensUsed;
      results.push({
        billId: bill.id,
        status: outcome.success ? 'ok' : 'no_summary',
        tokensUsed: outcome.tokensUsed,
        sourceType: outcome.result.sourceType,
        docsRead: outcome.result.docsRead,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown';
      console.error(
        `[admin/bulk-regenerate] billId=${bill.id} failed: ${message}`,
      );
      results.push({ billId: bill.id, status: 'error', error: message });
    }
  }

  return NextResponse.json({
    ok: true,
    totalBills: normalizedIds.length,
    processed: results.length,
    totalTokens,
    results,
  });
}
