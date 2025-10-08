/**
 * POST /api/v1/tickets - Create ticket
 * Phase 4: Clean implementation using tickets.service
 */

import { NextResponse } from 'next/server'
import { auth, tickets } from '@/modules'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    // Phase 3: Authenticate user
    const userOrResponse = await auth.middleware.requireUser(request)
    if (userOrResponse instanceof NextResponse) {
      return userOrResponse
    }
    const currentUser = userOrResponse

    // Parse request body
    const body = await request.json()

    // Validate required fields
    if (!body.title || !body.description) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Title and description are required',
          },
        },
        { status: 400 }
      )
    }

    // Phase 4: Call tickets.service.create with policy checks
    const policyUser = {
      id: currentUser.id,
      email: currentUser.email,
      roles: currentUser.roles,
    }

    const ticket = await tickets.service.create(policyUser, {
      title: body.title,
      description: body.description,
      priority: body.priority,
      category: body.category,
      requesterId: body.requesterId, // Optional: for staff/admin creating on behalf of others
    })

    return NextResponse.json(ticket, { status: 201 })
  } catch (error: any) {
    if (error.message?.includes('FORBIDDEN')) {
      return NextResponse.json(
        {
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied. You do not have permission to create tickets.',
          },
        },
        { status: 403 }
      )
    }

    console.error('Error creating ticket:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create ticket',
        },
      },
      { status: 500 }
    )
  }
}
