import { NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"
import { logEvent } from '@/lib/audit'

export async function POST(request, { params }) {
  try {
    // Get the authenticated user
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get the ticket
    const ticket = await prisma.ticket.findUnique({
      where: { id: params.id },
      include: {
        requester: true
      }
    })

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    // Check if user is the requester
    if (ticket.requesterId !== user.id) {
      return NextResponse.json(
        { error: 'Only the ticket requester can mark it as solved' },
        { status: 403 }
      )
    }

    // Update ticket status to SOLVED
    const updatedTicket = await prisma.ticket.update({
      where: { id: params.id },
      data: {
        status: 'SOLVED',
        resolvedAt: new Date()
      },
      include: {
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    })

    // Log the status change
    await logEvent({
      action: 'ticket.status_changed',
      actorId: user.id,
      actorEmail: user.email,
      actorType: 'human',
      entityType: 'ticket',
      entityId: ticket.id,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || null,
      oldValues: {
        status: ticket.status
      },
      newValues: {
        status: 'SOLVED'
      },
      metadata: {
        ticketNumber: ticket.ticketNumber,
        markedByRequester: true,
        reason: 'Requester marked ticket as solved'
      }
    })

    // Add an automatic comment
    await prisma.ticketComment.create({
      data: {
        ticketId: params.id,
        userId: user.id,
        content: '✅ **Issue Resolved**\n\nI have marked this ticket as solved. Thank you for your help!',
        isPublic: true
      }
    })

    console.log(`✅ Ticket #${ticket.ticketNumber} marked as SOLVED by requester ${user.email}`)

    return NextResponse.json(updatedTicket)
  } catch (error) {
    console.error('Error marking ticket as solved:', error)
    return NextResponse.json(
      { error: 'Failed to mark ticket as solved' },
      { status: 500 }
    )
  }
}
