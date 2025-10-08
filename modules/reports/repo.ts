/**
 * Reports Repository Interface
 * Phase 2 Scaffold - Phase 3 Implementation
 * NO Prisma imports - interface only
 */

import { WeeklyKPI, KPIFilters } from './domain'

export interface ReportsRepository {
  saveKPI(kpi: WeeklyKPI): Promise<WeeklyKPI>
  getKPIs(filters: KPIFilters): Promise<WeeklyKPI[]>
  getLatestKPI(): Promise<WeeklyKPI | null>
}
