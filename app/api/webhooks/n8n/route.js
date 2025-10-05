import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

export async function POST(request) {
  try {
    // Get the webhook payload
    const payload = await request.json()

    // Basic validation - you can add authentication here if needed
    if (!payload || !payload.event) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    // Log the webhook for debugging
    console.log('N8N Webhook received:', {
      event: payload.event,
      timestamp: new Date().toISOString(),
      data: payload.data
    })

    // Respond immediately to N8N
    return NextResponse.json({
      success: true,
      message: 'Webhook received successfully',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('N8N Webhook error:', error)
    return NextResponse.json({
      error: 'Webhook processing failed',
      message: error.message
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