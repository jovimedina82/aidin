import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

/**
 * GET /api/aidin-chat/sessions/[id]/messages
 * Get all messages for a session
 */
export async function GET(request, { params }) {
  try {
    const user = await getCurrentUser(request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has staff/manager/admin role
    const userRoleNames = user?.roles?.map(role =>
      typeof role === 'string' ? role : (role.role?.name || role.name)
    ) || []
    const isStaff = userRoleNames.some(role => ['Admin', 'Manager', 'Staff'].includes(role))

    if (!isStaff) {
      return NextResponse.json(
        { error: 'Access denied. This feature is only available to staff members.' },
        { status: 403 }
      )
    }

    // Verify session exists and user owns it
    const session = await prisma.aidinChatSession.findUnique({
      where: { id: params.id }
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (session.userId !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const messages = await prisma.aidinChatMessage.findMany({
      where: {
        sessionId: params.id
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    return NextResponse.json({ messages })
  } catch (error) {
    console.error('Error fetching messages:', error)
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/aidin-chat/sessions/[id]/messages
 * Send a message and get AI response
 */
export async function POST(request, { params }) {
  try {
    const user = await getCurrentUser(request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has staff/manager/admin role
    const userRoleNames = user?.roles?.map(role =>
      typeof role === 'string' ? role : (role.role?.name || role.name)
    ) || []
    const isStaff = userRoleNames.some(role => ['Admin', 'Manager', 'Staff'].includes(role))

    if (!isStaff) {
      return NextResponse.json(
        { error: 'Access denied. This feature is only available to staff members.' },
        { status: 403 }
      )
    }

    const { content } = await request.json()

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 })
    }

    // Verify session exists and user owns it
    const session = await prisma.aidinChatSession.findUnique({
      where: { id: params.id },
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (session.userId !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Check if session has expired
    if (new Date() > new Date(session.expiresAt)) {
      return NextResponse.json(
        { error: 'This chat session has expired' },
        { status: 410 }
      )
    }

    // Save user's message
    const userMessage = await prisma.aidinChatMessage.create({
      data: {
        sessionId: params.id,
        role: 'user',
        content: content.trim()
      }
    })

    // Build conversation history for OpenAI
    const conversationHistory = session.messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }))

    // Add the new user message
    conversationHistory.push({
      role: 'user',
      content: content.trim()
    })

    // Prepare messages with system prompt for GPT-4 Turbo
    const messagesForAI = [
      {
        role: 'system',
        content: `You are AidIN, a helpful AI assistant for the SurTerre Properties IT helpdesk team. You help staff members with technical questions, troubleshooting, code assistance, and general IT support queries. Be professional, concise, and helpful. If you're unsure about something specific to SurTerre Properties, acknowledge that and provide general best practices instead.`
      },
      ...conversationHistory
    ]

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: messagesForAI,
      temperature: 0.7,
      max_tokens: 2000
    })

    const aiResponse = completion.choices[0].message.content

    // Save AI's response
    const assistantMessage = await prisma.aidinChatMessage.create({
      data: {
        sessionId: params.id,
        role: 'assistant',
        content: aiResponse
      }
    })

    // Update session's updatedAt timestamp and title if it's the first exchange
    const updateData = {}
    if (session.messages.length === 0 && session.title === 'New Chat') {
      // Auto-generate title from first message (truncate to 50 chars)
      const autoTitle = content.trim().substring(0, 50) + (content.length > 50 ? '...' : '')
      updateData.title = autoTitle
    }

    await prisma.aidinChatSession.update({
      where: { id: params.id },
      data: updateData
    })

    return NextResponse.json({
      userMessage,
      assistantMessage
    }, { status: 201 })
  } catch (error) {
    console.error('Error processing message:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process message' },
      { status: 500 }
    )
  }
}
