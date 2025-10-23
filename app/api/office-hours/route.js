import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

// GET /api/office-hours - Get office hours for current user or specified user
export async function GET(request) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || user.id

    // Check permissions - users can only view their own unless they're staff
    const isStaff = user.roles?.some(role => ['Admin', 'Manager', 'Staff'].includes(role.role?.name || role.name))
    if (userId !== user.id && !isStaff) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const officeHours = await prisma.officeHours.findMany({
      where: { userId, isActive: true },
      orderBy: { dayOfWeek: 'asc' }
    })

    return NextResponse.json({ officeHours })
  } catch (error) {
    console.error('Error fetching office hours:', error)
    return NextResponse.json({ error: 'Failed to fetch office hours' }, { status: 500 })
  }
}

// POST /api/office-hours - Create or update office hours for current user
export async function POST(request) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = await request.json()
    const { schedule, userId: targetUserId } = body

    // Determine which user's schedule to update
    const userId = targetUserId || user.id

    // Check permissions - users can only update their own unless they're admin
    const isAdmin = user.roles?.some(role => ['Admin', 'Manager'].includes(role.role?.name || role.name))
    if (userId !== user.id && !isAdmin) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    // Validate schedule format
    if (!Array.isArray(schedule)) {
      return NextResponse.json({ error: 'Schedule must be an array' }, { status: 400 })
    }

    // Validate each day entry
    for (const day of schedule) {
      if (typeof day.dayOfWeek !== 'number' || day.dayOfWeek < 0 || day.dayOfWeek > 6) {
        return NextResponse.json({ error: 'Invalid dayOfWeek (must be 0-6)' }, { status: 400 })
      }
      if (!day.startTime || !day.endTime) {
        return NextResponse.json({ error: 'startTime and endTime are required' }, { status: 400 })
      }
      // Validate time format (HH:MM)
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/
      if (!timeRegex.test(day.startTime) || !timeRegex.test(day.endTime)) {
        return NextResponse.json({ error: 'Invalid time format (use HH:MM)' }, { status: 400 })
      }
    }

    // Delete existing office hours for this user
    await prisma.officeHours.deleteMany({
      where: { userId }
    })

    // Create new office hours
    const created = await prisma.officeHours.createMany({
      data: schedule.map(day => ({
        id: crypto.randomUUID(),
        userId,
        dayOfWeek: day.dayOfWeek,
        startTime: day.startTime,
        endTime: day.endTime,
        isActive: day.isActive !== false, // default to true
        updatedAt: new Date()
      }))
    })

    // Fetch the newly created hours to return
    const officeHours = await prisma.officeHours.findMany({
      where: { userId, isActive: true },
      orderBy: { dayOfWeek: 'asc' }
    })

    return NextResponse.json({
      success: true,
      message: 'Office hours updated successfully',
      officeHours
    })
  } catch (error) {
    console.error('Error updating office hours:', error)
    return NextResponse.json({ error: 'Failed to update office hours' }, { status: 500 })
  }
}
