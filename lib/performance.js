/**
 * Performance optimization utilities
 */

/**
 * Debounce function to limit the rate of function calls
 */
export function debounce(func, wait, immediate = false) {
  let timeout

  return function executedFunction(...args) {
    const later = () => {
      timeout = null
      if (!immediate) func(...args)
    }

    const callNow = immediate && !timeout

    clearTimeout(timeout)
    timeout = setTimeout(later, wait)

    if (callNow) func(...args)
  }
}

/**
 * Throttle function to limit function calls to once per specified interval
 */
export function throttle(func, limit) {
  let inThrottle

  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

/**
 * Memoization utility for expensive computations
 */
export function memoize(fn, getKey = (...args) => JSON.stringify(args)) {
  const cache = new Map()

  return function(...args) {
    const key = getKey(...args)

    if (cache.has(key)) {
      return cache.get(key)
    }

    const result = fn.apply(this, args)
    cache.set(key, result)

    // Clean up cache if it gets too large
    if (cache.size > 1000) {
      const firstKey = cache.keys().next().value
      cache.delete(firstKey)
    }

    return result
  }
}

/**
 * Batch database operations to reduce round trips
 */
export function createBatcher(batchFn, maxBatchSize = 100, maxWaitTime = 100) {
  let batch = []
  let timeoutId = null

  const processBatch = async () => {
    if (batch.length === 0) return

    const currentBatch = [...batch]
    batch = []
    timeoutId = null

    try {
      await batchFn(currentBatch)
    } catch (error) {
      console.error('Batch processing failed:', error)
      // Re-add failed items to batch for retry
      batch.unshift(...currentBatch)
    }
  }

  return {
    add: (item) => {
      batch.push(item)

      if (batch.length >= maxBatchSize) {
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
        processBatch()
      } else if (!timeoutId) {
        timeoutId = setTimeout(processBatch, maxWaitTime)
      }
    },
    flush: () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      return processBatch()
    },
    size: () => batch.length
  }
}

/**
 * Cache with TTL (Time To Live)
 */
export class TTLCache {
  constructor(defaultTTL = 5 * 60 * 1000) { // 5 minutes default
    this.cache = new Map()
    this.defaultTTL = defaultTTL
  }

  set(key, value, ttl = this.defaultTTL) {
    const expires = Date.now() + ttl
    this.cache.set(key, { value, expires })
  }

  get(key) {
    const item = this.cache.get(key)

    if (!item) {
      return undefined
    }

    if (Date.now() > item.expires) {
      this.cache.delete(key)
      return undefined
    }

    return item.value
  }

  has(key) {
    const item = this.cache.get(key)

    if (!item) {
      return false
    }

    if (Date.now() > item.expires) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  delete(key) {
    return this.cache.delete(key)
  }

  clear() {
    this.cache.clear()
  }

  cleanup() {
    const now = Date.now()
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expires) {
        this.cache.delete(key)
      }
    }
  }

  size() {
    return this.cache.size
  }
}

/**
 * Query optimization helpers for Prisma
 */
export const QueryOptimizations = {
  /**
   * Standard user select for performance
   */
  userSelect: {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    phone: true,
    userType: true,
    isActive: true,
    createdAt: true,
    updatedAt: true
  },

  /**
   * Detailed user select with relations
   */
  userWithRelations: {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    phone: true,
    userType: true,
    managerId: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
    roles: {
      include: {
        role: {
          select: {
            id: true,
            name: true,
            description: true
          }
        }
      }
    },
    departments: {
      include: {
        department: {
          select: {
            id: true,
            name: true,
            color: true
          }
        }
      }
    }
  },

  /**
   * Standard ticket select for performance
   */
  ticketSelect: {
    id: true,
    ticketNumber: true,
    title: true,
    description: true,
    status: true,
    priority: true,
    category: true,
    requesterId: true,
    assigneeId: true,
    departmentId: true,
    createdAt: true,
    updatedAt: true,
    resolvedAt: true,
    closedAt: true,
    aiDecision: {
      select: {
        finalDepartment: true,
        suggestedDepartment: true,
        departmentConfidence: true
      }
    }
  },

  /**
   * Ticket with essential relations
   */
  ticketWithRelations: {
    id: true,
    ticketNumber: true,
    title: true,
    description: true,
    status: true,
    priority: true,
    category: true,
    createdAt: true,
    updatedAt: true,
    resolvedAt: true,
    closedAt: true,
    assignee: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true
      }
    },
    requester: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true
      }
    },
    _count: {
      select: {
        comments: true
      }
    }
  }
}

/**
 * Performance monitoring utility
 */
export class PerformanceMonitor {
  static timers = new Map()

  static start(label) {
    this.timers.set(label, performance.now())
  }

  static end(label, logToConsole = process.env.NODE_ENV === 'development') {
    const startTime = this.timers.get(label)
    if (!startTime) {
      // Silently ignore if timer doesn't exist (avoids noise)
      return 0
    }

    const duration = performance.now() - startTime
    this.timers.delete(label)

    if (logToConsole && process.env.NODE_ENV === 'development') {
      console.log(`⏱️ ${label}: ${duration.toFixed(2)}ms`)
    }

    return duration
  }

  static measure(label, fn) {
    return async (...args) => {
      this.start(label)
      try {
        const result = await fn(...args)
        return result
      } finally {
        this.end(label)
      }
    }
  }
}

/**
 * React performance utilities
 * Note: These are utility functions that can be imported into React components
 * where useRef, useCallback, and React.memo are available
 */
export const ReactOptimizations = {
  /**
   * Creates a stable reference for event handlers
   * Usage: import { useRef, useCallback } from 'react'
   * const stableCallback = ReactOptimizations.useStableCallback(callback, deps)
   */
  useStableCallback: (useRef, useCallback) => (callback, deps) => {
    const ref = useRef(callback)
    ref.current = callback

    return useCallback((...args) => ref.current(...args), deps)
  }
}