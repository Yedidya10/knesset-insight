import { eq } from 'drizzle-orm';
import { db } from '../lib/db';
import { syncLog } from '../lib/db/schema';

/**
 * Checkpoint data stored per sync entity for reliable incremental sync.
 * Each job defines its own fields (e.g. lastItemId, lastTimestamp).
 */
export interface SyncCheckpoint {
  /** Max timestamp of last batch of processed items (ISO string) */
  lastItemTimestamp?: string;
  /** Max ID of last processed item */
  lastItemId?: number;
  /** Per-job custom data */
  [key: string]: unknown;
}

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
 * Get the stored checkpoint for an entity.
 */
export async function getCheckpoint(entity: string): Promise<SyncCheckpoint | null> {
  const rows = await db
    .select({ lastCheckpoint: syncLog.lastCheckpoint })
    .from(syncLog)
    .where(eq(syncLog.entity, entity))
    .limit(1);

  const raw = rows[0]?.lastCheckpoint;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SyncCheckpoint;
  } catch {
    return null;
  }
}

/**
 * Update the checkpoint for an entity (without changing sync status).
 */
export async function setCheckpoint(
  entity: string,
  checkpoint: SyncCheckpoint,
): Promise<void> {
  await db
    .update(syncLog)
    .set({
      lastCheckpoint: JSON.stringify(checkpoint),
      updatedAt: new Date(),
    })
    .where(eq(syncLog.entity, entity));
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
  checkpoint?: SyncCheckpoint,
): Promise<void> {
  await db
    .insert(syncLog)
    .values({
      entity,
      lastSyncAt: syncTime,
      recordCount,
      status,
      errorMessage: errorMessage ?? null,
      lastCheckpoint: checkpoint ? JSON.stringify(checkpoint) : null,
    })
    .onConflictDoUpdate({
      target: syncLog.entity,
      set: {
        lastSyncAt: syncTime,
        recordCount,
        status,
        errorMessage: errorMessage ?? null,
        ...(checkpoint !== undefined
          ? { lastCheckpoint: JSON.stringify(checkpoint) }
          : {}),
        updatedAt: new Date(),
      },
    });
}

/**
 * Run a sync job with error handling and tracking.
 * The job function receives the previous checkpoint and returns
 * { count, checkpoint } with the new checkpoint (if any).
 */
export async function runSyncJob(
  entity: string,
  job: (prevCheckpoint: SyncCheckpoint | null) => Promise<number | { count: number; checkpoint: SyncCheckpoint }>,
): Promise<void> {
  const startTime = new Date();
  console.log(`[sync:${entity}] Starting sync at ${startTime.toISOString()}`);

  const prevCheckpoint = await getCheckpoint(entity);

  try {
    const result = await job(prevCheckpoint);
    const count = typeof result === 'number' ? result : result.count;
    const newCheckpoint = typeof result === 'number' ? undefined : result.checkpoint;
    await setLastSyncTime(entity, startTime, count, 'success', undefined, newCheckpoint);
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
