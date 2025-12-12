import { Redis } from '@upstash/redis';

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

// Rate limit configuration
const RATE_LIMIT_WINDOW = 60; // 60 seconds
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per window

/**
 * Check if a rate limit has been exceeded for a given key
 * @param key - Unique identifier for rate limiting (e.g., "uid:ip")
 * @returns true if rate limit exceeded, false otherwise
 */
export async function rateLimitExceeded(key: string): Promise<boolean> {
  try {
    // If Redis is not configured, allow all requests (fallback mode)
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      console.warn('Redis not configured, rate limiting disabled');
      return false;
    }

    const current = await redis.incr(key);
    
    // Set expiry on first request
    if (current === 1) {
      await redis.expire(key, RATE_LIMIT_WINDOW);
    }
    
    return current > RATE_LIMIT_MAX_REQUESTS;
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // On error, allow the request (fail open)
    return false;
  }
}
