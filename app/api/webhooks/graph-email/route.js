import { NextResponse } from 'next/server'
import * as email from '@/modules/email'

// This endpoint receives webhook notifications from Microsoft Graph
// when new emails arrive in the helpdesk inbox
// Phase 6: Uses modules/email for validation

export async function POST(request) {
  try {
    const body = await request.json()

    // Phase 6: Validate webhook using modules/email with constant-time comparison
    const clientState = body.value?.[0]?.clientState
    const validation = email.validateInboundWebhook(clientState)

    if (!validation.valid) {
      console.warn('Webhook validation failed:', validation.error)
      return NextResponse.json(
        { error: validation.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    // Phase 6: Parse webhook payload
    const { notifications } = email.parseWebhookPayload(body)

    console.log('📧 Email webhook notification received:', {
      notifications: notifications.length,
      timestamp: new Date().toISOString()
    })

    // Process each notification
    for (const notification of notifications) {
      // Forward notification to N8N webhook for email processing
      try {
        const n8nWebhookUrl = process.env.N8N_EMAIL_WEBHOOK_URL || 'http://localhost:5678/webhook/new-email'

        await fetch(n8nWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            event: 'email.received',
            timestamp: new Date().toISOString(),
            resourceData: notification.resourceData,
            changeType: notification.changeType,
            resource: notification.resource
          })
        })

        console.log('✅ Forwarded email notification to N8N')
      } catch (error) {
        console.error('Failed to forward to N8N:', error.message)
        // Don't fail the webhook - N8N might be down, polling will catch it
      }
    }

    // Always return 202 Accepted to Microsoft Graph
    return NextResponse.json({ status: 'accepted' }, { status: 202 })

  } catch (error) {
    console.error('Error processing email webhook:', error)
    // Return 202 anyway to avoid Microsoft disabling the subscription
    return NextResponse.json({ status: 'error' }, { status: 202 })
  }
}

// Validation endpoint for Microsoft Graph subscription setup
export async function GET(request) {
  try {
    const searchParams = request.nextUrl.searchParams
    const validationToken = searchParams.get('validationToken')

    if (validationToken) {
      // Microsoft Graph sends validationToken on subscription creation
      // We must respond with the token in plain text
      console.log('✅ Microsoft Graph webhook validation successful')
      return new Response(validationToken, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain'
        }
      })
    }

    return NextResponse.json({
      status: 'ready',
      message: 'Email webhook endpoint is active'
    })

  } catch (error) {
    console.error('Error in webhook validation:', error)
    return NextResponse.json({ error: 'Validation failed' }, { status: 500 })
  }
}
