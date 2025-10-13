import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import {
  getUserAlternateEmails,
  addAlternateEmail,
  removeAlternateEmail,
  getAllUserEmails
} from '@/lib/user-email-utils'

// GET - Get all alternate emails for the current user or specified user (admin)
export async function GET(request) {
  try {
    const currentUser = await getCurrentUser(request)
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if admin is requesting another user's emails
    const { searchParams } = new URL(request.url)
    const targetUserId = searchParams.get('userId')

    // If targetUserId is provided, verify admin permission
    if (targetUserId && targetUserId !== currentUser.id) {
      const userRoles = currentUser.roles?.map(r =>
        typeof r === 'string' ? r : (r.role?.name || r.name)
      ) || []

      const isAdmin = userRoles.includes('Admin')
      const isManager = userRoles.includes('Manager')

      if (!isAdmin && !isManager) {
        return NextResponse.json(
          { error: 'Admin or Manager permission required' },
          { status: 403 }
        )
      }
    }

    const userId = targetUserId || currentUser.id

    // Get target user info
    const { prisma } = await import('@/lib/prisma')
    const targetUser = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get all emails (primary + alternates)
    const allEmails = await getAllUserEmails(userId)
    const alternateEmails = await getUserAlternateEmails(userId)

    return NextResponse.json({
      primaryEmail: targetUser.email,
      allEmails,
      alternateEmails
    })
  } catch (error) {
    console.error('Error fetching user emails:', error)
    return NextResponse.json(
      { error: 'Failed to fetch emails' },
      { status: 500 }
    )
  }
}

// POST - Add a new alternate email (user or admin)
export async function POST(request) {
  try {
    const currentUser = await getCurrentUser(request)
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { email, emailType, userId: targetUserId } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // If targetUserId is provided and different from current user, check admin permission
    if (targetUserId && targetUserId !== currentUser.id) {
      const userRoles = currentUser.roles?.map(r =>
        typeof r === 'string' ? r : (r.role?.name || r.name)
      ) || []

      const isAdmin = userRoles.includes('Admin')
      const isManager = userRoles.includes('Manager')

      if (!isAdmin && !isManager) {
        return NextResponse.json(
          { error: 'Admin or Manager permission required' },
          { status: 403 }
        )
      }
    }

    const userId = targetUserId || currentUser.id

    const newEmail = await addAlternateEmail(
      userId,
      email,
      emailType || 'alternate',
      currentUser.id
    )

    return NextResponse.json({
      success: true,
      email: newEmail,
      message: 'Email added successfully'
    }, { status: 201 })
  } catch (error) {
    console.error('Error adding email:', error)

    if (error.message.includes('already associated')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to add email' },
      { status: 500 }
    )
  }
}

// DELETE - Remove an alternate email (user or admin)
export async function DELETE(request) {
  try {
    const currentUser = await getCurrentUser(request)
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const emailId = searchParams.get('id')
    const targetUserId = searchParams.get('userId')

    if (!emailId) {
      return NextResponse.json(
        { error: 'Email ID is required' },
        { status: 400 }
      )
    }

    // If targetUserId is provided and different from current user, check admin permission
    if (targetUserId && targetUserId !== currentUser.id) {
      const userRoles = currentUser.roles?.map(r =>
        typeof r === 'string' ? r : (r.role?.name || r.name)
      ) || []

      const isAdmin = userRoles.includes('Admin')
      const isManager = userRoles.includes('Manager')

      if (!isAdmin && !isManager) {
        return NextResponse.json(
          { error: 'Admin or Manager permission required' },
          { status: 403 }
        )
      }
    }

    const userId = targetUserId || currentUser.id

    await removeAlternateEmail(emailId, userId)

    return NextResponse.json({
      success: true,
      message: 'Email removed successfully'
    })
  } catch (error) {
    console.error('Error removing email:', error)

    if (error.message.includes('permission')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to remove email' },
      { status: 500 }
    )
  }
}
