import { NextResponse } from 'next/server'
import { validateSimpleSecret } from '@/lib/security/hmac'
import { checkRateLimit } from '@/lib/security/rate-limit'

const N8N_WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET

export async function POST(request) {
  try {
    // SECURITY: Validate webhook secret
    const providedSecret = request.headers.get('x-webhook-secret')

    if (!N8N_WEBHOOK_SECRET) {
      console.error('N8N_WEBHOOK_SECRET not configured')
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
    }

    if (!validateSimpleSecret(providedSecret, N8N_WEBHOOK_SECRET)) {
      console.warn('Invalid N8N webhook secret attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown'
    const rateLimit = await checkRateLimit(clientIp, '/api/webhooks/n8n', {
      maxRequests: 100,
      windowMs: 60000 // 100 requests per minute
    })

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfter || 60) }
        }
      )
    }

    // Get the webhook payload
    const payload = await request.json()

    // Basic validation
    if (!payload || !payload.event) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    // Respond immediately to N8N
    return NextResponse.json({
      success: true,
      message: 'Webhook received successfully',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('N8N Webhook error:', error)
    return NextResponse.json({
      error: 'Webhook processing failed'
    }, { status: 500 })
  }
}

// Allow GET requests for webhook testing
export async function GET(request) {
  return NextResponse.json({
    message: 'N8N Webhook endpoint is active',
    timestamp: new Date().toISOString(),
    endpoints: {
      tickets: '/api/tickets',
      stats: '/api/stats',
      knowledgeBase: '/api/admin/knowledge-base'
    }
  })
}