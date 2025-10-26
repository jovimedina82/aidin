import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

/**
 * GET /api/tickets/[id]/cc
 * Get all CC recipients for a ticket
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

    // Verify ticket exists and user has access
    const ticket = await prisma.ticket.findUnique({
      where: { id: params.id }
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Only staff or the requester can view CC recipients
    if (!isStaff && ticket.requesterId !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const ccRecipients = await prisma.ticketCC.findMany({
      where: {
        ticketId: params.id
      },
      orderBy: {
        addedAt: 'asc'
      }
    })

    return NextResponse.json({ cc: ccRecipients })
  } catch (error) {
    console.error('Error fetching CC recipients:', error)
    return NextResponse.json(
      { error: 'Failed to fetch CC recipients' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/tickets/[id]/cc
 * Add a CC recipient to a ticket
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

    // Only staff can add CC recipients
    if (!isStaff) {
      return NextResponse.json(
        { error: 'Only staff members can add CC recipients' },
        { status: 403 }
      )
    }

    const { email, name } = await request.json()

    // Validate email
    if (!email || !email.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    // Verify ticket exists
    const ticket = await prisma.ticket.findUnique({
      where: { id: params.id }
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Check if CC already exists
    const existingCC = await prisma.ticketCC.findUnique({
      where: {
        ticketId_email: {
          ticketId: params.id,
          email: email.trim().toLowerCase()
        }
      }
    })

    if (existingCC) {
      return NextResponse.json(
        { error: 'This email is already CC\'d on this ticket' },
        { status: 409 }
      )
    }

    // Add CC recipient
    const ccRecipient = await prisma.ticketCC.create({
      data: {
        ticketId: params.id,
        email: email.trim().toLowerCase(),
        name: name?.trim() || null,
        addedBy: user.id,
        source: 'manual'
      }
    })

    return NextResponse.json({ cc: ccRecipient }, { status: 201 })
  } catch (error) {
    console.error('Error adding CC recipient:', error)
    return NextResponse.json(
      { error: 'Failed to add CC recipient' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/tickets/[id]/cc
 * Remove a CC recipient from a ticket
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

    // Only staff can remove CC recipients
    if (!isStaff) {
      return NextResponse.json(
        { error: 'Only staff members can remove CC recipients' },
        { status: 403 }
      )
    }

    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Delete CC recipient
    const deleted = await prisma.ticketCC.deleteMany({
      where: {
        ticketId: params.id,
        email: email.trim().toLowerCase()
      }
    })

    if (deleted.count === 0) {
      return NextResponse.json(
        { error: 'CC recipient not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, deleted: deleted.count })
  } catch (error) {
    console.error('Error removing CC recipient:', error)
    return NextResponse.json(
      { error: 'Failed to remove CC recipient' },
      { status: 500 }
    )
  }
}
