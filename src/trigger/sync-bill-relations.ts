/**
 * Trigger.dev scheduled task: Bill Relations Sync
 * Runs daily at 1 AM Israel time — syncs bill initiators, unions, splits, names, documents.
 * Depends on core data (bills, members) being up-to-date.
 */
import { schedules, logger } from '@trigger.dev/sdk';
import { syncBillInitiators } from '@/pipeline/jobs/sync-bill-initiators';
import { syncBillUnions } from '@/pipeline/jobs/sync-bill-unions';
import { syncBillSplits } from '@/pipeline/jobs/sync-bill-splits';
import { syncBillNames } from '@/pipeline/jobs/sync-bill-names';
import { syncBillDocuments } from '@/pipeline/jobs/sync-bill-documents';
import { appConfig } from '../../app.config';

export const syncBillRelations = schedules.task({
  id: 'sync-bill-relations',
  cron: {
    pattern: appConfig.sync.billRelations,
    timezone: appConfig.sync.timezone,
    environments: ['PRODUCTION', 'STAGING'],
  },
  maxDuration: 1800,
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
    logger.info('Starting bill relations sync');

    logger.info('Syncing bill initiators...');
    await syncBillInitiators();

    logger.info('Syncing bill unions...');
    await syncBillUnions();

    logger.info('Syncing bill splits...');
    await syncBillSplits();

    logger.info('Syncing bill names...');
    await syncBillNames();

    logger.info('Syncing bill documents...');
    await syncBillDocuments();

    logger.info('Bill relations sync complete');
    return { success: true };
  },
});
