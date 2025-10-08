/**
 * Phase 10 RC1: Security Middleware
 * Standard security headers and CORS configuration
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Apply standard security headers to response
 */
export function applySecurityHeaders(response: NextResponse): NextResponse {
  // HSTS - Force HTTPS for 180 days
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=15552000; includeSubDomains'
  )

  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff')

  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY')

  // Control referrer information
  response.headers.set('Referrer-Policy', 'no-referrer')

  // Restrict browser features
  response.headers.set(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=()'
  )

  // Content Security Policy - restrictive default
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none';"
  )

  return response
}

/**
 * Check if origin is allowed based on ALLOWED_ORIGINS env var
 * Falls back to same-origin if not configured
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false

  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS
  if (!allowedOriginsEnv) {
    // No ALLOWED_ORIGINS configured - deny cross-origin
    return false
  }

  const allowedOrigins = allowedOriginsEnv
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)

  return allowedOrigins.includes(origin)
}

/**
 * Apply CORS headers if origin is allowed
 */
export function applyCorsHeaders(
  request: NextRequest,
  response: NextResponse
): NextResponse {
  const origin = request.headers.get('origin')

  if (origin && isOriginAllowed(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Access-Control-Allow-Credentials', 'true')
    response.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PATCH, DELETE, OPTIONS'
    )
    response.headers.set(
      'Access-Control-Allow-Headers',
      'Authorization, Content-Type'
    )
    response.headers.set('Access-Control-Max-Age', '86400')
  }

  return response
}

/**
 * Handle OPTIONS preflight request
 */
export function handlePreflight(request: NextRequest): NextResponse {
  const response = new NextResponse(null, { status: 204 })
  return applyCorsHeaders(request, applySecurityHeaders(response))
}
