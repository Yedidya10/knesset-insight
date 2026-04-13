/**
 * Trigger.dev scheduled task: Political Data Sync
 * Runs daily at 3 AM Israel time — syncs images, parties, elections, groups, governments.
 * Depends on core data (members, factions) being up-to-date.
 */
import { schedules, logger } from '@trigger.dev/sdk';
import { syncMemberImages } from '@/pipeline/jobs/sync-images';
import { syncRegisteredParties } from '@/pipeline/jobs/sync-registered-parties';
import { syncElectoralLists } from '@/pipeline/jobs/sync-electoral-lists';
import { syncPoliticalLinks } from '@/pipeline/jobs/sync-political-links';
import { syncPoliticalGroups } from '@/pipeline/jobs/sync-political-groups';
import { syncGovMinistries } from '@/pipeline/jobs/sync-gov-ministries';
import { syncGovernments } from '@/pipeline/jobs/sync-governments';

export const syncPoliticalData = schedules.task({
  id: 'sync-political-data',
  cron: {
    pattern: '0 3 * * *',
    timezone: 'Asia/Jerusalem',
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
    logger.info('Starting political data sync');

    logger.info('Syncing member images...');
    await syncMemberImages();

    logger.info('Syncing registered parties...');
    await syncRegisteredParties();

    logger.info('Syncing electoral lists...');
    await syncElectoralLists();

    // Links must run after parties + lists + factions
    logger.info('Syncing political links...');
    await syncPoliticalLinks();

    // Groups must run after factions exist
    logger.info('Syncing political groups...');
    await syncPoliticalGroups();

    // Governments must run after members + factions
    logger.info('Syncing gov ministries...');
    await syncGovMinistries();

    logger.info('Syncing governments...');
    await syncGovernments();

    logger.info('Political data sync complete');
    return { success: true };
  },
});
