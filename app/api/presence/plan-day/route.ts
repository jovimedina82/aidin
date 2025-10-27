/**
 * POST /api/presence/plan-day
 *
 * Plan daily schedule with multi-segment support and optional repeat logic.
 * Features: 8h daily cap, no overlaps, requiresOffice validation, audit logging.
 */

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { isAdmin, isRequester, canEditSchedule } from '@/lib/role-utils'
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

    // 4. Authorization
    const targetUserId = validated.userId || currentUser.id

    // Block Requesters from creating/editing schedules
    if (isRequester(currentUser)) {
      return NextResponse.json(
        { error: 'Forbidden: Requesters cannot create or edit schedules' },
        { status: 403 }
      )
    }

    // Staff/Managers can only edit their own schedule; Admins can edit any
    if (!canEditSchedule(currentUser, targetUserId)) {
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

    // 6. Create segments for each date with auto-merge logic and 8-hour cap validation
    const createdIds: string[] = []

    for (const date of dates) {
      const dayWindow = getLocalDayWindow(date)

      // Fetch existing segments for this day
      const existingSegments = await prisma.staffPresence.findMany({
        where: {
          userId: targetUserId,
          startAt: {
            gte: dayWindow.start,
            lte: dayWindow.end,
          },
        },
        include: {
          status: true,
          officeLocation: true,
        },
      })

      // Calculate existing total hours
      const existingMinutes = existingSegments.reduce((sum, seg) => {
        const duration = (seg.endAt.getTime() - seg.startAt.getTime()) / (1000 * 60)
        return sum + duration
      }, 0)

      // Calculate new segments total hours
      let newMinutes = 0
      const newSegmentData: Array<{
        statusId: string
        officeLocationId: string | null
        startAt: Date
        endAt: Date
        notes: string | null
        matchingSegment?: typeof existingSegments[0]
      }> = []

      for (const seg of validated.segments) {
        const status = await resolveStatus(seg.statusCode)
        const office = seg.officeCode ? await resolveOffice(seg.officeCode) : null

        const startAt = localToUTC(date, seg.from)
        const endAt = localToUTC(date, seg.to)
        const segMinutes = (endAt.getTime() - startAt.getTime()) / (1000 * 60)

        // Check if there's an existing segment with same status and office
        const matchingSegment = existingSegments.find(
          (existing) =>
            existing.statusId === status!.id &&
            existing.officeLocationId === (office?.id || null)
        )

        if (matchingSegment) {
          // Calculate merged duration
          const mergedStart = Math.min(matchingSegment.startAt.getTime(), startAt.getTime())
          const mergedEnd = Math.max(matchingSegment.endAt.getTime(), endAt.getTime())
          const mergedMinutes = (mergedEnd - mergedStart) / (1000 * 60)
          const existingSegmentMinutes = (matchingSegment.endAt.getTime() - matchingSegment.startAt.getTime()) / (1000 * 60)

          // Only count the additional time being added
          newMinutes += mergedMinutes - existingSegmentMinutes
        } else {
          // New segment adds full duration
          newMinutes += segMinutes
        }

        newSegmentData.push({
          statusId: status!.id,
          officeLocationId: office?.id || null,
          startAt,
          endAt,
          notes: seg.notes || null,
          matchingSegment,
        })
      }

      // Validate total (existing + new) doesn't exceed 480 minutes (8 hours)
      const totalMinutes = existingMinutes + newMinutes

      if (totalMinutes > 480) {
        const existingHours = Math.floor(existingMinutes / 60)
        const existingMins = Math.round(existingMinutes % 60)
        const remainingMinutes = 480 - existingMinutes
        const remainingHours = Math.floor(remainingMinutes / 60)
        const remainingMins = Math.round(remainingMinutes % 60)

        if (existingMinutes >= 480) {
          return NextResponse.json(
            {
              error: 'This day is already fully scheduled (8 hours).',
              details: [
                {
                  field: 'segments',
                  message: 'This day is already fully scheduled (8 hours).',
                },
              ],
            },
            { status: 422 }
          )
        } else {
          return NextResponse.json(
            {
              error: 'Cannot exceed 8 hours per day',
              details: [
                {
                  field: 'segments',
                  message: `Cannot exceed 8 hours per day. ${existingHours}h ${existingMins}m already scheduled, only ${remainingHours}h ${remainingMins}m remaining.`,
                },
              ],
            },
            { status: 422 }
          )
        }
      }

      // Now create or merge segments
      for (const segData of newSegmentData) {
        if (segData.matchingSegment) {
          // Merge: extend the time range
          const newStartAt = new Date(Math.min(segData.matchingSegment.startAt.getTime(), segData.startAt.getTime()))
          const newEndAt = new Date(Math.max(segData.matchingSegment.endAt.getTime(), segData.endAt.getTime()))

          await prisma.staffPresence.update({
            where: { id: segData.matchingSegment.id },
            data: {
              startAt: newStartAt,
              endAt: newEndAt,
              notes: segData.notes || segData.matchingSegment.notes,
            },
          })

          if (date === validated.date) {
            createdIds.push(segData.matchingSegment.id)
          }
        } else {
          // Create new segment
          const created = await prisma.staffPresence.create({
            data: {
              userId: targetUserId,
              statusId: segData.statusId,
              officeLocationId: segData.officeLocationId,
              notes: segData.notes,
              startAt: segData.startAt,
              endAt: segData.endAt,
            },
          })

          if (date === validated.date) {
            createdIds.push(created.id)
          }
        }
      }
    }

    // 7. Audit log
    await logEvent({
      action: 'presence.plan_day',
      entityType: 'user',
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
