---
report_version: 1
phase: phase-9-analytics
branch: refactor/phase-9-analytics
pr: https://github.com/jovimedina82/aidin/pull/10
status: success
impacts: ["api","reports","analytics","infra"]
risk_level: low
---

# Phase 9: Analytics & Weekly Reporting — Read-only KPIs + Safe Snapshots

## Executive Summary

Phase 9 implements minimal analytics layer for read-only KPI computation and optional weekly snapshots. Adds in-memory KPI calculations with 4 metrics (tickets_open, tickets_pending, tickets_solved_7d, avg_first_response_minutes), new WeeklyKPI Prisma model for historical tracking, and 1 new GET route with zero breaking changes.

**Key Achievements**:
- ✅ Analytics layer implemented (service, repo, scheduler)
- ✅ In-memory KPI computation (no DB write for API)
- ✅ WeeklyKPI Prisma model for snapshots
- ✅ 1 new route (GET /api/reports/kpis)
- ✅ CLI script for manual weekly snapshots
- ✅ 17 comprehensive tests (216/216 total passing)
- ✅ Zero breaking changes
- ✅ Build successful (46/46 routes, +1 new)

## Objectives

### Primary Goal
Introduce minimal analytics layer for read-only KPI computation and optional weekly snapshot storage with no impact on existing functionality.

### Specific Requirements
1. **Scope**: Only 1 new GET route (no writes from API)
2. **KPI Metrics**:
   - tickets_open: Count of OPEN tickets
   - tickets_pending: Count of PENDING tickets
   - tickets_solved_7d: Count of SOLVED tickets in last 7 days
   - avg_first_response_minutes: Average time to first comment
3. **Weekly Snapshots**: Manual CLI script only (no automatic timers)
4. **RBAC Integration**: REPORTS_READ permission required
5. **Testing**: Unit + integration tests with mocked Prisma
6. **Documentation**: 4 artifacts (REPORT, PR, PR_DESCRIPTION, terminal-output)

## Technical Implementation

### 1. Domain Types (`modules/reports/domain.ts`) - UPDATED

**New Interfaces**:
```typescript
export interface WeeklyKPI {
  id: string
  weekStartUTC: Date
  ticketsOpen: number
  ticketsPending: number
  ticketsSolved7d: number
  avgFirstResponseMinutes: number
  createdAt: Date
}

export interface KPISet {
  tickets_open: number
  tickets_pending: number
  tickets_solved_7d: number
  avg_first_response_minutes: number
  computed_at: string // ISO 8601
}

export interface WeeklyKPIInput {
  weekStartUTC: Date
  ticketsOpen: number
  ticketsPending: number
  ticketsSolved7d: number
  avgFirstResponseMinutes: number
}
```

### 2. Service Layer (`modules/reports/service.ts`) - UPDATED

**Core Function**:
```typescript
export async function computeKPIs(now?: Date): Promise<KPISet> {
  const referenceTime = now || new Date()

  // 1. tickets_open: status = OPEN
  const ticketsOpen = await prisma.ticket.count({
    where: { status: 'OPEN' },
  })

  // 2. tickets_pending: status = PENDING
  const ticketsPending = await prisma.ticket.count({
    where: { status: 'PENDING' },
  })

  // 3. tickets_solved_7d: status = SOLVED AND resolvedAt within last 7 days
  const sevenDaysAgo = new Date(referenceTime)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const ticketsSolved7d = await prisma.ticket.count({
    where: {
      status: 'SOLVED',
      resolvedAt: {
        gte: sevenDaysAgo,
        lte: referenceTime,
      },
    },
  })

  // 4. avg_first_response_minutes
  const ticketsWithComments = await prisma.ticket.findMany({
    where: { comments: { some: {} } },
    include: {
      comments: {
        orderBy: { createdAt: 'asc' },
        take: 1,
      },
    },
  })

  let totalResponseMinutes = 0
  let countWithComments = 0

  for (const ticket of ticketsWithComments) {
    if (ticket.comments.length > 0) {
      const firstComment = ticket.comments[0]
      const responseTime =
        firstComment.createdAt.getTime() - ticket.createdAt.getTime()
      const responseMinutes = Math.floor(responseTime / 60000)
      totalResponseMinutes += responseMinutes
      countWithComments++
    }
  }

  const avgFirstResponseMinutes =
    countWithComments > 0
      ? Math.round(totalResponseMinutes / countWithComments)
      : 0

  return {
    tickets_open: ticketsOpen,
    tickets_pending: ticketsPending,
    tickets_solved_7d: ticketsSolved7d,
    avg_first_response_minutes: avgFirstResponseMinutes,
    computed_at: referenceTime.toISOString(),
  }
}
```

