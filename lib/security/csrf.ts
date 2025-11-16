/**
 * CSRF (Cross-Site Request Forgery) Protection
 *
 * Implements double-submit cookie pattern for CSRF protection.
 * Works with Next.js API routes and provides utilities for frontend.
 *
 * Usage:
 * 1. Generate token on login and set as cookie
 * 2. Frontend sends token in header on state-changing requests
 * 3. Server validates token matches cookie
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import logger from '@/lib/logger';

const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';

// Methods that require CSRF protection (state-changing)
const PROTECTED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

// Paths that are exempt from CSRF protection (e.g., webhooks with their own auth)
const EXEMPT_PATHS = [
  '/api/webhooks/',
  '/api/inbound/',
  '/api/public/',
  '/api/cron/',
];

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * Set CSRF token cookie in response
 */
export function setCSRFCookie(response: NextResponse, token?: string): string {
  const csrfToken = token || generateCSRFToken();

  response.cookies.set(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false, // Must be readable by JavaScript
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  });

  return csrfToken;
}

/**
 * Get CSRF token from request cookie
 */
export function getCSRFCookieToken(request: NextRequest): string | null {
  return request.cookies.get(CSRF_COOKIE_NAME)?.value || null;
}

/**
 * Get CSRF token from request header
 */
export function getCSRFHeaderToken(request: NextRequest): string | null {
  return request.headers.get(CSRF_HEADER_NAME);
}

/**
 * Validate CSRF token using timing-safe comparison
 */
export function validateCSRFToken(cookieToken: string, headerToken: string): boolean {
  if (!cookieToken || !headerToken) {
    return false;
  }

  if (cookieToken.length !== headerToken.length) {
    return false;
  }

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(cookieToken),
      Buffer.from(headerToken)
    );
  } catch {
    return false;
  }
}

/**
 * Check if path is exempt from CSRF protection
 */
function isExemptPath(pathname: string): boolean {
  return EXEMPT_PATHS.some(exemptPath => pathname.startsWith(exemptPath));
}

/**
 * CSRF protection middleware for API routes
 *
 * Use this wrapper to protect state-changing endpoints:
 *
 * ```typescript
 * import { withCSRFProtection } from '@/lib/security/csrf';
 *
 * export const POST = withCSRFProtection(async (request) => {
 *   // Your handler logic
 * });
 * ```
 */
export function withCSRFProtection(
  handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: any[]): Promise<NextResponse> => {
    const { pathname } = new URL(request.url);

    // Skip CSRF check for safe methods
    if (!PROTECTED_METHODS.includes(request.method)) {
      return handler(request, ...args);
    }

    // Skip CSRF check for exempt paths
    if (isExemptPath(pathname)) {
      return handler(request, ...args);
    }

    // Check if CSRF protection is enabled (can disable in dev if needed)
    if (process.env.CSRF_PROTECTION_ENABLED === 'false') {
      logger.warn('CSRF protection disabled - NOT RECOMMENDED', { pathname });
      return handler(request, ...args);
    }

    const cookieToken = getCSRFCookieToken(request);
    const headerToken = getCSRFHeaderToken(request);

    if (!cookieToken) {
      logger.warn('CSRF validation failed: No cookie token', {
        pathname,
        method: request.method,
        ip: request.headers.get('x-forwarded-for') || 'unknown'
      });
      return NextResponse.json(
        { error: 'CSRF validation failed: Missing token' },
        { status: 403 }
      );
    }

    if (!headerToken) {
      logger.warn('CSRF validation failed: No header token', {
        pathname,
        method: request.method,
        ip: request.headers.get('x-forwarded-for') || 'unknown'
      });
      return NextResponse.json(
        { error: 'CSRF validation failed: Missing token in request' },
        { status: 403 }
      );
    }

    if (!validateCSRFToken(cookieToken, headerToken)) {
      logger.warn('CSRF validation failed: Token mismatch', {
        pathname,
        method: request.method,
        ip: request.headers.get('x-forwarded-for') || 'unknown'
      });
      return NextResponse.json(
        { error: 'CSRF validation failed: Invalid token' },
        { status: 403 }
      );
    }

    // CSRF validation passed
    return handler(request, ...args);
  };
}

/**
 * API endpoint to get a new CSRF token
 * Include this in your auth flow
 */
export async function getCSRFTokenEndpoint(request: NextRequest): Promise<NextResponse> {
  const existingToken = getCSRFCookieToken(request);
  const token = existingToken || generateCSRFToken();

  const response = NextResponse.json({ csrfToken: token });

  // Set or refresh the cookie
  setCSRFCookie(response, token);

  return response;
}

/**
 * Refresh CSRF token on login
 * Call this after successful authentication
 */
export function refreshCSRFTokenOnLogin(response: NextResponse): void {
  // Generate new token on login to prevent session fixation
  setCSRFCookie(response);
}
