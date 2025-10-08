# Phase 9: Analytics & Weekly Reporting — Read-only KPIs + Safe Snapshots

## Summary

Implements minimal analytics layer for read-only KPI computation and optional weekly snapshots. Adds in-memory KPI calculations with 4 metrics, new WeeklyKPI Prisma model for historical tracking, and RBAC integration. Includes 1 new GET route with zero breaking changes.

## Implementation Details

### 1. Domain Types (`modules/reports/domain.ts`) - UPDATED

**New Interfaces**:
```typescript
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
```

### 2. Service Layer (`modules/reports/service.ts`) - UPDATED

**Core Function**:
```typescript
/**
 * Compute KPIs in-memory from Tickets data
 * No DB write - returns real-time KPI values
 *
 * @param now - Optional reference time (defaults to current UTC time)
 */
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

  // 4. avg_first_response_minutes:
  // Average time between ticket createdAt and first comment createdAt
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

### 3. Repository Layer (`modules/reports/repo.ts`) - UPDATED

**New Data Access Methods**:
```typescript
/**
 * Upsert a weekly KPI snapshot
 * If a snapshot exists for the given weekStartUTC, update it
 * Otherwise, create a new one
 */
export async function upsertWeek(data: WeeklyKPIInput): Promise<WeeklyKPI>

/**
 * Retrieve the latest n weekly KPI snapshots
 * Ordered by weekStartUTC descending
 */
export async function latest(n: number = 1): Promise<WeeklyKPI[]>
```

### 4. Scheduler (`modules/reports/scheduler.ts`) - UPDATED

**Weekly Snapshot Job**:
```typescript
/**
 * Run weekly snapshot job
 * Computes current KPIs and stores them in WeeklyKPI table
 * Manual-triggered only (no timers started)
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
```

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

**Migration**:
```bash
npx prisma db push --force-reset  # Development only
```

### 6. New Route

#### GET /api/reports/kpis

**Location**: `app/api/reports/kpis/route.js`

**Purpose**: Compute and return current KPIs in-memory (no DB write)

**Request**: None (query params optional for future)

**Flow**:
1. Authenticate user (getCurrentUser)
2. Check RBAC permission (REPORTS_READ)
3. Compute KPIs in-memory (service.computeKPIs)
4. Return KPISet

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
1. Run `reports.scheduler.runWeeklySnapshot()`
2. Fetch latest 3 snapshots via `reports.repo.latest(3)`
3. Display results and exit

**Example Output**:
```
[report-weekly] Starting weekly snapshot job...
[scheduler] Weekly snapshot saved for 2025-10-06T00:00:00.000Z
[report-weekly] Weekly snapshot completed successfully

[report-weekly] Latest 3 weekly snapshots:
  - Week 2025-10-06T00:00:00.000Z: 42 open, 15 pending, 28 solved (7d), avg response 45min
  - Week 2025-09-29T00:00:00.000Z: 38 open, 12 pending, 25 solved (7d), avg response 42min
  - Week 2025-09-22T00:00:00.000Z: 35 open, 10 pending, 22 solved (7d), avg response 40min
```

## Testing Results

### ✅ All Tests Passing: 216/216

```
✓ tests/phase9-analytics.test.ts (17 tests) 8ms
✓ tests/phase6-email.test.ts (29 tests) 7ms
✓ tests/phase5-ai-abstraction.test.ts (19 tests) 11ms
✓ tests/phase7-comments.test.ts (34 tests) 9ms
✓ tests/phase4-tickets-service.test.ts (16 tests) 6ms
✓ tests/phase8-workflows.test.ts (34 tests) 7ms
✓ tests/phase2-scaffold.test.ts (30 tests) 10ms
✓ tests/phase3-auth-rbac.test.ts (37 tests) 13ms

Test Files  8 passed (8)
Tests       216 passed (216)
Duration    605ms
```

**New Phase 9 Tests (17)**:
- Domain Types (2 tests)
- service.computeKPIs() (6 tests)
- repo.upsertWeek() (2 tests)
- repo.latest() (2 tests)
- scheduler.runWeeklySnapshot() (2 tests)
- Module Exports (3 tests)

### ✅ Build Successful: 46/46 Routes

```
✓ Compiled successfully
✓ Generating static pages (46/46)
```

**New Route**:
- ƒ /api/reports/kpis (Phase 9 - NEW)

## KPI Computation Details

### 1. tickets_open
**Query**: `COUNT(*) WHERE status = 'OPEN'`
**Purpose**: Current workload visibility
**Performance**: Indexed on status column

### 2. tickets_pending
**Query**: `COUNT(*) WHERE status = 'PENDING'`
**Purpose**: Tickets awaiting customer response
**Performance**: Indexed on status column

### 3. tickets_solved_7d
**Query**: `COUNT(*) WHERE status = 'SOLVED' AND resolvedAt >= (now - 7 days) AND resolvedAt <= now`
**Purpose**: Recent resolution rate
**Performance**: Indexed on status and resolvedAt columns

### 4. avg_first_response_minutes
**Query**:
1. `FIND_MANY tickets WHERE comments.length > 0`
2. For each: `(firstComment.createdAt - ticket.createdAt) / 60000`
3. `AVG(all response times)`

**Purpose**: Support team responsiveness
**Performance**: Uses relation query with limit 1

## Breaking Changes

**None**. All existing functionality preserved:
- Existing routes unchanged
- Response shapes identical
- DB schema adds new table only
- Phase 2 scaffold tests updated to reflect new API

## Files Changed

**Created (2)**:
- `app/api/reports/kpis/route.js` - Read-only KPI route
- `scripts/report-weekly.ts` - CLI script for manual snapshots
- `tests/phase9-analytics.test.ts` - Comprehensive tests (17 tests)

**Modified (7)**:
- `prisma/schema.prisma` - Added WeeklyKPI model
- `modules/reports/domain.ts` - Added KPISet, WeeklyKPI, WeeklyKPIInput
- `modules/reports/service.ts` - Implemented computeKPIs()
- `modules/reports/repo.ts` - Implemented upsertWeek(), latest()
- `modules/reports/scheduler.ts` - Implemented runWeeklySnapshot()
- `modules/reports/index.ts` - Exported new functions
- `tests/phase2-scaffold.test.ts` - Updated to reflect Phase 9 API

## Risk Assessment

**Risk Level**: Low

**Mitigations**:
- Minimal scope (1 GET route, no automatic timers)
- No changes to existing routes
- Comprehensive test coverage (17 new tests)
- Type safety with TypeScript
- Read-only API (no DB writes from route)
- RBAC enforces permissions
- All tests passing (216/216)

## Metrics

| Metric | Value |
|--------|-------|
| Files Created | 2 |
| Files Modified | 7 |
| Lines Added | ~450 |
| Test Cases Added | 17 |
| Test Pass Rate | 100% (216/216) |
| Build Success | ✅ (46/46 routes, +1 new) |
| Type Errors | 0 |
| New Routes | 1 (GET /api/reports/kpis) |
| Breaking Changes | 0 |

---

**Ready for Review** ✅
