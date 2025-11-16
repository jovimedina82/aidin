import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createNotificationsForRoles, getUserNotifications } from '@/lib/notifications/service'
import logger from '@/lib/logger'

export async function POST(request) {
  try {
    const user = await getCurrentUser(request)

    // Allow requests from n8n (system user) or admins
    const userRoleNames = user?.roles?.map(role =>
      typeof role === 'string' ? role : (role.role?.name || role.name)
    ) || []
    const isAdmin = userRoleNames.includes('Admin')

    if (!isAdmin && !request.headers.get('authorization')?.includes('Basic')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { type, title, message, severity = 'INFO', recipientRoles = ['Admin'], metadata = {}, expiresInDays } = await request.json()

    if (!type || !title || !message) {
      return NextResponse.json({
        error: 'Missing required fields: type, title, message'
      }, { status: 400 })
    }

    // Validate severity
    const validSeverities = ['INFO', 'WARNING', 'ERROR', 'CRITICAL']
    const normalizedSeverity = severity.toUpperCase()
    if (!validSeverities.includes(normalizedSeverity)) {
      return NextResponse.json({
        error: `Invalid severity. Must be one of: ${validSeverities.join(', ')}`
      }, { status: 400 })
    }

    // Create notifications using the notification service
    const result = await createNotificationsForRoles(recipientRoles, {
      type,
      title,
      message,
      severity: normalizedSeverity,
      metadata,
      expiresInDays: expiresInDays || 30,
    })

    if (!result.success) {
      logger.error('Failed to create notifications', null, {
        type,
        title,
        recipientRoles,
        errors: result.errors,
      })
      return NextResponse.json({
        error: 'Failed to create notifications',
        details: result.errors
      }, { status: 500 })
    }

    if (result.recipientCount === 0) {
      return NextResponse.json({
        warning: 'No recipients found for specified roles',
        recipientRoles
      }, { status: 200 })
    }

    logger.info('Admin notifications created', {
      type,
      title,
      severity: normalizedSeverity,
      recipientCount: result.recipientCount,
      notificationIds: result.notificationIds,
    })

    return NextResponse.json({
      success: true,
      notificationIds: result.notificationIds,
      recipientCount: result.recipientCount,
      message: 'Notifications created successfully'
    })

  } catch (error) {
    logger.error('Notification API error', error)
    return NextResponse.json({
      error: 'Failed to create notification',
      message: error.message
    }, { status: 500 })
  }
}

export async function GET(request) {
  try {
    const user = await getCurrentUser(request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    const unreadOnly = searchParams.get('unreadOnly') === 'true'

    // Get notifications for the current user
    const { notifications, total, unreadCount } = await getUserNotifications(user.id, {
      limit,
      offset,
      unreadOnly,
    })

    return NextResponse.json({
      notifications,
      total,
      unreadCount,
      limit,
      offset,
    })

  } catch (error) {
    logger.error('Notification GET error', error)
    return NextResponse.json({
      error: 'Failed to fetch notifications'
    }, { status: 500 })
  }
}
