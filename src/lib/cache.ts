import { redis } from '@/lib/db/redis';

/**
 * Fetch data with Redis caching. Falls back to fetcher on cache miss or error.
 * @param key  Redis key
 * @param ttl  Time-to-live in seconds
 * @param fetcher  Async function that produces the data
 */
export async function cached<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  try {
    const hit = await redis.get<T>(key);
    if (hit !== null && hit !== undefined) return hit;
  } catch {
    // Redis down — fall through to fetcher
  }

  const data = await fetcher();

  // Store in cache (fire-and-forget)
  redis.set(key, data, { ex: ttl }).catch(() => {});

  return data;
}
