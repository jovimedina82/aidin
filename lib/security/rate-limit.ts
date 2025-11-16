/**
 * Rate Limiting for Email Endpoints
 *
 * In-database rate limiting using sliding window algorithm.
 *
 * Features:
 * - Per-IP and per-email rate limiting
 * - Configurable window and max requests
 * - Automatic cleanup of expired entries
 * - Returns retry-after header value
 */

import { prisma } from '@/lib/prisma';

const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10); // 1 minute
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS_PER_WINDOW || '20', 10);

/**
 * Check rate limit for identifier
 *
 * @param identifier - IP address or email
 * @param endpoint - Endpoint path (e.g., '/api/inbound/email')
 * @param options - Rate limit options
 * @returns { allowed: boolean, remaining: number, resetAt: Date }
 */
export async function checkRateLimit(
  identifier: string,
  endpoint: string,
  options?: {
    windowMs?: number;
    maxRequests?: number;
  }
): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number; // Seconds
}> {
  const windowMs = options?.windowMs || WINDOW_MS;
  const maxRequests = options?.maxRequests || MAX_REQUESTS;

  const windowStart = new Date(Date.now() - windowMs);
  const now = new Date();

  // Count requests in current window
  const count = await prisma.rateLimitEntry.count({
    where: {
      identifier,
      endpoint,
      requestAt: {
        gte: windowStart,
        lte: now
      }
    }
  });

  const remaining = Math.max(0, maxRequests - count);
  const allowed = count < maxRequests;

  // Calculate reset time (oldest request + window)
  if (!allowed) {
    const oldestRequest = await prisma.rateLimitEntry.findFirst({
      where: {
        identifier,
        endpoint,
        requestAt: {
          gte: windowStart
        }
      },
      orderBy: {
        requestAt: 'asc'
      }
    });

    if (oldestRequest) {
      const resetAt = new Date(oldestRequest.requestAt.getTime() + windowMs);
      const retryAfter = Math.ceil((resetAt.getTime() - Date.now()) / 1000);

      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter
      };
    }
  }

  // If allowed, record this request
  if (allowed) {
    await prisma.rateLimitEntry.create({
      data: {
        identifier,
        endpoint,
        requestAt: now,
        expiresAt: new Date(Date.now() + windowMs)
      }
    });
  }

  const resetAt = new Date(Date.now() + windowMs);

  return {
    allowed,
    remaining,
    resetAt
  };
}

/**
 * Cleanup expired rate limit entries
 *
 * Call this periodically (e.g., every hour) or after each check.
 */
export async function cleanupExpiredEntries(): Promise<number> {
  const result = await prisma.rateLimitEntry.deleteMany({
    where: {
      expiresAt: {
        lte: new Date()
      }
    }
  });

  if (result.count > 0) {
    console.log(`🧹 Cleaned up ${result.count} expired rate limit entries`);
  }

  return result.count;
}

/**
 * Reset rate limit for identifier (admin function)
 */
export async function resetRateLimit(
  identifier: string,
  endpoint?: string
): Promise<number> {
  const where: any = { identifier };
  if (endpoint) {
    where.endpoint = endpoint;
  }

  const result = await prisma.rateLimitEntry.deleteMany({ where });

  console.log(`🔓 Reset rate limit for ${identifier}${endpoint ? ` on ${endpoint}` : ''}`);

  return result.count;
}

/**
 * Get rate limit status for identifier
 */
export async function getRateLimitStatus(
  identifier: string,
  endpoint: string
): Promise<{
  count: number;
  limit: number;
  remaining: number;
  oldestRequest: Date | null;
  newestRequest: Date | null;
}> {
  const windowStart = new Date(Date.now() - WINDOW_MS);

  const entries = await prisma.rateLimitEntry.findMany({
    where: {
      identifier,
      endpoint,
      requestAt: {
        gte: windowStart
      }
    },
    orderBy: {
      requestAt: 'asc'
    }
  });

  return {
    count: entries.length,
    limit: MAX_REQUESTS,
    remaining: Math.max(0, MAX_REQUESTS - entries.length),
    oldestRequest: entries.length > 0 ? entries[0].requestAt : null,
    newestRequest: entries.length > 0 ? entries[entries.length - 1].requestAt : null
  };
}

/**
 * Express/Next.js middleware wrapper
 */
export function rateLimitMiddleware(
  getIdentifier: (req: any) => string,
  endpoint: string
) {
  return async (req: any, res: any, next: any) => {
    const identifier = getIdentifier(req);

    const result = await checkRateLimit(identifier, endpoint);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', result.resetAt.toISOString());

    if (!result.allowed) {
      res.setHeader('Retry-After', result.retryAfter || 60);
      return res.status(429).json({
        error: 'Too many requests',
        retryAfter: result.retryAfter,
        resetAt: result.resetAt.toISOString()
      });
    }

    // Cleanup expired entries asynchronously (don't await)
    cleanupExpiredEntries().catch(console.error);

    next();
  };
}
