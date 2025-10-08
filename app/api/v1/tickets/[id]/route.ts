/**
 * GET /api/v1/tickets/:id - Fetch single ticket
 * Phase 4: Clean implementation using tickets.service
 */

import { NextResponse } from 'next/server'
import { auth, tickets } from '@/modules'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Phase 3: Authenticate user
    const userOrResponse = await auth.middleware.requireUser(request)
    if (userOrResponse instanceof NextResponse) {
      return userOrResponse
    }
    const currentUser = userOrResponse

    // Phase 4: Call tickets.service.get with policy checks
    const policyUser = {
      id: currentUser.id,
      email: currentUser.email,
      roles: currentUser.roles,
    }

    const ticket = await tickets.service.get(policyUser, params.id)

    if (!ticket) {
      return NextResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Ticket not found',
          },
        },
        { status: 404 }
      )
    }

    return NextResponse.json(ticket)
  } catch (error: any) {
    if (error.message?.includes('FORBIDDEN')) {
      return NextResponse.json(
        {
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied. You do not have permission to view this ticket.',
          },
        },
        { status: 403 }
      )
    }

    console.error('Error fetching ticket:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch ticket',
        },
      },
      { status: 500 }
    )
  }
}
