/**
 * Phase 10 RC1: Rate Limiting
 * In-memory rate limiter (dev-safe, no external deps)
 * Extension point: can be replaced with Redis/KV adapter
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

/**
 * In-memory rate limit store
 * Key format: "ip:path"
 */
const store = new Map<string, RateLimitEntry>()

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Max requests per window
  skipInTest?: boolean // Skip rate limiting in test environment
}

/**
 * Default rate limit: 60 requests per minute
 */
export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60,
  skipInTest: true,
}

/**
 * Check if request should be rate limited
 * Returns remaining requests or -1 if rate limited
 */
export function checkRateLimit(
  ip: string,
  path: string,
  config: RateLimitConfig = DEFAULT_RATE_LIMIT
): { allowed: boolean; remaining: number; resetAt: number } {
  // Skip in test environment if configured
  if (config.skipInTest && process.env.NODE_ENV === 'test') {
    return { allowed: true, remaining: config.maxRequests, resetAt: 0 }
  }

  const key = `${ip}:${path}`
  const now = Date.now()
  const entry = store.get(key)

  // No entry or window expired - allow and create new entry
  if (!entry || now >= entry.resetAt) {
    const resetAt = now + config.windowMs
    store.set(key, { count: 1, resetAt })

    // Cleanup expired entries periodically
    if (Math.random() < 0.01) {
      cleanupExpiredEntries(now)
    }

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt,
    }
  }

  // Within window - check limit
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    }
  }

  // Increment count
  entry.count++
  store.set(key, entry)

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  }
}

/**
 * Cleanup expired entries from store
 */
function cleanupExpiredEntries(now: number): void {
  for (const [key, entry] of store.entries()) {
    if (now >= entry.resetAt) {
      store.delete(key)
    }
  }
}

/**
 * Clear all rate limit entries (for testing)
 */
export function clearRateLimits(): void {
  store.clear()
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(result: {
  remaining: number
  resetAt: number
}): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(DEFAULT_RATE_LIMIT.maxRequests),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  }
}
