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

    console.log('🔍 Download request for attachment:', attachmentId)

    // Get attachment and verify access
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: { ticket: true }
    })

    if (!attachment) {
      console.log('❌ Attachment not found:', attachmentId)
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    console.log('📎 Attachment found:', {
      id: attachment.id,
      fileName: attachment.fileName,
      filePath: attachment.filePath,
      fileSize: attachment.fileSize,
      mimeType: attachment.mimeType
    })

    const hasAccess = await hasTicketAccess(user, attachment.ticket)
    if (!hasAccess) {
      console.log('❌ Access denied for user:', user.email)
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Check if filePath is a URL (Digital Ocean Spaces) or local path
    const isUrl = attachment.filePath.startsWith('http://') || attachment.filePath.startsWith('https://')
    console.log('🔍 Is URL?', isUrl, '| Path:', attachment.filePath.substring(0, 100))

    if (isUrl) {
      // For CDN URLs, redirect or proxy the file
      console.log('🌐 Fetching from CDN:', attachment.filePath)
      const response = await fetch(attachment.filePath)
      console.log('📥 CDN response status:', response.status, response.statusText)

      if (!response.ok) {
        console.log('❌ File not found in CDN storage')
        return NextResponse.json({ error: 'File not found in storage' }, { status: 404 })
      }

      const fileBuffer = await response.arrayBuffer()
      console.log('✅ File downloaded from CDN, size:', fileBuffer.byteLength, 'bytes')

      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': attachment.mimeType,
          'Content-Disposition': `attachment; filename="${encodeURIComponent(attachment.fileName)}"`,
          'Content-Length': fileBuffer.byteLength.toString() // Use actual size, not DB size
        }
      })
    } else {
      // For local files, use the AttachmentService
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
    }
  } catch (error) {
    console.error('Error downloading attachment:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to download attachment' },
      { status: 500 }
    )
  }
}
