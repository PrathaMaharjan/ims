import { redis } from "./redis";

const DEFAULT_TTL_SECONDS = 60 * 5; // 5 minutes

export async function getCached<T>(key: string): Promise<T | null> {
  const raw = await redis.get(key);
  if (!raw) return null;
  return JSON.parse(raw) as T;
}

export async function setCached<T>(
  key: string,
  value: T,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<void> {
  await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
}

export async function invalidateCache(key: string): Promise<void> {
  await redis.del(key);
}

// For invalidating a group of keys at once, e.g. all product-search results for an org.
export async function invalidateCachePattern(pattern: string): Promise<void> {
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}