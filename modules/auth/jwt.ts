/**
 * JWT Token Helpers
 * Phase 3 Implementation - Real JWT token generation and verification
 */

import jwt from 'jsonwebtoken'
import type { AuthUser, TokenPair } from './domain'

// JWT_SECRET is required for security
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error(
    'CRITICAL SECURITY ERROR: JWT_SECRET environment variable is required. Application cannot start without it.'
  )
}

// Token expiration times
const ACCESS_TOKEN_EXPIRY = '7d' // 7 days
const REFRESH_TOKEN_EXPIRY = '30d' // 30 days

/**
 * Sign a JWT token for a user
 * @param user - Authenticated user object
 * @returns Token pair with access token and optional refresh token
 */
export function signToken(user: AuthUser): TokenPair {
  const payload = {
    userId: user.id,
    email: user.email,
    roles: user.roles,
  }

  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  })

  // Parse expiry to seconds for the response
  const expiresIn = 7 * 24 * 60 * 60 // 7 days in seconds

  return {
    accessToken,
    expiresIn,
  }
}

/**
 * Verify and decode a JWT token
 * @param token - JWT token string
 * @returns Decoded user payload or null if invalid
 */
export function verifyToken(
  token: string
): { userId: string; email: string; roles: string[] } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string
      email: string
      roles: string[]
    }

    if (!decoded?.userId) {
      return null
    }

    return decoded
  } catch (error) {
    // Token expired, malformed, or invalid signature
    return null
  }
}

/**
 * Extract token from request headers or cookies
 * @param request - Next.js Request object
 * @returns Token string or null if not found
 */
export function extractToken(request: Request): string | null {
  // Try Authorization header first (Bearer token)
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }

  // Fallback to cookies (legacy support)
  const cookies = request.headers.get('cookie')
  if (cookies) {
    const authTokenMatch = cookies.match(/authToken=([^;]+)/)
    if (authTokenMatch) {
      return authTokenMatch[1]
    }
  }

  return null
}
