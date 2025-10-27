/**
 * POST /api/auth/mint-token
 *
 * Admin-only endpoint to generate JWT tokens for API testing.
 * Requires: Admin or Manager role
 *
 * Usage:
 * 1. Login as admin via browser (to get session cookie)
 * 2. curl -s -X POST -b cookies.txt https://<DOMAIN>/api/auth/mint-token | jq -r .token
 * 3. Use token in Authorization header: curl -H "Authorization: Bearer <token>" ...
 */

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { isAdmin } from '@/lib/role-utils'
import { extractRoleNames } from '@/lib/role-utils'
import jwt from 'jsonwebtoken'
import { logEvent } from '@/lib/audit/logger'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(request: Request) {
  try {
    // 1. Get current user from session
    const user = await getCurrentUser(request)

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - no active session' },
        { status: 401 }
      )
    }

    // 2. Check if user is admin
    if (!isAdmin(user)) {
      await logEvent({
        action: 'auth.mint_token.forbidden',
        actorId: user.id,
        actorEmail: user.email,
        actorType: 'human',
        entityType: 'user',
        entityId: user.id,
        metadata: {
          reason: 'not_admin',
          roles: extractRoleNames(user.roles),
        },
        redactionLevel: 1,
      })

      return NextResponse.json(
        { error: 'Forbidden - admin access required' },
        { status: 403 }
      )
    }

    // 3. Check JWT_SECRET is configured
    const secret = process.env.JWT_SECRET
    if (!secret) {
      console.error('JWT_SECRET not configured')
      return NextResponse.json(
        { error: 'Server misconfiguration' },
        { status: 500 }
      )
    }

    // 4. Generate JWT token with same structure as login route
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: extractRoleNames(user.roles),
      },
      secret,
      {
        expiresIn: '30m', // Short-lived for testing
        issuer: 'aidin',
      }
    )

    // 5. Audit log
    await logEvent({
      action: 'auth.mint_token.success',
      actorId: user.id,
      actorEmail: user.email,
      actorType: 'human',
      entityType: 'user',
      entityId: user.id,
      metadata: {
        expiresIn: '30m',
        purpose: 'api_testing',
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      },
      redactionLevel: 1,
    })

    // 6. Return token
    return NextResponse.json(
      {
        token,
        expiresIn: '30m',
        user: {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          roles: extractRoleNames(user.roles),
        },
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('❌ Error minting token:', error)

    return NextResponse.json(
      {
        error: 'Failed to mint token',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
