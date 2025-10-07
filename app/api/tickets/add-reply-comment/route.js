import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emitTicketUpdated } from '@/lib/socket'

/**
 * POST /api/tickets/add-reply-comment
 * Add email reply as comment to existing ticket
 * Called by n8n workflow when reply is detected in email subject
 *
 * Body: {
 *   ticketNumber: "IT000048",
 *   emailFrom: "user@example.com",
 *   emailBody: "Reply content",
 *   emailSubject: "RE: Subject [Ticket #IT000048]"
 * }
 */
export async function POST(request) {
  try {
    const { ticketNumber, emailFrom, emailBody, emailSubject } = await request.json()

    if (!ticketNumber || !emailBody) {
      return NextResponse.json(
        { error: 'Missing required fields: ticketNumber and emailBody are required' },
        { status: 400 }
      )
    }

    console.log(`📧 Processing email reply for ticket ${ticketNumber} from ${emailFrom}`)

    // Find ticket by ticket number
    const ticket = await prisma.ticket.findUnique({
      where: { ticketNumber },
      include: {
        requester: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
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
      console.error(`❌ Ticket ${ticketNumber} not found`)
      return NextResponse.json(
        { error: `Ticket ${ticketNumber} not found` },
        { status: 404 }
      )
    }

    // Verify email is from the requester
    const isRequester = ticket.requester?.email?.toLowerCase() === emailFrom?.toLowerCase()

    if (!isRequester) {
      console.warn(`⚠️  Reply from ${emailFrom} but ticket requester is ${ticket.requester?.email}`)
      // Continue anyway - could be CC'd recipient or forwarded email
    }

    // Find user by email (could be requester or another user)
    let commentUser = await prisma.user.findUnique({
      where: { email: emailFrom }
    })

    // If sender not found in system, use the ticket requester as fallback
    if (!commentUser) {
      console.log(`ℹ️  User ${emailFrom} not found, using ticket requester`)
      commentUser = ticket.requester
    }

    if (!commentUser) {
      console.error(`❌ No user found for ${emailFrom} and ticket has no requester`)
      return NextResponse.json(
        { error: 'Cannot determine comment author' },
        { status: 404 }
      )
    }

    // Clean up email body (remove HTML if present, limit length)
    let cleanedBody = emailBody
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\r\n/g, '\n') // Normalize line endings
      .trim()

    // Limit length to prevent huge comments
    if (cleanedBody.length > 5000) {
      cleanedBody = cleanedBody.substring(0, 5000) + '\n\n...(truncated)'
    }

    // Create comment from email reply
    const comment = await prisma.ticketComment.create({
      data: {
        ticketId: ticket.id,
        userId: commentUser.id,
        content: `**Email Reply from ${commentUser.firstName} ${commentUser.lastName}:**\n\n${cleanedBody}`,
        isPublic: true,
        createdAt: new Date()
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    })

    // Update ticket status based on who replied
    let statusUpdate = {}

    if (isRequester && ticket.status === 'NEW') {
      // If requester replies to NEW ticket, mark as OPEN
      statusUpdate = { status: 'OPEN' }
      console.log(`🔄 Updating ticket status NEW → OPEN (requester replied)`)
    } else if (isRequester && ticket.status === 'PENDING') {
      // If requester replies to PENDING ticket, mark as OPEN (waiting on staff now)
      statusUpdate = { status: 'OPEN' }
      console.log(`🔄 Updating ticket status PENDING → OPEN (requester provided info)`)
    }

    // Apply status update if needed
    let updatedTicket = ticket
    if (Object.keys(statusUpdate).length > 0) {
      updatedTicket = await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          ...statusUpdate,
          updatedAt: new Date()
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

      // Emit socket event for real-time updates
      emitTicketUpdated(updatedTicket)
    }

    console.log(`✅ Email reply added as comment to ticket ${ticketNumber}`)

    return NextResponse.json({
      success: true,
      ticketNumber,
      ticketId: ticket.id,
      commentId: comment.id,
      statusChanged: Object.keys(statusUpdate).length > 0,
      newStatus: statusUpdate.status || ticket.status,
      message: 'Email reply added to ticket successfully'
    })

  } catch (error) {
    console.error('Error adding reply comment:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to add reply comment' },
      { status: 500 }
    )
  }
}
