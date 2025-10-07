import { NextResponse } from 'next/server'
import { EmailAttachmentHandler } from '@/lib/services/EmailAttachmentHandler'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/tickets/{id}/email-attachments
 * Process attachments from an email and attach them to a ticket
 *
 * Body:
 * {
 *   "messageId": "AAMkAGI...",  // Microsoft Graph message ID
 *   "userEmail": "helpdesk@surterreproperties.com"  // Optional, defaults to helpdesk
 * }
 */
export async function POST(request, { params }) {
  try {
    const ticketId = params.id
    const body = await request.json()
    const { messageId, userEmail } = body

    if (!messageId) {
      return NextResponse.json(
        { error: 'messageId is required' },
        { status: 400 }
      )
    }

    // Get ticket to find the requester
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        ticketNumber: true,
        requesterId: true
      }
    })

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    if (!ticket.requesterId) {
      return NextResponse.json(
        { error: 'Ticket has no requester' },
        { status: 400 }
      )
    }

    // Process attachments
    const handler = new EmailAttachmentHandler()
    const attachments = await handler.processEmailAttachments(
      messageId,
      ticketId,
      ticket.requesterId,
      userEmail || process.env.HELPDESK_EMAIL || 'helpdesk@surterreproperties.com'
    )

    return NextResponse.json({
      success: true,
      ticketId,
      ticketNumber: ticket.ticketNumber,
      attachmentsProcessed: attachments.length,
      attachments: attachments.map(a => ({
        id: a.id,
        fileName: a.fileName,
        fileSize: a.fileSize,
        mimeType: a.mimeType
      }))
    })

  } catch (error) {
    console.error('Error processing email attachments:', error)
    return NextResponse.json(
      {
        error: 'Failed to process email attachments',
        details: error.message
      },
      { status: 500 }
    )
  }
}
