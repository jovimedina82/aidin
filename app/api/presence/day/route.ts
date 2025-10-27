/**
 * GET /api/presence/day?userId=xxx&date=YYYY-MM-DD
 *
 * Fetch segments for a specific user and date.
 * Returns UTC timestamps converted to local time for display.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { isAdmin } from '@/lib/role-utils'
import { prisma } from '@/lib/prisma'
import { getLocalDayWindow, utcToLocalTime } from '@/lib/presence/timezone'

export async function GET(request: NextRequest) {
  try {
    // 1. Authentication
    const currentUser = await getCurrentUser(request)

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse query params
    const searchParams = request.nextUrl.searchParams
    const userIdParam = searchParams.get('userId')
    const dateParam = searchParams.get('date')

    if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return NextResponse.json(
        { error: 'Invalid or missing date parameter. Use YYYY-MM-DD format.' },
        { status: 400 }
      )
    }

    const targetUserId = userIdParam || currentUser.id

    // 3. Authorization: All authenticated users can VIEW schedules (read-only)
    // Editing restrictions are enforced in POST/DELETE endpoints

    // 4. Fetch segments for the day
    const dayWindow = getLocalDayWindow(dateParam)

    const segments = await prisma.staffPresence.findMany({
      where: {
        userId: targetUserId,
        startAt: {
          gte: dayWindow.start,
          lte: dayWindow.end,
        },
      },
      include: {
        status: {
          select: {
            code: true,
            label: true,
            color: true,
            icon: true,
            requiresOffice: true,
          },
        },
        officeLocation: {
          select: {
            code: true,
            name: true,
          },
        },
      },
      orderBy: {
        startAt: 'asc',
      },
    })

    // 5. Convert UTC to local time
    const segmentsWithLocalTime = segments.map((seg) => ({
      id: seg.id,
      statusCode: seg.status.code,
      statusLabel: seg.status.label,
      statusColor: seg.status.color,
      statusIcon: seg.status.icon,
      officeCode: seg.officeLocation?.code || null,
      officeName: seg.officeLocation?.name || null,
      from: utcToLocalTime(seg.startAt),
      to: utcToLocalTime(seg.endAt),
      notes: seg.notes,
      createdAt: seg.createdAt,
    }))

    return NextResponse.json({ segments: segmentsWithLocalTime })
  } catch (error: any) {
    console.error('❌ Error fetching day segments:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch day segments',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
