import { AttachmentService } from '../services/AttachmentService.js'

/**
 * Cleanup expired attachments job
 * Runs daily to remove files older than 6 months
 */
export async function cleanupAttachmentsJob() {
  console.log('[Attachment Cleanup] Starting cleanup job...')

  try {
    const result = await AttachmentService.cleanupExpiredAttachments()

    console.log(`[Attachment Cleanup] Completed:`)
    console.log(`  - Total expired: ${result.total}`)
    console.log(`  - Successfully deleted: ${result.deletedCount}`)
    console.log(`  - Failed: ${result.failedCount}`)

    return result
  } catch (error) {
    console.error('[Attachment Cleanup] Error:', error)
    throw error
  }
}

export default cleanupAttachmentsJob
