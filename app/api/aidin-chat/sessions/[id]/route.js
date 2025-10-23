import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

/**
 * GET /api/aidin-chat/sessions/[id]
 * Get a specific chat session with all messages
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

    const session = await prisma.aidinChatSession.findUnique({
      where: {
        id: params.id
      },
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

    // Ensure user owns this session
    if (session.userId !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    return NextResponse.json({ session })
  } catch (error) {
    console.error('Error fetching chat session:', error)
    return NextResponse.json(
      { error: 'Failed to fetch chat session' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/aidin-chat/sessions/[id]
 * Delete a chat session
 */
export async function DELETE(request, { params }) {
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

    // Check that session exists and user owns it
    const session = await prisma.aidinChatSession.findUnique({
      where: { id: params.id }
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (session.userId !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Delete the session (messages will cascade)
    await prisma.aidinChatSession.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting chat session:', error)
    return NextResponse.json(
      { error: 'Failed to delete chat session' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/aidin-chat/sessions/[id]
 * Update chat session (e.g., title)
 */
export async function PATCH(request, { params }) {
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

    const { title } = await request.json()

    // Check that session exists and user owns it
    const session = await prisma.aidinChatSession.findUnique({
      where: { id: params.id }
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (session.userId !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Update the session
    const updatedSession = await prisma.aidinChatSession.update({
      where: { id: params.id },
      data: { title }
    })

    return NextResponse.json({ session: updatedSession })
  } catch (error) {
    console.error('Error updating chat session:', error)
    return NextResponse.json(
      { error: 'Failed to update chat session' },
      { status: 500 }
    )
  }
}
