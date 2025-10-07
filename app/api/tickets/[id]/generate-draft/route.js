import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { generateTicketResponse } from '@/lib/openai'
import { emitTicketUpdated } from '@/lib/socket'

/**
 * POST /api/tickets/{id}/generate-draft
 * Generate a new AI draft response for the ticket
 */
export async function POST(request, { params }) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ticketId = params.id

    // Get the ticket with full details
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
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
        }
      }
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    console.log(`🤖 Generating AI draft for ticket ${ticket.ticketNumber}...`)

    // Generate AI response
    const aiResponse = await generateTicketResponse(ticket)

    // Get AI user for tracking
    const aiUser = await prisma.user.findUnique({
      where: { email: 'ai-assistant@surterre.local' }
    })

    // Save AI response as draft
    const updatedTicket = await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        aiDraftResponse: aiResponse,
        aiDraftGeneratedAt: new Date(),
        aiDraftGeneratedBy: aiUser?.id || user.id
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
        },
        attachments: {
          orderBy: {
            uploadedAt: 'desc'
          }
        }
      }
    })

    console.log(`✅ AI draft generated for ticket ${ticket.ticketNumber}`)

    // Emit socket event for live updates
    emitTicketUpdated(updatedTicket)

    return NextResponse.json({
      success: true,
      message: 'AI draft generated successfully',
      ticket: updatedTicket,
      draft: aiResponse
    })
  } catch (error) {
    console.error('Error generating AI draft:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate AI draft' },
      { status: 500 }
    )
  }
}
