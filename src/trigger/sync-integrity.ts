/**
 * Trigger.dev scheduled task: Integrity Data Sync
 * Runs daily at 4 AM Israel time — syncs ethics committee and lobbyist data.
 * Depends on core data (members, committees) being up-to-date.
 */
import { schedules, logger } from '@trigger.dev/sdk';
import { syncIntegrityKnesset } from '@/pipeline/jobs/sync-integrity-knesset';
import { syncIntegrityLobbyists } from '@/pipeline/jobs/sync-integrity-lobbyists';

export const syncIntegrity = schedules.task({
  id: 'sync-integrity',
  cron: {
    pattern: '0 4 * * *',
    timezone: 'Asia/Jerusalem',
  },
  maxDuration: 900, // 15 min
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 10_000,
    maxTimeoutInMs: 60_000,
  },
  queue: {
    concurrencyLimit: 1,
  },
  run: async () => {
    logger.info('Starting integrity data sync');

    logger.info('Syncing Knesset ethics committee data...');
    await syncIntegrityKnesset();

    logger.info('Syncing lobbyist connections...');
    await syncIntegrityLobbyists();

    logger.info('Integrity data sync complete');
    return { success: true };
  },
});
