import { NextResponse } from 'next/server'

// This endpoint receives webhook notifications from Microsoft Graph
// when new emails arrive in the helpdesk inbox

export async function POST(request) {
  try {
    const body = await request.json()

    // Validate clientState to ensure webhook is from Microsoft
    const clientState = body.value?.[0]?.clientState
    const expectedClientState = process.env.GRAPH_WEBHOOK_SECRET

    // SECURITY: Require properly configured secret
    if (!expectedClientState || expectedClientState.length < 32) {
      console.error('GRAPH_WEBHOOK_SECRET not configured or too weak (must be >= 32 characters)')
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
    }

    if (clientState !== expectedClientState) {
      console.warn('Invalid clientState in webhook notification', {
        ip: request.headers.get('x-forwarded-for'),
        timestamp: new Date().toISOString()
      })
      return NextResponse.json({ error: 'Invalid clientState' }, { status: 401 })
    }

    console.log('📧 Email webhook notification received:', {
      notifications: body.value?.length || 0,
      timestamp: new Date().toISOString()
    })

    // Process each notification
    for (const notification of body.value || []) {
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
