import { prisma } from '@/lib/prisma'
import {
  validatePlanDay,
  PlanDayZ,
  type PlanDay,
  type Segment
} from './validation'
import { toUTC, fromUTC, startOfDayUTC, endOfDayUTC } from './timezone'
import { resolveStatus, resolveOffice } from './registry'

interface ExpandedSegment extends Segment {
  startTime: string
  endTime: string
  id: string
  statusId: string
  officeLocationId?: string
  status: {
    code: string
    label: string
    requiresOffice: boolean
    color?: string
    icon?: string
  }
  officeLocation?: {
    code: string
    name: string
  }
}

const MAX_DAY_MINUTES = parseInt(process.env.MAX_DAY_MINUTES || '480', 10)
const MAX_RANGE_DAYS = parseInt(process.env.MAX_RANGE_DAYS || '30', 10)

/**
 * Plan a day or multiple days with presence segments
 * Validates segments, checks for conflicts, and atomically updates schedule
 */
export async function planDay(
  userId: string,
  request: PlanDay
): Promise<ExpandedSegment[]> {
  // Validate request
  const validated = PlanDayZ.parse(request)

  // Validate business rules (8h cap, overlaps, office requirements)
  await validatePlanDay(validated)

  // Generate date range (single day or multiple days for repeat)
  const dates = generateDateRange(validated.date, validated.repeatUntil)

  if (dates.length > MAX_RANGE_DAYS) {
    throw new Error(`Cannot plan more than ${MAX_RANGE_DAYS} days at once`)
  }

  // Start transaction
  const result = await prisma.$transaction(async (tx) => {
    const created: ExpandedSegment[] = []

    for (const date of dates) {
      // Delete existing segments for this day
      const dayStart = startOfDayUTC(date)
      const dayEnd = endOfDayUTC(date)

      await tx.staffPresence.deleteMany({
        where: {
          userId,
          startAt: { gte: dayStart },
          endAt: { lte: dayEnd }
        }
      })

      // Create new segments for this day
      for (const segment of validated.segments) {
        const startAt = toUTC(date, segment.from)
        const endAt = toUTC(date, segment.to)

        // Resolve status code to ID
        const status = await resolveStatus(segment.statusCode)
        if (!status) {
          throw new Error()
        }

        // Resolve office code to ID (if provided)
        let officeLocationId: string | null = null
        if (segment.officeCode) {
          const office = await resolveOffice(segment.officeCode)
          if (!office) {
            throw new Error()
          }
          officeLocationId = office.id
        }

        const created_segment = await tx.staffPresence.create({
          data: {
            userId,
            statusId: status.id,
            officeLocationId,
            notes: segment.notes || null,
            startAt,
            endAt
          },
          include: {
            status: true,
            officeLocation: true
          }
        })

        created.push({
          id: created_segment.id,
          statusId: created_segment.statusId,
          officeLocationId: created_segment.officeLocationId || undefined,
          notes: created_segment.notes || undefined,
          startTime: segment.from,
          endTime: segment.to,
          status: {
            code: created_segment.status.code,
            label: created_segment.status.label,
            requiresOffice: created_segment.status.requiresOffice,
            color: created_segment.status.color || undefined,
            icon: created_segment.status.icon || undefined
          },
          officeLocation: created_segment.officeLocation ? {
            code: created_segment.officeLocation.code,
            name: created_segment.officeLocation.name
          } : undefined
        })
      }
    }

    return created
  })

  return result
}

/**
 * Get presence segments for a specific day
 */
export async function getDay(
  userId: string,
  date: string
): Promise<ExpandedSegment[]> {
  const dayStart = startOfDayUTC(date)
  const dayEnd = endOfDayUTC(date)

  const segments = await prisma.staffPresence.findMany({
    where: {
      userId,
      startAt: { gte: dayStart },
      endAt: { lte: dayEnd }
    },
    include: {
      status: true,
      officeLocation: true
    },
    orderBy: { startAt: 'asc' }
  })

  return segments.map(s => ({
    id: s.id,
    statusId: s.statusId,
    officeLocationId: s.officeLocationId || undefined,
    notes: s.notes || undefined,
    startTime: fromUTC(s.startAt).split('T')[1].substring(0, 5), // Extract HH:mm
    endTime: fromUTC(s.endAt).split('T')[1].substring(0, 5),
    status: {
      code: s.status.code,
      label: s.status.label,
      requiresOffice: s.status.requiresOffice,
      color: s.status.color || undefined,
      icon: s.status.icon || undefined
    },
    officeLocation: s.officeLocation ? {
      code: s.officeLocation.code,
      name: s.officeLocation.name
    } : undefined
  }))
}

/**
 * Delete a specific presence segment
 */
