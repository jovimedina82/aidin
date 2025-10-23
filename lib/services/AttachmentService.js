import fs from 'fs/promises'
import path from 'path'
import { prisma } from '../prisma.js'
import crypto from 'crypto'

/**
 * AttachmentService handles file storage, validation, and cleanup
 * Files are stored in: /opt/apps/aidin/uploads/attachments/{userId}/{ticketId}/{filename}
 */

export class AttachmentService {
  static UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'attachments')
  static MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB per file
  static MAX_TOTAL_SIZE_PER_TICKET = 50 * 1024 * 1024 // 50MB total per ticket
  static EXPIRY_MONTHS = 6

  // Allowed MIME types (most common)
  static ALLOWED_MIME_TYPES = {
    // Images
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/gif': ['.gif'],
    'image/webp': ['.webp'],
    'image/bmp': ['.bmp'],
    'image/tiff': ['.tif', '.tiff'],
    'image/svg+xml': ['.svg'],

    // Documents
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/vnd.ms-excel': ['.xls'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'application/vnd.ms-powerpoint': ['.ppt'],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
    'text/plain': ['.txt'],
    'text/csv': ['.csv'],
    'application/rtf': ['.rtf'],
    'application/vnd.oasis.opendocument.text': ['.odt'],
    'application/vnd.oasis.opendocument.spreadsheet': ['.ods'],

    // Archives
    'application/zip': ['.zip'],
    'application/x-rar-compressed': ['.rar'],
    'application/x-7z-compressed': ['.7z'],
    'application/x-tar': ['.tar'],
    'application/gzip': ['.gz'],

    // Other
    'application/json': ['.json'],
    'application/xml': ['.xml'],
    'text/xml': ['.xml'],
    'text/html': ['.html', '.htm']
  }

  /**
   * Validate file upload
   */
  static validateFile(file, currentTicketSize = 0) {
    const errors = []

    // Check file exists
    if (!file || !file.size || !file.name) {
      errors.push('Invalid file')
      return { valid: false, errors }
    }

    // Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      errors.push(`File size exceeds ${this.MAX_FILE_SIZE / (1024 * 1024)}MB limit`)
    }

    // Check total ticket size
    if (currentTicketSize + file.size > this.MAX_TOTAL_SIZE_PER_TICKET) {
      errors.push(`Total attachments for this ticket exceed ${this.MAX_TOTAL_SIZE_PER_TICKET / (1024 * 1024)}MB limit`)
    }

    // Check MIME type
    const mimeType = file.type || this.getMimeTypeFromExtension(file.name)
    if (!this.ALLOWED_MIME_TYPES[mimeType]) {
      errors.push(`File type ${mimeType || 'unknown'} is not allowed`)
    }

    // Check file extension
    const ext = path.extname(file.name).toLowerCase()
    const allowedExtensions = this.ALLOWED_MIME_TYPES[mimeType] || []
    if (mimeType && !allowedExtensions.includes(ext)) {
      errors.push(`File extension ${ext} does not match MIME type ${mimeType}`)
    }

    return {
      valid: errors.length === 0,
      errors,
      mimeType
    }
  }

  /**
   * Get MIME type from file extension
   */
  static getMimeTypeFromExtension(filename) {
    const ext = path.extname(filename).toLowerCase()
    for (const [mimeType, extensions] of Object.entries(this.ALLOWED_MIME_TYPES)) {
      if (extensions.includes(ext)) {
        return mimeType
      }
    }
    return null
  }

  /**
   * Generate safe filename
   */
  static generateSafeFilename(originalName) {
    const ext = path.extname(originalName)
    const nameWithoutExt = path.basename(originalName, ext)
    const safeName = nameWithoutExt.replace(/[^a-zA-Z0-9-_]/g, '_')
    const timestamp = Date.now()
    const random = crypto.randomBytes(4).toString('hex')
    return `${safeName}_${timestamp}_${random}${ext}`
  }

  /**
   * Get user's upload directory
   */
  static getUserUploadDir(userId, ticketId) {
    return path.join(this.UPLOADS_DIR, userId, ticketId)
  }

  /**
   * Ensure directory exists
   */
  static async ensureDir(dirPath) {
    try {
      await fs.access(dirPath)
    } catch {
      await fs.mkdir(dirPath, { recursive: true, mode: 0o755 })
    }
  }

  /**
   * Save file to disk
   */
  static async saveFile(file, userId, ticketId) {
    const uploadDir = this.getUserUploadDir(userId, ticketId)
    await this.ensureDir(uploadDir)

    const safeFilename = this.generateSafeFilename(file.name)
    const filePath = path.join(uploadDir, safeFilename)

    // Write file
    const buffer = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(filePath, buffer, { mode: 0o644 })

    // Return relative path for database storage
    const relativePath = path.join(userId, ticketId, safeFilename)
    return { filePath: relativePath, safeFilename }
  }

  /**
   * Create attachment record in database
   */
  static async createAttachment(ticketId, userId, file, filePath, safeFilename, mimeType, commentId = null) {
    const uploadedAt = new Date()
    const expiresAt = new Date(uploadedAt)
    expiresAt.setMonth(expiresAt.getMonth() + this.EXPIRY_MONTHS)

    const data = {
      ticketId,
      userId,
      fileName: file.name,
      fileSize: file.size,
      mimeType,
      filePath,
      uploadedAt,
      expiresAt
    }

    // Add commentId if provided
    if (commentId) {
      data.commentId = commentId
    }

    return await prisma.attachment.create({
      data
    })
  }

  /**
   * Upload attachment
   */
  static async uploadAttachment(file, ticketId, userId, commentId = null) {
    // Get current ticket attachments size
    const existingAttachments = await prisma.attachment.findMany({
      where: { ticketId },
      select: { fileSize: true }
    })
    const currentSize = existingAttachments.reduce((sum, att) => sum + att.fileSize, 0)

    // Validate file
    const validation = this.validateFile(file, currentSize)
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '))
    }

    // Save file to disk
    const { filePath, safeFilename } = await this.saveFile(file, userId, ticketId)

    // Create database record
    const attachment = await this.createAttachment(
      ticketId,
      userId,
      file,
      filePath,
      safeFilename,
      validation.mimeType,
      commentId
    )

    return attachment
  }

  /**
   * Delete attachment
   */
  static async deleteAttachment(attachmentId, deletedBy = null, reason = 'manual') {
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId }
    })

    if (!attachment) {
      throw new Error('Attachment not found')
    }

    // Delete file from disk
    const fullPath = path.join(this.UPLOADS_DIR, attachment.filePath)
    try {
      await fs.unlink(fullPath)
    } catch (error) {
      console.error(`Failed to delete file ${fullPath}:`, error)
      // Continue anyway to remove from database
    }

    // Log deletion
    await prisma.attachmentDeletionLog.create({
      data: {
        userId: attachment.userId,
        fileName: attachment.fileName,
        fileSize: attachment.fileSize,
        filePath: attachment.filePath,
        deletedBy: deletedBy || 'system',
        reason
      }
    })

    // Delete from database
    await prisma.attachment.delete({
      where: { id: attachmentId }
    })

    return { success: true }
  }

  /**
   * Get attachment file for download
   */
  static async getAttachmentFile(attachmentId) {
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId }
    })

    if (!attachment) {
      throw new Error('Attachment not found')
    }

    const fullPath = path.join(this.UPLOADS_DIR, attachment.filePath)

    try {
      await fs.access(fullPath)
      return {
        attachment,
        fullPath
      }
    } catch {
      throw new Error('File not found on disk')
    }
  }

  /**
   * Cleanup expired attachments (run by cron job)
   */
  static async cleanupExpiredAttachments() {
    const now = new Date()
    const expiredAttachments = await prisma.attachment.findMany({
      where: {
        expiresAt: {
          lte: now
        }
      }
    })

    let deletedCount = 0
    let failedCount = 0

    for (const attachment of expiredAttachments) {
      try {
        await this.deleteAttachment(attachment.id, 'system', 'expired')
        deletedCount++
      } catch (error) {
        console.error(`Failed to delete expired attachment ${attachment.id}:`, error)
        failedCount++
      }
    }

    // Clean up empty directories
    await this.cleanupEmptyDirectories()

    return {
      deletedCount,
      failedCount,
      total: expiredAttachments.length
    }
  }

  /**
   * Clean up empty directories
   */
  static async cleanupEmptyDirectories() {
    try {
      const userDirs = await fs.readdir(this.UPLOADS_DIR)

      for (const userId of userDirs) {
        const userPath = path.join(this.UPLOADS_DIR, userId)
        const stat = await fs.stat(userPath)

        if (!stat.isDirectory()) continue

        const ticketDirs = await fs.readdir(userPath)

        for (const ticketId of ticketDirs) {
          const ticketPath = path.join(userPath, ticketId)
          const ticketStat = await fs.stat(ticketPath)

          if (!ticketStat.isDirectory()) continue

          const files = await fs.readdir(ticketPath)

          // Remove empty ticket directory
          if (files.length === 0) {
            await fs.rmdir(ticketPath)
          }
        }

        // Check if user directory is now empty
        const remainingTickets = await fs.readdir(userPath)
        if (remainingTickets.length === 0) {
          await fs.rmdir(userPath)
        }
      }
    } catch (error) {
      console.error('Error cleaning up empty directories:', error)
    }
  }

  /**
   * Get ticket attachments
   */
  static async getTicketAttachments(ticketId) {
    return await prisma.attachment.findMany({
      where: { ticketId },
      orderBy: { uploadedAt: 'desc' }
    })
  }

  /**
   * Get user's deletion log
   */
  static async getUserDeletionLog(userId, limit = 100) {
    return await prisma.attachmentDeletionLog.findMany({
      where: { userId },
      orderBy: { deletedAt: 'desc' },
      take: limit
    })
  }
}
