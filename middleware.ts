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
 * Public paths that don't require authentication
 */
const PUBLIC_PATHS = [
  '/login',
  '/api/auth',
  '/_next',
  '/favicon.ico',
  '/assets',
  '/public',
  '/images'
]

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
 * Check if path is public (doesn't require auth)
 */
function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p))
}

/**
 * Check if request has valid auth token
 */
function isAuthenticated(request: NextRequest): boolean {
  const authToken = request.cookies.get('authToken')?.value
  return !!authToken
}

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
 * Global middleware - applies to all routes
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Handle public paths first
  if (isPublicPath(pathname)) {
    // Apply security/CORS/rate-limiting to API routes
    if (pathname.startsWith('/api/')) {
      return handleApiRoute(request)
    }
    return NextResponse.next()
  }

  // Protected app routes - require authentication
  const needsAuth =
    pathname === '/' ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/tickets') ||
    pathname.startsWith('/knowledge-base') ||
    pathname.startsWith('/users') ||
    pathname.startsWith('/admin')

  if (needsAuth && !isAuthenticated(request)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('from', pathname)
    return NextResponse.redirect(url)
  }

  // Apply security to API routes
  if (pathname.startsWith('/api/')) {
    return handleApiRoute(request)
  }

  return NextResponse.next()
}

/**
 * Handle API route logic (rate limiting, CORS, security headers)
 */
function handleApiRoute(request: NextRequest) {
  const { pathname } = request.nextUrl

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
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)'
  ],
}
