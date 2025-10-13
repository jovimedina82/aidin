import { NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"

export async function GET(request, { params }) {
  try {
    const currentUser = await getCurrentUser(request)
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get ticket to verify access
    const ticket = await prisma.ticket.findUnique({
      where: { id: params.id },
      select: { id: true }
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Fetch all audit logs related to this ticket
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { entityId: params.id },  // Direct ticket actions
          { targetId: params.id }   // Actions that reference the ticket
        ]
      },
      orderBy: { ts: 'asc' }
    })

    // Fetch comments with timestamps
    const comments = await prisma.ticketComment.findMany({
      where: { ticketId: params.id },
      select: {
        id: true,
        createdAt: true,
        isPublic: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    // Fetch attachments with timestamps
    const attachments = await prisma.attachment.findMany({
      where: { ticketId: params.id },
      select: {
        id: true,
        fileName: true,
        uploadedAt: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: { uploadedAt: 'asc' }
    })

    // Get ticket creation and resolution times
    const ticketDetails = await prisma.ticket.findUnique({
      where: { id: params.id },
      select: {
        createdAt: true,
        resolvedAt: true,
        ticketNumber: true
      }
    })

    // Build a unified timeline
    const timeline = []

    // Add ticket creation
    timeline.push({
      type: 'created',
      timestamp: ticketDetails.createdAt,
      icon: 'plus',
      title: 'Ticket Created',
      description: `Ticket #${ticketDetails.ticketNumber} was created`
    })

    // Add comments
    comments.forEach(comment => {
      timeline.push({
        type: comment.isPublic ? 'comment' : 'internal_note',
        timestamp: comment.createdAt,
        icon: comment.isPublic ? 'message' : 'lock',
        title: comment.isPublic ? 'Comment Added' : 'Internal Note Added',
        description: `${comment.user.firstName} ${comment.user.lastName} added a ${comment.isPublic ? 'comment' : 'note'}`,
        actorName: `${comment.user.firstName} ${comment.user.lastName}`,
        actorEmail: comment.user.email
      })
    })

    // Add attachments
    attachments.forEach(attachment => {
      timeline.push({
        type: 'attachment',
        timestamp: attachment.uploadedAt,
        icon: 'paperclip',
        title: 'Attachment Added',
        description: `${attachment.user.firstName} ${attachment.user.lastName} uploaded ${attachment.fileName}`,
        actorName: `${attachment.user.firstName} ${attachment.user.lastName}`,
        actorEmail: attachment.user.email,
        fileName: attachment.fileName
      })
    })

    // Add audit log events
    auditLogs.forEach(log => {
      const metadata = log.metadata ? JSON.parse(log.metadata) : {}
      const newValues = log.newValues ? JSON.parse(log.newValues) : {}
      const prevValues = log.prevValues ? JSON.parse(log.prevValues) : {}

      let title = ''
      let description = ''
      let icon = 'activity'

      switch (log.action) {
        case 'ticket.taken':
          title = 'Ticket Taken'
          description = `${metadata.assignedTo || log.actorEmail} took the ticket`
          icon = 'user-check'
          break

        case 'ticket.assigned':
          title = 'Ticket Assigned'
          description = `Assigned to ${metadata.assignedTo || 'someone'}`
          icon = 'user-plus'
          break

        case 'ticket.unassigned':
          title = 'Ticket Unassigned'
          description = `Unassigned from ${metadata.previousAssignee || 'previous assignee'}`
          icon = 'user-minus'
          break

        case 'ticket.status_changed':
          title = 'Status Changed'
          description = `Changed from ${metadata.fromStatus || prevValues.status} to ${metadata.toStatus || newValues.status}`
          icon = 'refresh-cw'
          break

        case 'ticket.requester_changed':
          title = 'Requester Changed'
          description = `Changed from ${metadata.previousRequester} to ${metadata.newRequester}`
          icon = 'user'
          break

        case 'comment.created':
          // Skip - already handled by comments array above
          return

        default:
          if (!log.action.startsWith('ticket.')) return
          title = log.action.replace('ticket.', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
          description = `${log.actorEmail} performed action`
          break
      }

      if (title) {
        timeline.push({
          type: log.action,
          timestamp: log.ts,
          icon,
          title,
          description,
          actorEmail: log.actorEmail,
          metadata
        })
      }
    })

    // Add resolution
    if (ticketDetails.resolvedAt) {
      timeline.push({
        type: 'resolved',
        timestamp: ticketDetails.resolvedAt,
        icon: 'check-circle',
        title: 'Ticket Resolved',
        description: 'Ticket was marked as solved'
      })
    }

    // Sort timeline by timestamp
    timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

    return NextResponse.json({ timeline })
  } catch (error) {
    console.error('Error fetching ticket activity:', error)
    return NextResponse.json(
      { error: 'Failed to fetch activity' },
      { status: 500 }
    )
  }
}
