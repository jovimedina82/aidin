import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { AttachmentService } from '@/lib/services/AttachmentService'
import { prisma } from '@/lib/prisma'
import { hasTicketAccess } from '@/lib/access-control'

/**
 * GET /api/attachments?ticketId=xxx
 * Get attachments for a ticket
 */
export async function GET(request) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const ticketId = searchParams.get('ticketId')

    if (!ticketId) {
      return NextResponse.json({ error: 'ticketId is required' }, { status: 400 })
    }

    // Check access to ticket
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId }
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    const hasAccess = await hasTicketAccess(user, ticket)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const attachments = await AttachmentService.getTicketAttachments(ticketId)

    return NextResponse.json({ attachments })
  } catch (error) {
    console.error('Error fetching attachments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch attachments' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/attachments
 * Upload attachment to a ticket (optionally associated with a comment)
 */
export async function POST(request) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file')
    const ticketId = formData.get('ticketId')
    const commentId = formData.get('commentId') // Optional: link attachment to specific comment

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!ticketId) {
      return NextResponse.json({ error: 'ticketId is required' }, { status: 400 })
    }

    // Check access to ticket
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId }
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    const hasAccess = await hasTicketAccess(user, ticket)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Upload attachment (with optional commentId)
    const attachment = await AttachmentService.uploadAttachment(
      file,
      ticketId,
      user.id,
      commentId || null
    )

    return NextResponse.json({
      success: true,
      attachment
    })
  } catch (error) {
    console.error('Error uploading attachment:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to upload attachment' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/attachments/{id}
 * Delete an attachment
 */
export async function DELETE(request) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const attachmentId = searchParams.get('id')

    if (!attachmentId) {
      return NextResponse.json({ error: 'Attachment ID is required' }, { status: 400 })
    }

    // Get attachment and check access
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: { ticket: true }
    })

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    const hasAccess = await hasTicketAccess(user, attachment.ticket)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Delete attachment
    await AttachmentService.deleteAttachment(attachmentId, user.id, 'manual')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting attachment:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete attachment' },
      { status: 500 }
    )
  }
}
