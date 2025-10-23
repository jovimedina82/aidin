import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

// GET /api/holidays - Get all active holidays
export async function GET(request) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const where = includeInactive ? {} : { isActive: true }

    const holidays = await prisma.holiday.findMany({
      where,
      orderBy: { startDate: 'asc' }
    })

    return NextResponse.json({ holidays })
  } catch (error) {
    console.error('Error fetching holidays:', error)
    return NextResponse.json({ error: 'Failed to fetch holidays' }, { status: 500 })
  }
}

// POST /api/holidays - Create a new holiday (Admin only)
export async function POST(request) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    // Check if user is admin
    const isAdmin = user.roles?.some(role => ['Admin', 'Manager'].includes(role.role?.name || role.name))
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, startDate, endDate } = body

    // Validation
    if (!name || !startDate || !endDate) {
      return NextResponse.json({
        error: 'Name, startDate, and endDate are required'
      }, { status: 400 })
    }

    // Validate dates
    const start = new Date(startDate)
    const end = new Date(endDate)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }

    if (end < start) {
      return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 })
    }

    // Create holiday
    const holiday = await prisma.holiday.create({
      data: {
        id: crypto.randomUUID(),
        name,
        description: description || null,
        startDate: start,
        endDate: end,
        createdBy: user.id,
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Holiday created successfully',
      holiday
    })
  } catch (error) {
    console.error('Error creating holiday:', error)
    return NextResponse.json({ error: 'Failed to create holiday' }, { status: 500 })
  }
}
