/**
 * Phase 10 RC1: Global Middleware
 * Security headers, CORS, and rate limiting for /api/** routes
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  applySecurityHeaders,
  applyCorsHeaders,
  handlePreflight,
} from './lib/http/security'
import { checkRateLimit, getRateLimitHeaders } from './lib/http/ratelimit'

/**
 * Rate-limited endpoints (POST only)
 */
const RATE_LIMITED_PATHS = [
  '/api/v1/tickets',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/azure-callback',
]

/**
 * Check if path matches rate-limited pattern
 */
function isRateLimitedPath(pathname: string): boolean {
  // Exact matches
  if (RATE_LIMITED_PATHS.includes(pathname)) {
    return true
  }

  // Pattern matches (e.g., /api/v1/tickets/:id/comments)
  if (pathname.match(/^\/api\/v1\/tickets\/[^/]+\/comments$/)) {
    return true
  }

  return false
}

/**
 * Global middleware - applies to /api/** routes only
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only apply to /api/** routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Handle OPTIONS preflight
  if (request.method === 'OPTIONS') {
    return handlePreflight(request)
  }

  // Rate limiting for POST requests on specific endpoints
  if (
    request.method === 'POST' &&
    isRateLimitedPath(pathname)
  ) {
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown'
    const result = checkRateLimit(ip, pathname)

    if (!result.allowed) {
      const response = NextResponse.json(
        {
          ok: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please try again later.',
          },
        },
        { status: 429 }
      )

      // Add rate limit headers
      Object.entries(getRateLimitHeaders(result)).forEach(([key, value]) => {
        response.headers.set(key, value)
      })

      return applyCorsHeaders(request, applySecurityHeaders(response))
    }

    // Add rate limit headers to successful response
    const response = NextResponse.next()
    Object.entries(getRateLimitHeaders(result)).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return applyCorsHeaders(request, applySecurityHeaders(response))
  }

  // Apply security headers and CORS to all API responses
  const response = NextResponse.next()
  return applyCorsHeaders(request, applySecurityHeaders(response))
}

/**
 * Configure which routes the middleware runs on
 */
export const config = {
  matcher: '/api/:path*',
}
