#!/usr/bin/env node

// This script initializes server-side services before starting Next.js
// Run with PM2 or as a separate process

import azureSyncScheduler from './lib/services/AzureSyncScheduler.js'

console.log('🚀 Initializing AIDIN server services...')

// Check if Azure sync should be enabled
const isProduction = process.env.NODE_ENV === 'production'
const syncEnabled = process.env.AZURE_SYNC_ENABLED !== 'false'

if (isProduction && syncEnabled) {
  console.log('📅 Starting Azure AD sync scheduler...')
  console.log(`   Group: ${process.env.MICROSOFT_GRAPH_SYNC_GROUP}`)
  console.log(`   Interval: ${process.env.SYNC_INTERVAL_MINUTES || 30} minutes`)

  azureSyncScheduler.start()
  console.log('✅ Azure AD sync scheduler started successfully')
} else {
  console.log('⏸️  Azure AD sync scheduler disabled')
  if (!isProduction) {
    console.log('   Reason: Not in production mode')
  }
  if (!syncEnabled) {
    console.log('   Reason: AZURE_SYNC_ENABLED is set to false')
  }
}

// Keep the process running
console.log('✅ Server initialization complete')

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('📴 Shutting down server services...')
  azureSyncScheduler.stop()
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('📴 Shutting down server services...')
  azureSyncScheduler.stop()
  process.exit(0)
})

// Keep the process alive
setInterval(() => {}, 1 << 30)
