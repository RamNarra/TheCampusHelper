/**
 * Rate Limiting Implementation using Upstash Redis
 * Limits AI generation requests per user+IP combination
 */

import { Redis } from '@upstash/redis';

// Initialize Upstash Redis client
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

// Rate limit configuration
const RATE_LIMIT_WINDOW = 60; // 60 seconds
const MAX_REQUESTS = 10; // 10 requests per minute

/**
 * Check if a rate limit has been exceeded for a given key
 * @param key - Unique identifier (e.g., "uid:ip")
 * @returns true if rate limit exceeded, false otherwise
 */
export async function rateLimitExceeded(key: string): Promise<boolean> {
  if (!redis) {
    console.warn('Rate limiting disabled: Redis not configured');
    return false; // Allow request if Redis is not configured
  }

  try {
    const current = await redis.incr(key);
    
    if (current === 1) {
      // First request, set expiration
      await redis.expire(key, RATE_LIMIT_WINDOW);
    }
    
    return current > MAX_REQUESTS;
  } catch (error) {
    console.error('Rate limit check failed:', error);
    return false; // Fail open - allow request if Redis errors
  }
}
