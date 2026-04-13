import { NextRequest, NextResponse } from 'next/server';
import { tasks } from '@trigger.dev/sdk';
import { syncJobs, type SyncJobName } from '../../../../pipeline/schedule';
import type { runSyncJob } from '../../../../trigger/run-sync-job';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { job: jobName, mode = 'trigger' } = body as {
    job?: string;
    mode?: 'trigger' | 'direct';
  };

  if (!jobName || !(jobName in syncJobs)) {
    return NextResponse.json(
      {
        error: 'Invalid job name',
        available: Object.keys(syncJobs),
      },
      { status: 400 },
    );
  }

  // Direct mode: run synchronously in-process (for local dev / short jobs)
  if (mode === 'direct') {
    try {
      await syncJobs[jobName as SyncJobName]();
      return NextResponse.json({ success: true, job: jobName, mode: 'direct' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json(
        { error: message, job: jobName },
        { status: 500 },
      );
    }
  }

  // Default: delegate to Trigger.dev (async, no timeout)
  try {
    const handle = await tasks.trigger<typeof runSyncJob>('run-sync-job', {
      job: jobName as SyncJobName,
    });
    return NextResponse.json({
      success: true,
      job: jobName,
      mode: 'trigger',
      runId: handle.id,
    });
  } catch (error) {
    // Fallback to direct execution if Trigger.dev is unavailable
    try {
      await syncJobs[jobName as SyncJobName]();
      return NextResponse.json({
        success: true,
        job: jobName,
        mode: 'direct-fallback',
      });
    } catch (directError) {
      const message =
        directError instanceof Error ? directError.message : 'Unknown error';
      return NextResponse.json(
        { error: message, job: jobName },
        { status: 500 },
      );
    }
  }
}
