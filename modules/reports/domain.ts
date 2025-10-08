/**
 * Reports Domain Types and DTOs
 * Phase 2 Scaffold
 */

export interface WeeklyKPI {
  weekStart: Date
  weekEnd: Date
  openTickets: number
  closedTickets: number
  avgResponseTime: number
  avgResolutionTime: number
  satisfactionScore?: number
  topCategories: { category: string; count: number }[]
  createdAt: Date
}

export interface TrendPoint {
  date: Date
  value: number
}

export interface TrendData {
  metric: string
  points: TrendPoint[]
}

export interface KPIFilters {
  startDate?: Date
  endDate?: Date
  category?: string
}
