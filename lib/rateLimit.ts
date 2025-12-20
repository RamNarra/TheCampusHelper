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
    const msg = 'Rate limiting disabled: Redis not configured';
    if (isProd) console.error(`CRITICAL: ${msg}`);
    else console.warn(msg);
    return failClosed;
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
    return failClosed;
  }
}
