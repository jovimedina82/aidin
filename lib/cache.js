/**
 * Simple in-memory cache with TTL support
 * Use this for frequently accessed data that doesn't need to be real-time
 */

class MemoryCache {
  constructor() {
    this.cache = new Map()
    this.timers = new Map()
  }

  /**
   * Set a value in cache with TTL (time to live in seconds)
   */
  set(key, value, ttlSeconds = 30) {
    // Clear existing timer if any
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key))
    }

    // Store the value
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttlSeconds * 1000)
    })

    // Set expiration timer
    const timer = setTimeout(() => {
      this.delete(key)
    }, ttlSeconds * 1000)

    this.timers.set(key, timer)
  }

  /**
   * Get a value from cache (returns null if expired or not found)
   */
  get(key) {
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.delete(key)
      return null
    }

    return entry.value
  }

  /**
   * Delete a key from cache
   */
  delete(key) {
    const timer = this.timers.get(key)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(key)
    }
    this.cache.delete(key)
  }

  /**
   * Clear all cache
   */
  clear() {
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer)
    }
    this.timers.clear()
    this.cache.clear()
  }

  /**
   * Get cache size
   */
  size() {
    return this.cache.size
  }

  /**
   * Helper to get or set - if key exists return it, otherwise compute and cache
   */
  async getOrSet(key, computeFn, ttlSeconds = 30) {
    const cached = this.get(key)
    if (cached !== null) {
      return cached
    }

    const value = await computeFn()
    this.set(key, value, ttlSeconds)
    return value
  }
}

// Export singleton instance
export const cache = new MemoryCache()

// Cache keys constants for consistency
export const CacheKeys = {
  USER_BY_ID: (userId) => `user:${userId}`,
  USER_BY_TOKEN: (tokenHash) => `user:token:${tokenHash}`,
  STATS_DASHBOARD: (userId) => `stats:dashboard:${userId}`,
  TICKET_COUNT: (filters) => `ticket:count:${JSON.stringify(filters)}`,
  DEPARTMENT_LIST: 'departments:all',
  ROLE_BY_ID: (roleId) => `role:${roleId}`,
}

// Cache TTL constants (in seconds)
export const CacheTTL = {
  USER: 300,        // 5 minutes
  STATS: 30,        // 30 seconds
  DEPARTMENTS: 600, // 10 minutes
  ROLES: 600,       // 10 minutes
  SHORT: 10,        // 10 seconds
  MEDIUM: 60,       // 1 minute
  LONG: 300,        // 5 minutes
}
