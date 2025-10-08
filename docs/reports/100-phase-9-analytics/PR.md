# Phase 9: Analytics & Weekly Reporting (Read-only KPIs + Safe Snapshots)

Implements minimal analytics layer for read-only KPI computation and optional weekly snapshots. Adds in-memory KPI calculations, new WeeklyKPI Prisma model, and 1 new GET route. Zero breaking changes, preserves all existing response shapes.

**New Route**:
- GET /api/reports/kpis - Read-only KPI computation (tickets_open, tickets_pending, tickets_solved_7d, avg_first_response_minutes)

**New Script**:
- `node scripts/report-weekly.ts` - Manually trigger weekly KPI snapshot

**Features**:
- In-memory KPI computation (no DB writes from API)
- WeeklyKPI Prisma model with unique weekStartUTC
- Manual CLI script for weekly snapshots (no automatic timers)
- RBAC integration (REPORTS_READ permission required)

**Testing**: 216/216 tests passing (17 new Phase 9 tests)
**Build**: ✅ 46/46 routes compiled (+1 new)
**Risk**: Low (read-only API, minimal scope)
