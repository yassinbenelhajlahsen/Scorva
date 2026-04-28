import Redis from "ioredis";

let redis = null;

if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    retryStrategy(times) {
      if (times > 3) return null;
      return Math.min(times * 200, 2000);
    },
  });
  redis.connect().catch(() => {});
  redis.on("error", () => {});
}

// Bump when cached data shapes change to auto-invalidate stale entries on deploy.
// Old keys expire naturally via their TTL.
export const CACHE_VERSION = 6;

function prefixKey(key) {
  return `v${CACHE_VERSION}:${key}`;
}

function prefixPattern(pattern) {
  return `v${CACHE_VERSION}:${pattern}`;
}

/**
 * Read-through cache helper.
 *
 * Checks Redis for `key`. On hit, returns parsed JSON.
 * On miss (or Redis down), runs queryFn(), optionally stores result, returns it.
 *
 * @param {string} key
 * @param {number} ttlSeconds
 * @param {() => Promise<any>} queryFn
 * @param {{ cacheIf?: (data: any) => boolean }} [opts]
 */
export async function cached(key, ttlSeconds, queryFn, { cacheIf } = {}) {
  const vKey = prefixKey(key);
  if (redis) {
    try {
      const hit = await redis.get(vKey);
      if (hit !== null) return JSON.parse(hit);
    } catch {
      // Redis unavailable — fall through to DB
    }
  }

  const data = await queryFn();

  const shouldCache = cacheIf ? cacheIf(data) : data !== null && data !== undefined;
  if (redis && shouldCache) {
    try {
      await redis.set(vKey, JSON.stringify(data), "EX", ttlSeconds);
    } catch {
      // Redis write failed — ignore
    }
  }

  return data;
}

/**
 * Delete one or more specific cache keys.
 */
export async function invalidate(...keys) {
  if (!redis || keys.length === 0) return;
  try {
    await redis.del(...keys.map(prefixKey));
  } catch {
    // ignore
  }
}

/**
 * Delete all keys matching a glob pattern using SCAN (non-blocking).
 */
export async function invalidatePattern(pattern) {
  if (!redis) return;
  try {
    const stream = redis.scanStream({ match: prefixPattern(pattern), count: 100 });
    const pipeline = redis.pipeline();
    let count = 0;
    for await (const keys of stream) {
      for (const key of keys) {
        pipeline.del(key);
        count++;
      }
    }
    if (count > 0) await pipeline.exec();
  } catch {
    // ignore
  }
}

/**
 * Graceful shutdown — close Redis connection.
 */
export async function closeCache() {
  if (redis) {
    try {
      await redis.quit();
    } catch {
      // ignore
    }
  }
}
