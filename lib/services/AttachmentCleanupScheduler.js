import cron from 'node-cron'
import { cleanupAttachmentsJob } from '../jobs/cleanupAttachments.js'

class AttachmentCleanupScheduler {
  constructor() {
    this.job = null
    this.isRunning = false
  }

  async runCleanup() {
    if (this.isRunning) {
      console.log('[Attachment Cleanup] Already in progress, skipping...')
      return
    }

    this.isRunning = true

    try {
      await cleanupAttachmentsJob()
    } catch (error) {
      console.error('[Attachment Cleanup] Error:', error)
    } finally {
      this.isRunning = false
    }
  }

  start() {
    if (this.job) {
      console.log('[Attachment Cleanup] Scheduler already running')
      return
    }

    // Run daily at 2:00 AM
    this.job = cron.schedule('0 2 * * *', () => {
      this.runCleanup()
    })

    console.log('[Attachment Cleanup] Scheduler started (runs daily at 2:00 AM)')
  }

  stop() {
    if (this.job) {
      this.job.stop()
      this.job = null
      console.log('[Attachment Cleanup] Scheduler stopped')
    }
  }

  // Manual trigger for testing
  async trigger() {
    console.log('[Attachment Cleanup] Manual trigger requested')
    await this.runCleanup()
  }
}

const attachmentCleanupScheduler = new AttachmentCleanupScheduler()

export default attachmentCleanupScheduler
