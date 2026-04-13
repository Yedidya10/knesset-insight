/**
 * Trigger.dev on-demand task: Run a single sync job by name.
 * Called from the /api/cron/sync endpoint or Trigger.dev dashboard.
 */
import { task, logger } from '@trigger.dev/sdk';
import { syncJobs, type SyncJobName } from '@/pipeline/schedule';

export const runSyncJob = task({
  id: 'run-sync-job',
  maxDuration: 3600,
  retry: {
    maxAttempts: 2,
    factor: 2,
    minTimeoutInMs: 10_000,
    maxTimeoutInMs: 120_000,
  },
  queue: {
    concurrencyLimit: 1,
  },
  run: async (payload: { job: SyncJobName }) => {
    const { job } = payload;

    if (!(job in syncJobs)) {
      throw new Error(`Invalid job name: ${job}`);
    }

    logger.info(`Running sync job: ${job}`);
    await syncJobs[job]();
    logger.info(`Sync job complete: ${job}`);

    return { success: true, job };
  },
});
