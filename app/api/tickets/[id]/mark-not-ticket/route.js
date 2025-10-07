import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

/**
 * POST /api/tickets/{id}/mark-not-ticket
 * Marks a ticket as "Not a Ticket", provides feedback to the AI classifier,
 * forwards the original email to help@surterreproperties.com, and deletes the ticket
 */
export async function POST(request, { params }) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is staff/admin
    const userRoles = user.roles || []
    const roleNames = userRoles.map(r => r.role?.name || r.name || r)
    const isStaff = roleNames.some(role => ['Admin', 'Manager', 'Staff'].includes(role))

    if (!isStaff) {
      return NextResponse.json({ error: 'Only staff can mark tickets as not a ticket' }, { status: 403 })
    }

    const ticketId = params.id
    const { reason } = await request.json()

    // Get the ticket with all related data
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
        comments: {
          orderBy: {
            createdAt: 'asc'
          },
          take: 1 // Get the first comment (original email body)
        },
        aiDecision: true
      }
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Extract original email data
    const emailFrom = ticket.requester?.email || 'unknown'
    const emailSubject = ticket.title
    const emailBody = ticket.description + (ticket.comments[0]?.content || '')
    const originalCategory = ticket.category

    console.log(`📋 Marking ticket ${ticket.ticketNumber} as NOT A TICKET`)
    console.log(`   From: ${emailFrom}`)
    console.log(`   Subject: ${emailSubject}`)
    console.log(`   Original Category: ${originalCategory}`)

    // Create classifier feedback record
    const feedback = await prisma.classifierFeedback.create({
      data: {
        ticketId: ticket.id,
        emailFrom,
        emailSubject,
        emailBody,
        originalCategory,
        feedbackType: 'NOT_TICKET',
        reason: reason || 'Marked as not a ticket by staff',
        userId: user.id
      }
    })

    console.log(`✅ Classifier feedback created: ${feedback.id}`)

    // Forward the original email to help@surterreproperties.com
    try {
      const { getEmailService } = await import('@/lib/services/EmailService.js')
      const emailService = getEmailService()

      const forwardBody = `This email was incorrectly classified as a helpdesk ticket and has been removed from the system.

Original Email:
---------------
From: ${emailFrom}
Subject: ${emailSubject}
Date: ${ticket.createdAt}

${emailBody}

---------------
Ticket Number: ${ticket.ticketNumber}
Original Category: ${originalCategory || 'None'}
Marked by: ${user.firstName} ${user.lastName} (${user.email})
Reason: ${reason || 'Not a ticket'}

This email should be handled through normal channels, not the helpdesk ticketing system.`

      await emailService.sendEmail(
        'help@surterreproperties.com',
        `FWD: ${emailSubject} [Not a Ticket]`,
        forwardBody
      )

      console.log(`📧 Original email forwarded to help@surterreproperties.com`)
    } catch (emailError) {
      console.error('Failed to forward email:', emailError.message)
      // Continue with ticket deletion even if email forwarding fails
    }

    // Delete the ticket and all related data (cascade will handle it)
    await prisma.ticket.delete({
      where: { id: ticketId }
    })

    console.log(`🗑️  Ticket ${ticket.ticketNumber} deleted successfully`)

    return NextResponse.json({
      success: true,
      message: 'Ticket marked as not a ticket, feedback recorded, and email forwarded',
      feedback: {
        id: feedback.id,
        feedbackType: feedback.feedbackType,
        ticketNumber: ticket.ticketNumber
      }
    })

  } catch (error) {
    console.error('Error marking ticket as not a ticket:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to mark ticket as not a ticket' },
      { status: 500 }
    )
  }
}
