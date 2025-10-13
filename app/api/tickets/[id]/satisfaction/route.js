import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { logEvent } from '@/lib/audit'

/**
 * Submit satisfaction rating for a ticket
 * POST /api/tickets/[id]/satisfaction
 */
export async function POST(request, { params }) {
  try {
    const currentUser = await getCurrentUser(request)
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { rating, feedback } = await request.json()

    // Validate rating (1-5 scale)
    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      )
    }

    // Get the ticket
    const ticket = await prisma.ticket.findUnique({
      where: { id: params.id },
      include: {
        requester: true,
        assignee: true
      }
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Only the requester can rate their own ticket
    if (ticket.requesterId !== currentUser.id) {
      return NextResponse.json(
        { error: 'Only the ticket requester can submit a satisfaction rating' },
        { status: 403 }
      )
    }

    // Update the ticket with satisfaction rating
    const updatedTicket = await prisma.ticket.update({
      where: { id: params.id },
      data: {
        satisfactionRating: rating,
        satisfactionFeedback: feedback || null
      }
    })

    // Log the satisfaction rating
    await logEvent({
      action: 'ticket.satisfaction_rated',
      actorId: currentUser.id,
      actorEmail: currentUser.email,
      actorType: 'human',
      entityType: 'ticket',
      entityId: ticket.id,
      newValues: {
        satisfactionRating: rating,
        satisfactionFeedback: feedback || null
      },
      metadata: {
        ticketNumber: ticket.ticketNumber,
        assigneeEmail: ticket.assignee?.email,
        ratedBy: currentUser.email
      }
    })

    return NextResponse.json({
      success: true,
      ticket: updatedTicket
    })
  } catch (error) {
    console.error('Error submitting satisfaction rating:', error)
    return NextResponse.json(
      { error: 'Failed to submit satisfaction rating' },
      { status: 500 }
    )
  }
}
