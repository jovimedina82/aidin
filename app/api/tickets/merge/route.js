import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { emitTicketUpdated, emitTicketDeleted } from '@/lib/socket'

/**
 * POST /api/tickets/merge
 * Merge multiple tickets into one primary ticket
 * Body: { primaryTicketId: string, ticketIdsToMerge: string[] }
 */
export async function POST(request) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { primaryTicketId, ticketIdsToMerge } = await request.json()

    // Validation
    if (!primaryTicketId || !ticketIdsToMerge || !Array.isArray(ticketIdsToMerge)) {
      return NextResponse.json(
        { error: 'primaryTicketId and ticketIdsToMerge array are required' },
        { status: 400 }
      )
    }

    if (ticketIdsToMerge.length === 0) {
      return NextResponse.json(
        { error: 'At least one ticket to merge is required' },
        { status: 400 }
      )
    }

    // Prevent merging ticket into itself
    if (ticketIdsToMerge.includes(primaryTicketId)) {
      return NextResponse.json(
        { error: 'Cannot merge a ticket into itself' },
        { status: 400 }
      )
    }

    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Fetch all tickets
      const allTicketIds = [primaryTicketId, ...ticketIdsToMerge]
      const tickets = await tx.ticket.findMany({
        where: { id: { in: allTicketIds } },
        include: {
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
            orderBy: { createdAt: 'asc' }
          },
          attachments: true,
          requester: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      })

      // Verify all tickets exist
      if (tickets.length !== allTicketIds.length) {
        throw new Error('One or more tickets not found')
      }

      const primaryTicket = tickets.find(t => t.id === primaryTicketId)
      const ticketsToMerge = tickets.filter(t => ticketIdsToMerge.includes(t.id))

      if (!primaryTicket) {
        throw new Error('Primary ticket not found')
      }

      // Copy comments from tickets being merged
      const commentUpdates = []
      for (const ticket of ticketsToMerge) {
        for (const comment of ticket.comments) {
          commentUpdates.push(
            tx.ticketComment.update({
              where: { id: comment.id },
              data: { ticketId: primaryTicketId }
            })
          )
        }
      }
      await Promise.all(commentUpdates)

      // Copy attachments from tickets being merged
      const attachmentUpdates = []
      for (const ticket of ticketsToMerge) {
        for (const attachment of ticket.attachments) {
          attachmentUpdates.push(
            tx.attachment.update({
              where: { id: attachment.id },
              data: { ticketId: primaryTicketId }
            })
          )
        }
      }
      await Promise.all(attachmentUpdates)

      // Add a system comment noting the merge
      const mergedTicketNumbers = ticketsToMerge.map(t => t.ticketNumber).join(', ')
      await tx.ticketComment.create({
        data: {
          ticketId: primaryTicketId,
          userId: user.id,
          content: `**Tickets Merged**: ${mergedTicketNumbers} were merged into this ticket.`,
          isPublic: false,
          createdAt: new Date()
        }
      })

      // Delete the merged tickets
      await tx.ticket.deleteMany({
        where: { id: { in: ticketIdsToMerge } }
      })

      // Fetch updated primary ticket with all merged data
      const updatedPrimaryTicket = await tx.ticket.findUnique({
        where: { id: primaryTicketId },
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
          },
          parentTicket: {
            select: {
              id: true,
              ticketNumber: true,
              title: true,
              status: true,
              createdAt: true
            }
          },
          childTickets: {
            select: {
              id: true,
              ticketNumber: true,
              title: true,
              status: true,
              createdAt: true,
              requester: {
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

      return {
        primaryTicket: updatedPrimaryTicket,
        mergedTicketNumbers,
        mergedCount: ticketsToMerge.length
      }
    })

    // Emit socket events
    emitTicketUpdated(result.primaryTicket)
    ticketIdsToMerge.forEach(id => emitTicketDeleted(id))

    return NextResponse.json({
      success: true,
      message: `Successfully merged ${result.mergedCount} ticket(s) into ${result.primaryTicket.ticketNumber}`,
      ticket: result.primaryTicket,
      mergedTickets: result.mergedTicketNumbers
    })
  } catch (error) {
    console.error('Error merging tickets:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to merge tickets' },
      { status: 500 }
    )
  }
}
