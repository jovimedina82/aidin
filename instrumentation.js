// This file is automatically loaded by Next.js on server startup
// See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  // Only run on Node.js runtime (skip Edge runtime and client-side)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('🚀 Initializing server components...')

    // Import and start the Azure AD sync scheduler
    const { default: azureSyncScheduler } = await import('./lib/services/AzureSyncScheduler.js')
    const { default: attachmentCleanupScheduler } = await import('./lib/services/AttachmentCleanupScheduler.js')
    const { default: auditLogCleanupScheduler } = await import('./lib/services/AuditLogCleanupScheduler.js')

    // Check if scheduler should be enabled
    const isProduction = process.env.NODE_ENV === 'production'
    const syncEnabled = process.env.AZURE_SYNC_ENABLED !== 'false'
    const devModeEnabled = process.env.AZURE_SYNC_DEV_MODE === 'true'

    if (syncEnabled && (isProduction || devModeEnabled)) {
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

    // Email polling is started from server.js instead to avoid webpack bundling issues
  }
}
