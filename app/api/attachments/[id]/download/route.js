import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { AttachmentService } from '@/lib/services/AttachmentService'
import { prisma } from '@/lib/prisma'
import { hasTicketAccess } from '@/lib/access-control'
import fs from 'fs/promises'

/**
 * GET /api/attachments/[id]/download
 * Download an attachment file
 */
export async function GET(request, { params }) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const attachmentId = params.id

    // Get attachment and verify access
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

    // Get file
    const { fullPath } = await AttachmentService.getAttachmentFile(attachmentId)
    const fileBuffer = await fs.readFile(fullPath)

    // Return file with proper headers
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': attachment.mimeType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(attachment.fileName)}"`,
        'Content-Length': attachment.fileSize.toString()
      }
    })
  } catch (error) {
    console.error('Error downloading attachment:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to download attachment' },
      { status: 500 }
    )
  }
}