**Key Features**:
- Pure in-memory computation
- No DB writes
- Optional reference time for testing
- Uses existing Ticket and TicketComment data

### 3. Repository Layer (`modules/reports/repo.ts`) - UPDATED

**New Data Access Methods**:
```typescript
export async function upsertWeek(data: WeeklyKPIInput): Promise<WeeklyKPI> {
  const record = await prisma.weeklyKPI.upsert({
    where: { weekStartUTC: data.weekStartUTC },
    update: {
      ticketsOpen: data.ticketsOpen,
      ticketsPending: data.ticketsPending,
      ticketsSolved7d: data.ticketsSolved7d,
      avgFirstResponseMinutes: data.avgFirstResponseMinutes,
    },
    create: {
      weekStartUTC: data.weekStartUTC,
      ticketsOpen: data.ticketsOpen,
      ticketsPending: data.ticketsPending,
      ticketsSolved7d: data.ticketsSolved7d,
      avgFirstResponseMinutes: data.avgFirstResponseMinutes,
    },
  })

  return mapToDTO(record)
}

export async function latest(n: number = 1): Promise<WeeklyKPI[]> {
  const records = await prisma.weeklyKPI.findMany({
    orderBy: { weekStartUTC: 'desc' },
    take: n,
  })

  return records.map(mapToDTO)
}
```

### 4. Scheduler (`modules/reports/scheduler.ts`) - UPDATED

**Weekly Snapshot Job**:
```typescript
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

function getWeekStart(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = d.getUTCDay()
  const diff = (day === 0 ? -6 : 1) - day // Monday is day 1
  d.setUTCDate(d.getUTCDate() + diff)
  d.setUTCHours(0, 0, 0, 0)
  return d
}
```

**Key Features**:
- Manual-triggered only (no automatic timers)
- Calculates Monday 00:00 UTC as week start
- Upserts to avoid duplicates

### 5. Prisma Schema (`prisma/schema.prisma`) - UPDATED

**New Model**:
```prisma
model WeeklyKPI {
  id                      String   @id @default(cuid())
  weekStartUTC            DateTime @unique
  ticketsOpen             Int
  ticketsPending          Int
  ticketsSolved7d         Int
  avgFirstResponseMinutes Int
  createdAt               DateTime @default(now())

  @@map("weekly_kpis")
}
```

### 6. New Route

#### GET /api/reports/kpis

**Purpose**: Compute and return current KPIs in-memory (no DB write)

**Authentication**: Required (getCurrentUser)

**Authorization**: REPORTS_READ permission

**Request**: None (query params optional for future)

**Response** (200 OK):
```json
{
  "tickets_open": 42,
  "tickets_pending": 15,
  "tickets_solved_7d": 28,
  "avg_first_response_minutes": 45,
  "computed_at": "2025-10-08T12:00:00.000Z"
}
```

**Error Responses**:
- 401: Not authenticated
- 403: Forbidden (missing REPORTS_READ permission)
- 500: Server error

### 7. CLI Script (`scripts/report-weekly.ts`) - NEW

**Purpose**: Manually trigger weekly KPI snapshot

**Usage**:
```bash
node scripts/report-weekly.ts
npx tsx scripts/report-weekly.ts
```

**Flow**:
1. Compute current KPIs via `reports.service.computeKPIs()`
2. Calculate weekStartUTC (Monday 00:00 UTC)
3. Upsert snapshot via `reports.repo.upsertWeek()`
4. Fetch and display latest 3 snapshots

**Output**:
```
[report-weekly] Starting weekly snapshot job...
[scheduler] Weekly snapshot saved for 2025-10-06T00:00:00.000Z
[report-weekly] Weekly snapshot completed successfully

[report-weekly] Latest 3 weekly snapshots:
  - Week 2025-10-06T00:00:00.000Z: 42 open, 15 pending, 28 solved (7d), avg response 45min
  - Week 2025-09-29T00:00:00.000Z: 38 open, 12 pending, 25 solved (7d), avg response 42min
  - Week 2025-09-22T00:00:00.000Z: 35 open, 10 pending, 22 solved (7d), avg response 40min
```

## Testing Strategy

### Test Coverage

**Total**: 216 tests (17 new Phase 9 tests)
- Domain Types: 2 tests
- service.computeKPIs(): 6 tests
- repo.upsertWeek(): 2 tests
- repo.latest(): 2 tests
- scheduler.runWeeklySnapshot(): 2 tests
- Module Exports: 3 tests

### Test Scenarios

