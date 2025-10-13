import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

    const { type, title, message, severity = 'info', recipientRoles = ['Admin'], metadata = {} } = await request.json()

    if (!type || !title || !message) {
      return NextResponse.json({
        error: 'Missing required fields: type, title, message'
      }, { status: 400 })
    }

    // Get all users with the specified roles
    const recipients = await prisma.user.findMany({
      where: {
        roles: {
          some: {
            role: {
              name: {
                in: recipientRoles
              }
            }
          }
        },
        isActive: true
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true
      }
    })

    if (recipients.length === 0) {
      return NextResponse.json({
        warning: 'No recipients found for specified roles',
        recipientRoles
      }, { status: 200 })
    }

    // Create notification record (you can add a notifications table if needed)
    // For now, we'll log it and you can extend this later
    console.log('Admin Notification:', {
      type,
      title,
      message,
      severity,
      recipientCount: recipients.length,
      recipients: recipients.map(r => r.email),
      metadata,
      timestamp: new Date().toISOString()
    })

    // TODO: Implement actual notification system (email, in-app, push, etc.)
    // For now, this creates a log that admins can review

    return NextResponse.json({
      success: true,
      notificationId: `notif_${Date.now()}`,
      recipientCount: recipients.length,
      recipients: recipients.map(r => ({
        email: r.email,
        name: `${r.firstName} ${r.lastName}`
      })),
      message: 'Notification logged successfully'
    })

  } catch (error) {
    console.error('Notification API error:', error)
    return NextResponse.json({
      error: 'Failed to create notification',
      message: error.message
    }, { status: 500 })
  }
}

export async function GET(request) {
  try {
    const user = await getCurrentUser(request)

    const userRoleNames = user?.roles?.map(role =>
      typeof role === 'string' ? role : (role.role?.name || role.name)
    ) || []
    if (!userRoleNames.includes('Admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Return notification status/logs
    // This is a placeholder - implement actual notification retrieval logic
    return NextResponse.json({
      message: 'Notification endpoint is active',
      features: [
        'Admin notifications',
        'Uncertain email alerts',
        'System warnings',
        'Role-based targeting'
      ]
    })

  } catch (error) {
    console.error('Notification GET error:', error)
    return NextResponse.json({
      error: 'Failed to fetch notifications'
    }, { status: 500 })
  }
}
