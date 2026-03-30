import { NextRequest, NextResponse } from 'next/server';
import { syncJobs, type SyncJobName } from '../../../../pipeline/schedule';

export async function POST(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const jobName = (body as { job?: string }).job as SyncJobName | undefined;

  if (!jobName || !(jobName in syncJobs)) {
    return NextResponse.json(
      {
        error: 'Invalid job name',
        available: Object.keys(syncJobs),
      },
      { status: 400 },
    );
  }

  try {
    await syncJobs[jobName]();
    return NextResponse.json({ success: true, job: jobName });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: message, job: jobName },
      { status: 500 },
    );
  }
}
