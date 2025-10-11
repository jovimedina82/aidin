// This file is automatically loaded by Next.js on server startup
// See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  // Only run on server side
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('🚀 Initializing server components...')

    // Import and start the Azure AD sync scheduler
    const { default: azureSyncScheduler } = await import('./lib/services/AzureSyncScheduler.js')
    const { default: attachmentCleanupScheduler } = await import('./lib/services/AttachmentCleanupScheduler.js')
    const { default: auditLogCleanupScheduler } = await import('./lib/services/AuditLogCleanupScheduler.js')

    // Check if scheduler should be enabled
    const isProduction = process.env.NODE_ENV === 'production'
    const syncEnabled = process.env.AZURE_SYNC_ENABLED !== 'false'

    if (isProduction && syncEnabled) {
      console.log('📅 Starting Azure AD sync scheduler...')
      azureSyncScheduler.start()
    } else {
      console.log('⏸️  Azure AD sync scheduler disabled (not in production or manually disabled)')
    }

    // Start attachment cleanup scheduler (runs in all environments)
    console.log('🧹 Starting attachment cleanup scheduler...')
    attachmentCleanupScheduler.start()

    // Start audit log cleanup scheduler (runs in all environments)
    console.log('🔒 Starting audit log cleanup scheduler...')
    auditLogCleanupScheduler.start()

    // Start email polling service (if enabled)
    const emailPollingEnabled = process.env.EMAIL_POLLING_ENABLED === 'true'
    if (emailPollingEnabled) {
      console.log('📬 Starting email polling service...')
      const { startEmailPolling } = await import('./modules/email-polling/job.ts')
      startEmailPolling()
    } else {
      console.log('⏸️  Email polling disabled (EMAIL_POLLING_ENABLED not set to true)')
    }
  }
}
