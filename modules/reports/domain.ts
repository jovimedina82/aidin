/**
 * Phase 9: Analytics & Weekly Reporting
 * Domain types for KPIs and weekly snapshots
 */

/**
 * Weekly KPI snapshot stored in database
 */
export interface WeeklyKPI {
  id: string
  weekStartUTC: Date
  ticketsOpen: number
  ticketsPending: number
  ticketsSolved7d: number
  avgFirstResponseMinutes: number
  createdAt: Date
}

/**
 * In-memory KPI computation result
 * No DB write, used for real-time API responses
 */
export interface KPISet {
  tickets_open: number
  tickets_pending: number
  tickets_solved_7d: number
  avg_first_response_minutes: number
  computed_at: string // ISO 8601
}

/**
 * Input for upserting a weekly snapshot
 */
export interface WeeklyKPIInput {
  weekStartUTC: Date
  ticketsOpen: number
  ticketsPending: number
  ticketsSolved7d: number
  avgFirstResponseMinutes: number
}
