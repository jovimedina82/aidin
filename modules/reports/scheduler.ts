/**
 * Phase 9: Analytics & Weekly Reporting
 * Scheduler for weekly KPI snapshots
 * Manual-triggered only (no timers started)
 */

import * as service from './service'
import * as repo from './repo'

/**
 * Run weekly snapshot job
 * Computes current KPIs and stores them in WeeklyKPI table
 *
 * @param now - Optional reference time (defaults to current UTC time)
 */
export async function runWeeklySnapshot(now?: Date): Promise<void> {
  const referenceTime = now || new Date()

  // Compute current KPIs from tickets data
  const kpis = await service.computeKPIs(referenceTime)

  // Calculate weekStartUTC (Monday 00:00:00 UTC of current week)
  const weekStartUTC = getWeekStart(referenceTime)

  // Upsert weekly snapshot to database
  await repo.upsertWeek({
    weekStartUTC,
    ticketsOpen: kpis.tickets_open,
    ticketsPending: kpis.tickets_pending,
    ticketsSolved7d: kpis.tickets_solved_7d,
    avgFirstResponseMinutes: kpis.avg_first_response_minutes,
  })

  console.log(`[scheduler] Weekly snapshot saved for ${weekStartUTC.toISOString()}`)
}

/**
 * Get Monday 00:00:00 UTC of the week containing the given date
 */
function getWeekStart(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = d.getUTCDay()
  const diff = (day === 0 ? -6 : 1) - day // Monday is day 1, Sunday is day 0
  d.setUTCDate(d.getUTCDate() + diff)
  d.setUTCHours(0, 0, 0, 0)
  return d
}
