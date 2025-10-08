/**
 * Authentication Middleware Stubs
 * Phase 2 Scaffold - Returns 501 if used
 */

import { NextResponse } from 'next/server'
import type { AuthUser } from './domain'

/**
 * Middleware to require authenticated user
 * TODO: Implement in Phase 3 - extract and validate JWT from request
 * @returns 501 Not Implemented (stub)
 */
export async function requireUser(request: Request): Promise<AuthUser | NextResponse> {
  // TODO: Extract token from Authorization header
  // TODO: Validate token using validateToken()
  // TODO: Return user if valid, or 401 response
  return NextResponse.json(
    {
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'requireUser() middleware not implemented - Phase 2 scaffold',
      },
    },
    { status: 501 }
  )
}

/**
 * Middleware to require specific roles
 * TODO: Implement in Phase 3 - check user roles against required roles
 * @returns 501 Not Implemented (stub)
 */
export async function requireRoles(
  user: AuthUser,
  requiredRoles: string[]
): Promise<void | NextResponse> {
  // TODO: Check if user has any of the required roles
  // TODO: Return 403 if user doesn't have required role
  return NextResponse.json(
    {
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'requireRoles() middleware not implemented - Phase 2 scaffold',
      },
    },
    { status: 501 }
  )
}

/**
 * Middleware to require specific permissions
 * TODO: Implement in Phase 3 - check user permissions
 * @returns 501 Not Implemented (stub)
 */
export async function requirePermissions(
  user: AuthUser,
  permissions: string[]
): Promise<void | NextResponse> {
  // TODO: Load user permissions from database
  // TODO: Check if user has all required permissions
  // TODO: Return 403 if user doesn't have permissions
  return NextResponse.json(
    {
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'requirePermissions() middleware not implemented - Phase 2 scaffold',
      },
    },
    { status: 501 }
  )
}
