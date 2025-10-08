/**
 * GET /api/auth/me - Get current user information
 * Phase 3: Refactored to use modules/auth middleware
 */

import { NextResponse } from 'next/server'
import { auth } from '@/modules'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // Use requireUser() middleware from modules/auth
  const userOrResponse = await auth.middleware.requireUser(request)

  // If requireUser returns a NextResponse, it's an error response
  if (userOrResponse instanceof NextResponse) {
    return userOrResponse
  }

  // Otherwise, it's the authenticated user
  const user = userOrResponse

  // Return user information
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles,
      provider: user.provider,
    },
  })
}
