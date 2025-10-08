/**
 * Ticket Assignment API
 * Phase 8: Workflow-based ticket assignment
 *
 * PATCH /api/tickets/:id/assign
 * Assigns or unassigns a ticket to an agent
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

    // assigneeId can be null to unassign
    if (!('assigneeId' in data)) {
      return NextResponse.json(
        { error: 'assigneeId is required (use null to unassign)' },
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

    // Assign via workflow
    try {
      const updatedTicket = await workflows.assign(
        {
          id: user.id,
          email: user.email,
          roles: user.roles,
        },
        ticket,
        data.assigneeId
      )

      return NextResponse.json(updatedTicket)
    } catch (error) {
      if (error.message.includes('Forbidden')) {
        return NextResponse.json(
          { error: error.message },
          { status: 403 }
        )
      }
      throw error
    }
  } catch (error) {
    console.error('Error assigning ticket:', error)
    return NextResponse.json(
      { error: 'Failed to assign ticket' },
      { status: 500 }
    )
  }
}
