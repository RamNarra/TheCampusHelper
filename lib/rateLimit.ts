import { Redis } from '@upstash/redis';

// Initialize Upstash Redis client for rate limiting
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
const MAX_REQUESTS = 10; // 10 requests per window

/**
 * Check if a rate limit has been exceeded for a given key
 * @param key - Unique identifier for the rate limit (e.g., "uid:ip")
 * @returns true if rate limit is exceeded, false otherwise
 */
export async function rateLimitExceeded(key: string): Promise<boolean> {
  if (!redis) {
    // If Redis is not configured, skip rate limiting
    console.warn('Rate limiting disabled: Redis not configured');
    return false;
  }

  try {
    const limiterKey = `ratelimit:${key}`;
    const current = await redis.incr(limiterKey);
    
    // Set expiry on first request
    if (current === 1) {
      await redis.expire(limiterKey, RATE_LIMIT_WINDOW);
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
    // Fail open - don't block requests if rate limiting fails
    return false;
    return false; // Fail open - allow request if Redis errors
  }
}
