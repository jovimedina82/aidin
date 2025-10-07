import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

/**
 * POST /api/tickets/{id}/link
 * Link a ticket as a child to a parent ticket
 * Body: { parentTicketId: string }
 */
export async function POST(request, { params }) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ticketId = params.id
    const { parentTicketId } = await request.json()

    if (!parentTicketId) {
      return NextResponse.json(
        { error: 'parentTicketId is required' },
        { status: 400 }
      )
    }

    // Prevent linking to self
    if (ticketId === parentTicketId) {
      return NextResponse.json(
        { error: 'Cannot link ticket to itself' },
        { status: 400 }
      )
    }

    // Check if both tickets exist
    const [ticket, parentTicket] = await Promise.all([
      prisma.ticket.findUnique({ where: { id: ticketId } }),
      prisma.ticket.findUnique({ where: { id: parentTicketId } })
    ])

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    if (!parentTicket) {
      return NextResponse.json({ error: 'Parent ticket not found' }, { status: 404 })
    }

    // Prevent circular references
    if (parentTicket.parentTicketId === ticketId) {
      return NextResponse.json(
        { error: 'Cannot create circular ticket reference' },
        { status: 400 }
      )
    }

    // Update the ticket to link to parent
    const updatedTicket = await prisma.ticket.update({
      where: { id: ticketId },
      data: { parentTicketId },
      include: {
        parentTicket: {
          select: {
            id: true,
            ticketNumber: true,
            title: true,
            status: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      ticket: updatedTicket
    })
  } catch (error) {
    console.error('Error linking ticket:', error)
    return NextResponse.json(
      { error: 'Failed to link ticket', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/tickets/{id}/link
 * Unlink a ticket from its parent
 */
export async function DELETE(request, { params }) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ticketId = params.id

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId }
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    if (!ticket.parentTicketId) {
      return NextResponse.json(
        { error: 'Ticket is not linked to any parent' },
        { status: 400 }
      )
    }

    // Unlink from parent
    const updatedTicket = await prisma.ticket.update({
      where: { id: ticketId },
      data: { parentTicketId: null }
    })

    return NextResponse.json({
      success: true,
      ticket: updatedTicket
    })
  } catch (error) {
    console.error('Error unlinking ticket:', error)
    return NextResponse.json(
      { error: 'Failed to unlink ticket', details: error.message },
      { status: 500 }
    )
  }
}
