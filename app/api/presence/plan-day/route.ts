/**
 * POST /api/presence/plan-day
 *
 * Plan daily schedule with multi-segment support and optional repeat logic.
 * Features: 8h daily cap, no overlaps, requiresOffice validation, audit logging.
 */

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { isAdmin } from '@/lib/role-utils'
import { prisma } from '@/lib/prisma'
import { PlanDayZ, validatePlanDay } from '@/lib/presence/validation'
import { localToUTC, getLocalDayWindow } from '@/lib/presence/timezone'
import { resolveStatus, resolveOffice } from '@/lib/presence/registry'
import { logEvent } from '@/lib/audit/logger'
import { ZodError } from 'zod'
import { add } from 'date-fns'

export async function POST(request: Request) {
  try {
    // 1. Authentication
    const currentUser = await getCurrentUser(request)

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse and validate request body
    const body = await request.json()
    let validated

    try {
      validated = PlanDayZ.parse(body)
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: error.errors.map((e) => ({
              field: e.path.join('.'),
              message: e.message,
            })),
          },
          { status: 422 }
        )
      }
      throw error
    }

    // 3. Business rule validation
    try {
      await validatePlanDay(validated)
    } catch (validationErrors: any) {
      if (Array.isArray(validationErrors)) {
        return NextResponse.json(
          {
            error: 'Business rule validation failed',
            details: validationErrors,
          },
          { status: 422 }
        )
      }
      throw validationErrors
    }

    // 4. Authorization: userId must be self unless admin
    const targetUserId = validated.userId || currentUser.id

    if (targetUserId !== currentUser.id && !isAdmin(currentUser)) {
      return NextResponse.json(
        { error: 'Forbidden: You can only manage your own schedule' },
        { status: 403 }
      )
    }

    // 5. Generate date range (single day or repeat)
    const dates: string[] = [validated.date]

    if (validated.repeatUntil) {
      let currentDate = new Date(validated.date + 'T00:00:00')
      const endDate = new Date(validated.repeatUntil + 'T00:00:00')

      while (currentDate < endDate) {
        currentDate = add(currentDate, { days: 1 })
        const dateStr = currentDate.toISOString().split('T')[0]
        dates.push(dateStr)
      }
    }

    // 6. Create segments for each date
    const createdIds: string[] = []

    for (const date of dates) {
      const dayWindow = getLocalDayWindow(date)

      // Clear existing segments for this day (within the day window)
      await prisma.staffPresence.deleteMany({
        where: {
          userId: targetUserId,
          startAt: {
            gte: dayWindow.start,
            lte: dayWindow.end,
          },
        },
      })

      // Create new segments
      for (const seg of validated.segments) {
        const status = await resolveStatus(seg.statusCode)
        const office = seg.officeCode ? await resolveOffice(seg.officeCode) : null

        const startAt = localToUTC(date, seg.from)
        const endAt = localToUTC(date, seg.to)

        const created = await prisma.staffPresence.create({
          data: {
            userId: targetUserId,
            statusId: status!.id,
            officeLocationId: office?.id || null,
            notes: seg.notes || null,
            startAt,
            endAt,
          },
        })

        if (date === validated.date) {
          createdIds.push(created.id)
        }
      }
    }

    // 7. Audit log
    await logEvent({
      action: 'presence.plan_day',
      entityType: 'staff_presence',
      entityId: createdIds[0] || 'bulk',
      actorEmail: currentUser.email,
      actorId: currentUser.id,
      actorType: 'human',
      newValues: {
        date: validated.date,
        repeatUntil: validated.repeatUntil,
        segmentCount: validated.segments.length,
        daysAffected: dates.length,
      },
      metadata: {
        targetUserId,
        createdIds,
      },
      redactionLevel: 1,
    })

    return NextResponse.json({
      success: true,
      createdIds,
      daysAffected: dates.length,
    })
  } catch (error: any) {
    // Handle auth/guard errors
    if (error instanceof NextResponse || error?.status) {
      return error
    }

    console.error('❌ Error planning day:', error)

    return NextResponse.json(
      {
        error: 'Failed to plan day',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
