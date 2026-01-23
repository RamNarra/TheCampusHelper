import { Redis } from '@upstash/redis';

/**
 * Rate Limiting Implementation using Upstash Redis
 * Limits AI generation requests per user+IP combination
 */

// Initialize Upstash Redis client
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

// Rate limit configuration
const RATE_LIMIT_WINDOW = 60; // 60 seconds
const MAX_REQUESTS = 10; // 10 requests per window

type LocalBucket = {
  count: number;
  resetAtMs: number;
};

// Best-effort fallback when Redis is unavailable.
// Note: in serverless, this is per-instance and not globally consistent.
const LOCAL_BUCKETS = new Map<string, LocalBucket>();
const LOCAL_MAX_KEYS = 5000;

function localRateLimitExceeded(key: string): boolean {
  const now = Date.now();
  const windowMs = RATE_LIMIT_WINDOW * 1000;
  const resetAtMs = now + windowMs;

  const existing = LOCAL_BUCKETS.get(key);
  if (!existing || now >= existing.resetAtMs) {
    // Opportunistic cleanup when map gets large.
    if (LOCAL_BUCKETS.size >= LOCAL_MAX_KEYS) {
      for (const [k, v] of LOCAL_BUCKETS) {
        if (Date.now() >= v.resetAtMs) LOCAL_BUCKETS.delete(k);
        if (LOCAL_BUCKETS.size < LOCAL_MAX_KEYS) break;
      }
    }
    LOCAL_BUCKETS.set(key, { count: 1, resetAtMs });
    return false;
  }

  existing.count += 1;
  return existing.count > MAX_REQUESTS;
}

/**
 * Check if a rate limit has been exceeded for a given key
 * @param key - Unique identifier for the rate limit (e.g., "uid:ip")
 * @returns true if rate limit is exceeded, false otherwise
 */
export async function rateLimitExceeded(
  key: string,
  opts?: {
    /** When true, block requests if rate limiting cannot be evaluated. */
    failClosed?: boolean;
  }
): Promise<boolean> {
  const failClosed = opts?.failClosed === true;

  if (!redis) {
    const isProd = process.env.NODE_ENV === 'production';
    const msg = 'Rate limiting unavailable: Redis not configured';
    if (isProd) console.error(`CRITICAL: ${msg}`);
    else console.warn(msg);

    // Preserve prior semantics:
    // - failClosed=false => allow
    // - failClosed=true  => enforce best-effort local limiter
    return failClosed ? localRateLimitExceeded(key) : false;
  }

  try {
    const limiterKey = `ratelimit:${key}`;
    const current = await redis.incr(limiterKey);
    
    // Set expiry on first request
    if (current === 1) {
      await redis.expire(limiterKey, RATE_LIMIT_WINDOW);
    }
    
    return current > MAX_REQUESTS;
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // Default is fail-open for availability, but high-cost endpoints should pass failClosed.
    // When failClosed is enabled, fall back to a best-effort local limiter instead of hard-blocking.
    return failClosed ? localRateLimitExceeded(key) : false;
  }
}
