/**
 * Authentication Middleware
 * Phase 3 Implementation - Real authentication and authorization
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma.js'
import { extractToken, verifyToken } from './jwt'
import type { AuthUser } from './domain'
import { Provider } from './domain'

/**
 * Middleware to require authenticated user
 * Extracts JWT from request, validates it, and fetches user from database
 * @param request - Next.js Request object
 * @returns AuthUser object or 401 NextResponse
 */
export async function requireUser(request: Request): Promise<AuthUser | NextResponse> {
  // Extract token from Authorization header or cookies
  const token = extractToken(request)

  if (!token) {
    return NextResponse.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      },
      { status: 401 }
    )
  }

  // Verify and decode token
  const decoded = verifyToken(token)

  if (!decoded?.userId) {
    return NextResponse.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token',
        },
      },
      { status: 401 }
    )
  }

  // Fetch user from database with roles
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    include: {
      roles: {
        include: {
          role: true,
        },
      },
    },
  })

  if (!user) {
    return NextResponse.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not found',
        },
      },
      { status: 401 }
    )
  }

  if (!user.isActive) {
    return NextResponse.json(
      {
        error: {
          code: 'FORBIDDEN',
          message: 'User account is inactive',
        },
      },
      { status: 403 }
    )
  }

  // Map database user to AuthUser interface
  const authUser: AuthUser = {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    roles: user.roles.map((r) => r.role.name),
    provider: user.azureId ? Provider.AZURE_AD : Provider.LOCAL,
  }

  return authUser
}

/**
 * Middleware to require specific roles
 * Checks if user has at least one of the required roles
 * @param user - Authenticated user object
 * @param requiredRoles - Array of role names (e.g., ['ADMIN', 'STAFF'])
 * @returns void if authorized, 403 NextResponse if not
 */
export async function requireRoles(
  user: AuthUser,
  requiredRoles: string[]
): Promise<void | NextResponse> {
  const hasRequiredRole = user.roles.some((role) =>
    requiredRoles.includes(role.toUpperCase())
  )

  if (!hasRequiredRole) {
    return NextResponse.json(
      {
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Required roles: ${requiredRoles.join(', ')}`,
        },
      },
      { status: 403 }
    )
  }

  // User has required role
  return
}

/**
 * Middleware to require specific permissions
 * Checks if user has all required permissions
 * @param user - Authenticated user object
 * @param permissions - Array of permission strings
 * @returns void if authorized, 403 NextResponse if not
 */
export async function requirePermissions(
  user: AuthUser,
  permissions: string[]
): Promise<void | NextResponse> {
  // Fetch user roles with permissions from database
  const userRoles = await prisma.userRole.findMany({
    where: { userId: user.id },
    include: { role: true },
  })

  // Collect all permissions from user's roles
  const userPermissions = new Set<string>()
  for (const userRole of userRoles) {
    const rolePermissions = userRole.role.permissions as string[]
    rolePermissions.forEach((perm) => userPermissions.add(perm))
  }

  // Check if user has all required permissions
  const hasAllPermissions = permissions.every((perm) => userPermissions.has(perm))

  if (!hasAllPermissions) {
    return NextResponse.json(
      {
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Missing required permissions.`,
        },
      },
      { status: 403 }
    )
  }

  // User has all required permissions
  return
}
