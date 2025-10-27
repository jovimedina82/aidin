/**
 * Client-safe validation utilities
 *
 * These utilities can be used in both client and server components.
 * They have no dependencies on Prisma or other server-only modules.
 */

import { z } from 'zod'

export const MAX_DAY_MINUTES = parseInt(process.env.NEXT_PUBLIC_MAX_DAY_MINUTES || process.env.MAX_DAY_MINUTES || '480', 10) // 8 hours
export const MAX_RANGE_DAYS = parseInt(process.env.NEXT_PUBLIC_MAX_RANGE_DAYS || process.env.MAX_RANGE_DAYS || '30', 10)

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