export async function deleteSegment(
  userId: string,
  segmentId: string
): Promise<void> {
  // Verify ownership
  const segment = await prisma.staffPresence.findUnique({
    where: { id: segmentId }
  })

  if (!segment) {
    throw new Error('Segment not found')
  }

  if (segment.userId !== userId) {
    throw new Error('Unauthorized: You can only delete your own segments')
  }

  await prisma.staffPresence.delete({
    where: { id: segmentId }
  })
}

/**
 * Get week view for a user (7 days starting from startDate)
 */
export async function getWeekView(
  userId: string,
  startDate?: string
): Promise<DaySchedule[]> {
  const start = startDate ? new Date(startDate) : new Date()
  start.setHours(0, 0, 0, 0)

  const dates = []
  for (let i = 0; i < 7; i++) {
    const date = new Date(start)
    date.setDate(start.getDate() + i)
    dates.push(date.toISOString().split('T')[0])
  }

  const weekStart = startOfDayUTC(dates[0])
  const weekEnd = endOfDayUTC(dates[6])

  // Fetch all segments for the week
  const segments = await prisma.staffPresence.findMany({
    where: {
      userId,
      startAt: { gte: weekStart },
      endAt: { lte: weekEnd }
    },
    include: {
      status: true,
      officeLocation: true
    },
    orderBy: { startAt: 'asc' }
  })

  // Group segments by date
  const scheduleByDate: Record<string, typeof segments> = {}
  segments.forEach(s => {
    const date = fromUTC(s.startAt).split('T')[0]
    if (!scheduleByDate[date]) {
      scheduleByDate[date] = []
    }
    scheduleByDate[date].push(s)
  })

  // Build week view
  return dates.map(date => {
    const daySegments = scheduleByDate[date] || []
    const dateObj = new Date(date)

    return {
      date,
      dayOfWeek: dateObj.toLocaleDateString('en-US', { weekday: 'long' }),
      month: dateObj.toLocaleDateString('en-US', { month: 'short' }),
      dayNumber: dateObj.getDate(),
      schedules: daySegments.map(s => ({
        id: s.id,
        status: `${s.status.label}${s.officeLocation ? ` - ${s.officeLocation.name}` : ''}`,
        type: 'specific-schedule',
        timeRange: `${fromUTC(s.startAt).split('T')[1].substring(0, 5)} - ${fromUTC(s.endAt).split('T')[1].substring(0, 5)}`,
        location: s.officeLocation?.name || null,
        notes: s.notes || null
      }))
    }
  })
}

/**
 * Generate array of date strings from start to end (inclusive)
 */
function generateDateRange(startDate: string, endDate?: string): string[] {
  const dates: string[] = []
  const start = new Date(startDate)
  start.setHours(0, 0, 0, 0)

  if (!endDate) {
    return [start.toISOString().split('T')[0]]
  }

  const end = new Date(endDate)
  end.setHours(0, 0, 0, 0)

  let current = new Date(start)
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0])
    current.setDate(current.getDate() + 1)
  }

  return dates
}

/**
 * Type definitions for week view
 */
export interface DaySchedule {
  date: string
  dayOfWeek: string
  month: string
  dayNumber: number
  schedules: {
    id: string
    status: string
    type: string
    timeRange: string
    location: string | null
    notes: string | null
  }[]
}

/**
 * Get current presence for multiple users (for directory view)
 */
export async function getCurrentPresences(
  userIds?: string[]
): Promise<CurrentPresence[]> {
  const now = new Date()

  const where = {
    startAt: { lte: now },
    endAt: { gte: now },
    ...(userIds ? { userId: { in: userIds } } : {})
  }

  const presences = await prisma.staffPresence.findMany({
    where,
    include: {
      status: true,
      officeLocation: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          jobTitle: true,
          avatar: true
        }
      }
    },
    orderBy: { startAt: 'desc' }
  })

  // Deduplicate by user (take most recent per user)
  const byUser = new Map<string, typeof presences[0]>()
  presences.forEach(p => {
    if (!byUser.has(p.userId)) {
      byUser.set(p.userId, p)
    }
  })

  return Array.from(byUser.values()).map(p => ({
    userId: p.userId,
    user: p.user,
    status: p.status.label,
    statusCode: p.status.code,
    officeLocation: p.officeLocation?.name || null,
    notes: p.notes || null,
    startAt: p.startAt.toISOString(),
    endAt: p.endAt.toISOString()
  }))
}

export interface CurrentPresence {
  userId: string
  user: {
    id: string
    firstName: string
    lastName: string
    email: string
    jobTitle: string | null
    avatar: string | null
  }
  status: string
  statusCode: string
  officeLocation: string | null
  notes: string | null
  startAt: string
  endAt: string
}
