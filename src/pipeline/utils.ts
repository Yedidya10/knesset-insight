import { eq } from 'drizzle-orm';
import { db } from '../lib/db';
import { syncLog } from '../lib/db/schema';

/**
 * Get the last sync timestamp for an entity.
 */
export async function getLastSyncTime(entity: string): Promise<Date | null> {
  const rows = await db
    .select({ lastSyncAt: syncLog.lastSyncAt })
    .from(syncLog)
    .where(eq(syncLog.entity, entity))
    .limit(1);

  return rows[0]?.lastSyncAt ?? null;
}

/**
 * Update the sync timestamp and status for an entity.
 */
export async function setLastSyncTime(
  entity: string,
  syncTime: Date,
  recordCount: number,
  status: 'success' | 'failed' = 'success',
  errorMessage?: string,
): Promise<void> {
  await db
    .insert(syncLog)
    .values({
      entity,
      lastSyncAt: syncTime,
      recordCount,
      status,
      errorMessage: errorMessage ?? null,
    })
    .onConflictDoUpdate({
      target: syncLog.entity,
      set: {
        lastSyncAt: syncTime,
        recordCount,
        status,
        errorMessage: errorMessage ?? null,
        updatedAt: new Date(),
      },
    });
}

/**
 * Run a sync job with error handling and tracking.
 */
export async function runSyncJob(
  entity: string,
  job: () => Promise<number>,
): Promise<void> {
  const startTime = new Date();
  console.log(`[sync:${entity}] Starting sync at ${startTime.toISOString()}`);

  try {
    const count = await job();
    await setLastSyncTime(entity, startTime, count, 'success');
    console.log(
      `[sync:${entity}] Completed — ${count} records in ${Date.now() - startTime.getTime()}ms`,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error';
    await setLastSyncTime(entity, startTime, 0, 'failed', message);
    console.error(`[sync:${entity}] Failed:`, message);
    throw error;
  }
}
