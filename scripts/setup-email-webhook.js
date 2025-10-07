#!/usr/bin/env node

/**
 * Setup script for Microsoft Graph Email Webhook
 *
 * This script:
 * 1. Creates a Microsoft Graph subscription for email notifications
 * 2. Sets up auto-renewal (subscriptions expire after 24 hours)
 * 3. Provides instructions for N8N workflow updates
 */

import { getEmailWebhookService } from '../lib/services/EmailWebhookService.js'

async function setup() {
  console.log('🚀 Setting up Microsoft Graph Email Webhook...\n')

  try {
    // Check required environment variables
    const required = [
      'MICROSOFT_CLIENT_ID',
      'MICROSOFT_CLIENT_SECRET',
      'MICROSOFT_TENANT_ID',
      'NEXT_PUBLIC_APP_URL'
    ]

    const missing = required.filter(key => !process.env[key])
    if (missing.length > 0) {
      console.error('❌ Missing required environment variables:', missing.join(', '))
      console.error('\nPlease add these to your .env file and try again.')
      process.exit(1)
    }

    const webhookService = getEmailWebhookService()

    console.log('📧 Helpdesk Email:', process.env.HELPDESK_EMAIL || 'helpdesk@surterreproperties.com')
    console.log('🔗 Webhook URL:', webhookService.webhookUrl)
    console.log('')

    // Create subscription
    console.log('Creating Microsoft Graph subscription...')
    const subscription = await webhookService.createSubscription()

    console.log('\n✅ Subscription created successfully!')
    console.log('\nSubscription Details:')
    console.log('  ID:', subscription.id)
    console.log('  Resource:', subscription.resource)
    console.log('  Expires:', new Date(subscription.expirationDateTime).toLocaleString())
    console.log('  Change Type:', subscription.changeType)
    console.log('')

    console.log('📝 Next Steps:')
    console.log('')
    console.log('1. The subscription will auto-renew every 12 hours')
    console.log('2. Update your N8N workflow to include a Webhook trigger:')
    console.log('   - Webhook URL: http://localhost:5678/webhook/new-email')
    console.log('   - Method: POST')
    console.log('   - This will receive instant notifications')
    console.log('')
    console.log('3. Keep the existing Schedule Trigger but change it to:')
    console.log('   - Every 15 minutes (as backup)')
    console.log('')
    console.log('4. The hybrid approach gives you:')
    console.log('   ⚡ Instant processing via webhook')
    console.log('   🛡️ Reliability via 15-minute polling backup')
    console.log('')

    // Don't exit - keep running for auto-renewal
    console.log('📡 Auto-renewal service is now active...')
    console.log('   (Press Ctrl+C to stop)')

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message)
    console.error('\nFull error:', error)
    process.exit(1)
  }
}

setup()
