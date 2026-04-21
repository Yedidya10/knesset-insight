/**
 * Trigger.dev scheduled task: Election Candidate Monitoring
 * Runs daily — uses AI + web search to detect new confirmed candidates
 * for the upcoming Knesset elections.
 * Auto-disables after election day.
 */
import { schedules, logger } from '@trigger.dev/sdk';
import { syncElectionCandidates } from '@/pipeline/jobs/sync-election-candidates';
import { appConfig } from '../../app.config';

export const electionCandidateSync = schedules.task({
  id: 'election-candidate-sync',
  cron: {
    pattern: appConfig.elections2026.candidateSyncCron,
    timezone: appConfig.sync.timezone,
    environments: ['PRODUCTION', 'STAGING'],
  },
  maxDuration: 120, // 2 minutes — lightweight AI call
  retry: {
    maxAttempts: 2,
    factor: 2,
    minTimeoutInMs: 10_000,
    maxTimeoutInMs: 60_000,
  },
  queue: {
    concurrencyLimit: 1,
  },
  run: async () => {
    logger.info('Starting election candidate sync');
    await syncElectionCandidates();
    logger.info('Election candidate sync complete');
  },
});