**Service Layer**:
- ✅ Compute KPIs with zero values when no tickets exist
- ✅ Compute tickets_open count correctly
- ✅ Compute tickets_pending count correctly
- ✅ Compute tickets_solved_7d count with date filter
- ✅ Compute avg_first_response_minutes correctly
- ✅ Return 0 for avg when no comments exist

**Repository Layer**:
- ✅ Create new weekly snapshot
- ✅ Update existing weekly snapshot (upsert)
- ✅ Retrieve latest n snapshots ordered by weekStartUTC desc
- ✅ Default to n=1 if not specified

**Scheduler**:
- ✅ Compute KPIs and store weekly snapshot
- ✅ Calculate correct weekStartUTC (Monday 00:00 UTC)

## KPI Computation Details

### 1. tickets_open
**Query**: Count tickets where `status = 'OPEN'`
**Purpose**: Current workload visibility
**Real-time**: Yes (no caching)

### 2. tickets_pending
**Query**: Count tickets where `status = 'PENDING'`
**Purpose**: Tickets awaiting customer response
**Real-time**: Yes

### 3. tickets_solved_7d
**Query**: Count tickets where `status = 'SOLVED'` AND `resolvedAt >= (now - 7 days)` AND `resolvedAt <= now`
**Purpose**: Recent resolution rate
**Real-time**: Yes (uses Phase 8 resolvedAt timestamp)

### 4. avg_first_response_minutes
**Query**:
1. Find all tickets with at least one comment
2. For each ticket, calculate `(firstComment.createdAt - ticket.createdAt)` in minutes
3. Average across all tickets with comments
4. Return 0 if no tickets have comments

**Purpose**: Support team responsiveness
**Real-time**: Yes

## Security Considerations

### Authorization Improvements

1. **RBAC Integration**: Uses Phase 3 RBAC with REPORTS_READ permission
2. **Read-Only API**: GET route performs no DB writes
3. **Manual Snapshots**: CLI script requires server access (not exposed via API)
4. **No Sensitive Data**: KPIs contain only aggregated counts

## Backward Compatibility

### Preserved Interfaces

1. **Response Shapes**: New route returns KPISet (new type, no conflicts)
2. **Existing Routes**: No changes to existing routes
3. **DB Schema**: Migration adds new table, no changes to existing tables
4. **Phase 2 Scaffold Tests**: Updated to reflect Phase 9 implementation

### Breaking Changes

**None**. All existing functionality preserved.

## Performance Impact

### Minimal Overhead

- **GET /api/reports/kpis**: 4 Prisma count queries + 1 findMany for avg calculation
- **Weekly Snapshot**: Same KPI computation + 1 upsert
- **No Automatic Timers**: Snapshots only run when CLI script is manually executed

**Total**: Negligible overhead, read-only operations only

## Metrics

| Metric | Value |
|--------|-------|
| Files Created | 2 (route, script) |
| Files Modified | 7 |
| Lines Added | ~450 |
| Test Cases Added | 17 |
| Test Pass Rate | 100% (216/216) |
| Build Success | ✅ (46/46 routes, +1 new) |
| Type Errors | 0 |
| New Routes | 1 (GET /api/reports/kpis) |
| Breaking Changes | 0 |

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Performance on large datasets | Medium | KPI queries use indexed columns (status, resolvedAt) |
| Missing REPORTS_READ permission | Low | RBAC enforces at route level |
| Snapshot conflicts | Low | Unique constraint on weekStartUTC prevents duplicates |
| First response calculation accuracy | Medium | Uses first comment timestamp (assumes staff comments first) |

## Future Work

### Not In Scope (Phase 9)

1. **Advanced KPIs**: Resolution time, customer satisfaction, SLA compliance
2. **Automatic Snapshots**: Cron-based weekly job
3. **Historical Trends**: API endpoint for time-series data
4. **Dashboards**: UI components for KPI visualization
5. **Alerts**: Threshold-based notifications

### Recommended Next Steps

1. **Phase 10**: Implement automatic weekly snapshot cron job
2. **Phase 11**: Add historical trends API endpoint
3. **Phase 12**: Build dashboard UI components

## Conclusion

Phase 9 successfully implements minimal analytics layer for read-only KPI computation and optional weekly snapshots. Adds 4 core metrics, new WeeklyKPI model, and maintains 100% backward compatibility. All tests pass (216/216), build succeeds, zero breaking changes.

**Key Wins**:
- ✅ Read-only KPI API (no DB writes)
- ✅ Manual snapshots via CLI script
- ✅ Comprehensive test coverage (17 new tests)
- ✅ Zero breaking changes
- ✅ Type-safe implementation
- ✅ Performance-optimized queries

**Ready for PR and merge**.
