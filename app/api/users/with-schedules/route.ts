/**
 * GET /api/users/with-schedules
 *
 * Returns users who have at least one schedule segment where endAt >= today.
 * This is an efficient query to avoid showing users without current/future schedules.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // 1. Authentication
    const currentUser = await getCurrentUser(request)

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Get the "from" parameter (current time) from query string
    const searchParams = request.nextUrl.searchParams
    const fromParam = searchParams.get('from')

    // Use provided timestamp or default to now
    const fromDate = fromParam ? new Date(fromParam) : new Date()

    // 3. Efficient query: Get all users who have segments ending on or after the "from" time
    const usersWithSchedules = await prisma.user.findMany({
      where: {
        isActive: true,
        staffPresence: {
          some: {
            endAt: {
              gte: fromDate, // Has at least one segment ending on or after the specified time
            },
          },
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        jobTitle: true,
        avatar: true,
        officeLocation: true,
        isActive: true,
        roles: {
          include: {
            role: {
              select: {
                name: true,
              },
            },
          },
        },
        departments: {
          include: {
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' },
      ],
    })

    return NextResponse.json(usersWithSchedules)
  } catch (error: any) {
    console.error('❌ Error fetching users with schedules:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch users with schedules',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
