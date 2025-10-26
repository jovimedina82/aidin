/**
 * Presence Module Validation
 *
 * Zod schemas with business rules:
 * - Segments must not overlap
 * - Daily total ≤ MAX_DAY_MINUTES (default 480 = 8 hours)
 * - Time ranges must not cross midnight
 * - If status requires office, officeCode is required
 * - repeatUntil must be ≤ date + MAX_RANGE_DAYS
 */

import { z } from 'zod'
import { resolveStatus, resolveOffice } from './registry'
import { crossesMidnight } from './timezone'
import { add } from 'date-fns'

export const MAX_DAY_MINUTES = parseInt(process.env.MAX_DAY_MINUTES || '480', 10) // 8 hours
export const MAX_RANGE_DAYS = parseInt(process.env.MAX_RANGE_DAYS || '30', 10)

// HH:mm regex
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/

/**
 * Base segment schema
 */
export const SegmentZ = z.object({
  statusCode: z.string().min(1, 'Status code is required'),
  officeCode: z.string().optional(),
  from: z.string().regex(TIME_REGEX, 'Invalid time format. Use HH:mm'),
  to: z.string().regex(TIME_REGEX, 'Invalid time format. Use HH:mm'),
  notes: z.string().max(500, 'Notes must be ≤500 characters').optional(),
})

export type Segment = z.infer<typeof SegmentZ>

/**
 * Plan day schema (before business rule validation)
 */
export const PlanDayZ = z.object({
  userId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Use YYYY-MM-DD'),
  segments: z.array(SegmentZ).min(1, 'At least one segment is required'),
  repeatUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Use YYYY-MM-DD').optional(),
})

export type PlanDay = z.infer<typeof PlanDayZ>

/**
 * Validation error with field path
 */
export interface ValidationError {
  field: string
  message: string
}

/**
 * Convert time string (HH:mm) to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/**
 * Calculate duration in minutes
 */
function calculateDuration(from: string, to: string): number {
  return timeToMinutes(to) - timeToMinutes(from)
}

/**
 * Check if two time ranges overlap
 */
function rangesOverlap(a: { from: string; to: string }, b: { from: string; to: string }): boolean {
  const aStart = timeToMinutes(a.from)
  const aEnd = timeToMinutes(a.to)
  const bStart = timeToMinutes(b.from)
  const bEnd = timeToMinutes(b.to)

  // Ranges overlap if one starts before the other ends
  return aStart < bEnd && bStart < aEnd
}

/**
 * Validate segments against business rules
 *
 * @throws Array of ValidationError if validation fails
 */
export async function validateSegments(segments: Segment[]): Promise<void> {
  const errors: ValidationError[] = []

  // 1. Validate each segment individually
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]

    // Check midnight crossing
    if (crossesMidnight(seg.from, seg.to)) {
      errors.push({
        field: `segments[${i}].to`,
        message: 'Time range cannot cross midnight. End time must be after start time.',
      })
      continue // Skip further validation for this segment
    }

    // Validate status exists and is active
    const status = await resolveStatus(seg.statusCode)
    if (!status) {
      errors.push({
        field: `segments[${i}].statusCode`,
        message: `Status "${seg.statusCode}" not found or inactive`,
      })
      continue
    }

    // Check requiresOffice constraint
    if (status.requiresOffice && !seg.officeCode) {
      errors.push({
        field: `segments[${i}].officeCode`,
        message: `Status "${status.label}" requires an office location`,
      })
    }

    // Validate office if provided
    if (seg.officeCode) {
      const office = await resolveOffice(seg.officeCode)
      if (!office) {
        errors.push({
          field: `segments[${i}].officeCode`,
          message: `Office "${seg.officeCode}" not found or inactive`,
        })
      }
    }
  }

  // 2. Check for overlaps
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const segI = segments[i] as { from: string; to: string }
      const segJ = segments[j] as { from: string; to: string }
      if (rangesOverlap(segI, segJ)) {
        errors.push({
          field: `segments[${j}]`,
          message: `Overlaps with segment ${i + 1} (${segments[i].from}–${segments[i].to})`,
        })
      }
    }
  }

  // 3. Check daily duration cap
  const totalMinutes = segments.reduce((sum, seg) => {
    return sum + calculateDuration(seg.from, seg.to)
  }, 0)

  if (totalMinutes > MAX_DAY_MINUTES) {
    const totalHours = (totalMinutes / 60).toFixed(1)
    const maxHours = (MAX_DAY_MINUTES / 60).toFixed(1)
    errors.push({
      field: 'segments',
      message: `Total duration ${totalHours}h exceeds daily cap of ${maxHours}h`,
    })
  }

  if (errors.length > 0) {
    throw errors
  }
}

/**
 * Validate plan day request
 *
 * @throws Array of ValidationError if validation fails
 */
export async function validatePlanDay(plan: PlanDay): Promise<void> {
  const errors: ValidationError[] = []

  // 1. Validate repeatUntil range
  if (plan.repeatUntil) {
    const startDate = new Date(plan.date + 'T00:00:00')
    const endDate = new Date(plan.repeatUntil + 'T00:00:00')
    const maxDate = add(startDate, { days: MAX_RANGE_DAYS })

    if (endDate < startDate) {
      errors.push({
        field: 'repeatUntil',
        message: 'End date must be after start date',
      })
    } else if (endDate > maxDate) {
      errors.push({
        field: 'repeatUntil',
        message: `Range cannot exceed ${MAX_RANGE_DAYS} days`,
      })
    }
  }

  // 2. Validate segments
  try {
    await validateSegments(plan.segments)
  } catch (segmentErrors) {
    if (Array.isArray(segmentErrors)) {
      errors.push(...segmentErrors)
    }
  }

  if (errors.length > 0) {
    throw errors
  }
}

/**
 * Calculate total minutes for segments
 */
export function calculateTotalMinutes(segments: Segment[]): number {
  return segments.reduce((sum, seg) => {
    return sum + calculateDuration(seg.from, seg.to)
  }, 0)
}

/**
 * Calculate remaining minutes before hitting cap
 */
export function calculateRemainingMinutes(segments: Segment[]): number {
  const total = calculateTotalMinutes(segments)
  return Math.max(0, MAX_DAY_MINUTES - total)
}

/**
 * Format minutes as "Xh Ym" or "Xh" or "Ym"
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}
