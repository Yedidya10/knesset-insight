/**
 * Trigger.dev scheduled task: Core Data Sync
 * Runs every 6 hours — syncs members, votes, bills, committees from Knesset OData.
 */
import { schedules, logger } from '@trigger.dev/sdk';
import { syncMembers } from '@/pipeline/jobs/sync-members';
import { syncVotes } from '@/pipeline/jobs/sync-votes';
import { syncBills } from '@/pipeline/jobs/sync-bills';
import { syncCommittees } from '@/pipeline/jobs/sync-committees';
import { syncCommitteeMembers } from '@/pipeline/jobs/sync-committee-members';
import { appConfig } from '../../app.config';

export const syncCoreData = schedules.task({
  id: 'sync-core-data',
  cron: {
    pattern: appConfig.sync.coreData,
    timezone: appConfig.sync.timezone,
    environments: ['PRODUCTION', 'STAGING'],
  },
  maxDuration: 1800, // 30 min
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 10_000,
    maxTimeoutInMs: 120_000,
  },
  queue: {
    concurrencyLimit: 1,
  },
  run: async () => {
    logger.info('Starting core data sync');

    logger.info('Syncing members...');
    await syncMembers();

    logger.info('Syncing votes...');
    await syncVotes();

    logger.info('Syncing bills...');
    await syncBills();

    logger.info('Syncing committees...');
    await syncCommittees();

    logger.info('Syncing committee members...');
    await syncCommitteeMembers();

    logger.info('Core data sync complete');
    return { success: true };
  },
});
