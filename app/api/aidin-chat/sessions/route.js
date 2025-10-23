import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

/**
 * GET /api/aidin-chat/sessions
 * Get all chat sessions for the current user
 */
export async function GET(request) {
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

    // Get all sessions for this user (not expired)
    const sessions = await prisma.aidinChatSession.findMany({
      where: {
        userId: user.id,
        expiresAt: {
          gt: new Date() // Only get non-expired sessions
        }
      },
      orderBy: {
        updatedAt: 'desc'
      },
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc'
          },
          take: 1 // Just get first message to show preview
        }
      }
    })

    return NextResponse.json({ sessions })
  } catch (error) {
    console.error('Error fetching chat sessions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch chat sessions' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/aidin-chat/sessions
 * Create a new chat session
 */
export async function POST(request) {
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

    // Calculate expiry date (30 days from now)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)

    const session = await prisma.aidinChatSession.create({
      data: {
        userId: user.id,
        title: title || 'New Chat',
        expiresAt
      }
    })

    return NextResponse.json({ session }, { status: 201 })
  } catch (error) {
    console.error('Error creating chat session:', error)
    return NextResponse.json(
      { error: 'Failed to create chat session' },
      { status: 500 }
    )
  }
}
