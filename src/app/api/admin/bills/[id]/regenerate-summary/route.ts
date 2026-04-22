import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { isAdmin } from '@/lib/auth/admin';
import { db } from '@/lib/db';
import { bills } from '@/lib/db/schema';
import { processBillSummary } from '@/pipeline/jobs/generate-bill-summaries';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * POST /api/admin/bills/[id]/regenerate-summary
 * Surgically regenerates the AI summary for a single bill. Admin-only.
 * If the bill has an official (manual) summary, returns 409 — official text
 * always takes precedence and should not be overwritten.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorized = await isAdmin();
  if (!authorized) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const billId = Number(id);
  if (!Number.isFinite(billId) || billId <= 0) {
    return NextResponse.json({ error: 'invalid bill id' }, { status: 400 });
  }

  const [bill] = await db
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
    .where(eq(bills.id, billId))
    .limit(1);

  if (!bill) {
    return NextResponse.json({ error: 'bill not found' }, { status: 404 });
  }

  if (bill.summary && bill.summary.trim().length > 0) {
    return NextResponse.json(
      {
        error: 'official_summary_exists',
        message:
          'Bill has an official Knesset summary; AI regeneration is skipped. Clear bills.summary to override.',
      },
      { status: 409 },
    );
  }

  try {
    const { success, tokensUsed, result } = await processBillSummary(bill);
    if (!success) {
      return NextResponse.json(
        {
          ok: false,
          reason: 'no_summary_produced',
          tokensUsed,
          sourceType: result.sourceType,
          docsRead: result.docsRead,
        },
        { status: 200 },
      );
    }
    return NextResponse.json({
      ok: true,
      tokensUsed,
      sourceType: result.sourceType,
      docsRead: result.docsRead,
      stage: result.stage,
      budgetType: result.budgetType,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.error(
      `[admin/regenerate-summary] billId=${billId} failed: ${message}`,
    );
    return NextResponse.json(
      { error: 'regeneration_failed', message },
      { status: 500 },
    );
  }
}
