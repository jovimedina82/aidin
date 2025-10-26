/**
 * Timezone utilities for Presence Module
 *
 * Handles conversion between local time (user's calendar day + HH:mm)
 * and UTC timestamps for database storage.
 */

import { format, parse, startOfDay, endOfDay } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'

const DEFAULT_TZ = process.env.APP_TZ || 'America/Los_Angeles'

/**
 * Convert local date (YYYY-MM-DD) + time (HH:mm) to UTC Date
 *
 * @param dateStr - Local date "YYYY-MM-DD"
 * @param timeStr - Local time "HH:mm"
 * @param timezone - Optional timezone (defaults to APP_TZ)
 * @returns UTC Date object
 */
export function localToUTC(
  dateStr: string,
  timeStr: string,
  timezone: string = DEFAULT_TZ
): Date {
  // Parse local date+time as "YYYY-MM-DD HH:mm"
  const localDateTime = parse(`${dateStr} ${timeStr}`, 'yyyy-MM-dd HH:mm', new Date())

  // Convert to UTC
  return fromZonedTime(localDateTime, timezone)
}

/**
 * Convert UTC Date to local time string (HH:mm)
 *
 * @param utcDate - UTC Date object
 * @param timezone - Optional timezone (defaults to APP_TZ)
 * @returns Local time "HH:mm"
 */
export function utcToLocalTime(utcDate: Date, timezone: string = DEFAULT_TZ): string {
  const zonedDate = toZonedTime(utcDate, timezone)
  return format(zonedDate, 'HH:mm')
}

/**
 * Get the local day window (start/end) for a given date
 *
 * @param dateStr - Local date "YYYY-MM-DD"
 * @param timezone - Optional timezone (defaults to APP_TZ)
 * @returns { start: UTC Date (00:00), end: UTC Date (23:59:59.999) }
 */
export function getLocalDayWindow(
  dateStr: string,
  timezone: string = DEFAULT_TZ
): { start: Date; end: Date } {
  const localDate = parse(dateStr, 'yyyy-MM-dd', new Date())

  const dayStart = startOfDay(localDate)
  const dayEnd = endOfDay(localDate)

  return {
    start: fromZonedTime(dayStart, timezone),
    end: fromZonedTime(dayEnd, timezone),
  }
}

/**
 * Format UTC Date to local date string (YYYY-MM-DD)
 *
 * @param utcDate - UTC Date object
 * @param timezone - Optional timezone (defaults to APP_TZ)
 * @returns Local date "YYYY-MM-DD"
 */
export function utcToLocalDate(utcDate: Date, timezone: string = DEFAULT_TZ): string {
  const zonedDate = toZonedTime(utcDate, timezone)
  return format(zonedDate, 'yyyy-MM-dd')
}

/**
 * Check if a time string crosses midnight (should be blocked)
 *
 * @param from - Start time "HH:mm"
 * @param to - End time "HH:mm"
 * @returns true if invalid (to <= from)
 */
export function crossesMidnight(from: string, to: string): boolean {
  return to <= from
}
