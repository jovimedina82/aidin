import { NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"
import { verifyEmailActionToken } from '@/lib/email-token'
import { logEvent } from '@/lib/audit'

export async function POST(request) {
  try {
    const data = await request.json()
    const { token, rating, feedback } = data

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      )
    }

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Valid rating (1-5) is required' },
        { status: 400 }
      )
    }

    // Verify the token
    const verified = verifyEmailActionToken(token)

    if (!verified) {
      return NextResponse.json(
        { error: 'Invalid or expired link' },
        { status: 401 }
      )
    }

    // Get ticket with requester info
    const ticket = await prisma.ticket.findUnique({
      where: { id: verified.ticketId },
      include: {
        requester: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    })

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    // Check if survey was already submitted (one-time use)
    if (ticket.satisfactionRating !== null) {
      return NextResponse.json(
        { error: 'This survey has already been submitted. Thank you for your feedback!' },
        { status: 400 }
      )
    }

    // Update ticket status to SOLVED
    const updatedTicket = await prisma.ticket.update({
      where: { id: verified.ticketId },
      data: {
        status: 'SOLVED',
        resolvedAt: new Date(),
        satisfactionRating: rating,
        satisfactionFeedback: feedback || null
      }
    })

    // Add a comment to the ticket
    const ratingEmojis = ['😞', '😕', '😐', '😊', '😄']
    const ratingLabels = ['Very Dissatisfied', 'Dissatisfied', 'Neutral', 'Satisfied', 'Very Satisfied']

    let commentContent = `✅ **Issue Resolved by Customer**\n\n`
    commentContent += `**Satisfaction Rating:** ${ratingEmojis[rating - 1]} ${ratingLabels[rating - 1]} (${rating}/5)\n`

    if (feedback) {
      commentContent += `\n**Feedback:** ${feedback}`
    }

    await prisma.ticketComment.create({
      data: {
        ticketId: verified.ticketId,
        userId: ticket.requesterId,
        content: commentContent,
        isPublic: false // Internal note
      }
    })

    // Log the action
    await logEvent({
      action: 'ticket.marked_solved_via_survey',
      actorId: ticket.requesterId,
      actorEmail: ticket.requester.email,
      actorType: 'human',
      entityType: 'ticket',
      entityId: ticket.id,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || null,
      oldValues: {
        status: ticket.status
      },
      newValues: {
        status: 'SOLVED',
        satisfactionRating: rating
      },
      metadata: {
        ticketNumber: ticket.ticketNumber,
        viaEmailSurvey: true,
        satisfactionRating: rating,
        hasFeedback: !!feedback
      }
    })

    console.log(`✅ Ticket #${ticket.ticketNumber} marked as SOLVED via survey by ${ticket.requester.email} with rating ${rating}/5`)

    return NextResponse.json({
      success: true,
      ticketNumber: ticket.ticketNumber
    })
  } catch (error) {
    console.error('Error submitting satisfaction survey:', error)
    return NextResponse.json(
      { error: 'Failed to submit survey' },
      { status: 500 }
    )
  }
}
