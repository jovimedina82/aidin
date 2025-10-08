/**
 * Ticket Status Transition API
 * Phase 8: Workflow-based status transitions
 *
 * PATCH /api/tickets/:id/status
 * Updates ticket status with workflow validation
 */

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import * as workflows from '@/modules/tickets/workflows'
import * as service from '@/modules/tickets/service'

export async function PATCH(request, { params }) {
  try {
    // Require authentication
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Parse request body
    const data = await request.json()

    if (!data.status) {
      return NextResponse.json(
        { error: 'Status is required' },
        { status: 400 }
      )
    }

    // Fetch current ticket
    const ticket = await service.get(user, params.id)
    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    // Transition via workflow
    try {
      const updatedTicket = await workflows.transition(
        {
          id: user.id,
          email: user.email,
          roles: user.roles,
        },
        ticket,
        data.status
      )

      return NextResponse.json(updatedTicket)
    } catch (error) {
      if (error.message.includes('Invalid transition')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        )
      }
      if (error.message.includes('Forbidden')) {
        return NextResponse.json(
          { error: error.message },
          { status: 403 }
        )
      }
      throw error
    }
  } catch (error) {
    console.error('Error updating ticket status:', error)
    return NextResponse.json(
      { error: 'Failed to update ticket status' },
      { status: 500 }
    )
  }
}
