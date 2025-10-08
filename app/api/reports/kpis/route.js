/**
 * Phase 9: Analytics & Weekly Reporting
 * GET /api/reports/kpis - Read-only KPI computation
 */

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import * as users from '@/modules/users'
import * as reports from '@/modules/reports'

/**
 * GET /api/reports/kpis
 *
 * Returns in-memory computed KPIs (no DB write)
 * Requires authentication and REPORTS_READ permission
 *
 * Response:
 * {
 *   tickets_open: number,
 *   tickets_pending: number,
 *   tickets_solved_7d: number,
 *   avg_first_response_minutes: number,
 *   computed_at: string (ISO 8601)
 * }
 */
export async function GET(request) {
  try {
    // 1. Authenticate user
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // 2. Check RBAC permission
    const userDTO = {
      id: user.id,
      email: user.email,
      roles: user.roles,
    }

    if (!users.rbac.can(userDTO, users.rbac.Action.REPORTS_READ)) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      )
    }

    // 3. Compute KPIs in-memory (no DB write)
    const kpis = await reports.service.computeKPIs()

    return NextResponse.json(kpis)
  } catch (error) {
    console.error('Error computing KPIs:', error)
    return NextResponse.json(
      { error: 'Failed to compute KPIs' },
      { status: 500 }
    )
  }
}
