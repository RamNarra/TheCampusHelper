import { Redis } from '@upstash/redis';

// Initialize Redis client with Upstash credentials
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Rate limit configuration
const RATE_LIMIT = {
  maxRequests: 10,      // Maximum requests allowed
  windowSeconds: 60,     // Time window in seconds
};

/**
 * Check if rate limit has been exceeded for a given key
 * @param key - Unique identifier for rate limiting (e.g., "userId:ipAddress")
 * @returns Promise<boolean> - true if rate limit exceeded, false otherwise
 */
export async function rateLimitExceeded(key: string): Promise<boolean> {
  try {
    // Increment the counter for this key
    const count = await redis.incr(key);
    
    // Set expiration on first request
    if (count === 1) {
      await redis.expire(key, RATE_LIMIT.windowSeconds);
    }
    
    // Check if limit exceeded
    return count > RATE_LIMIT.maxRequests;
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // Fail open to prevent blocking all requests on Redis errors
    return false;
  }
}
