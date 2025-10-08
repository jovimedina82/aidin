# Phase 8: Tickets Workflows — Status Transitions + Auto-Assign

## Summary

Implements workflow layer for ticket status transitions and optional auto-assignment. Adds state machine validation with allowed transitions, policy enforcement for CLIENT self-close only, and RBAC integration. Includes 2 new routes (PATCH status/assign) with zero breaking changes.

## Implementation Details

### 1. Workflow Layer (`modules/tickets/workflows.ts`) - NEW

**Allowed Transitions State Machine**:
```typescript
export const ALLOWED_TRANSITIONS: StatusTransitionMap = {
  [Status.NEW]: [Status.OPEN, Status.CLOSED],
  [Status.OPEN]: [Status.PENDING, Status.ON_HOLD, Status.SOLVED, Status.CLOSED],
  [Status.PENDING]: [Status.OPEN, Status.SOLVED],
  [Status.ON_HOLD]: [Status.OPEN, Status.SOLVED],
  [Status.SOLVED]: [Status.CLOSED, Status.OPEN],
  [Status.CLOSED]: [], // Terminal state
}
```

**Core Functions**:
```typescript
/**
 * Transition a ticket to a new status
 * - Validates user permission via policy.canTransition()
 * - Validates state machine allows transition
 * - Sets/clears resolvedAt when moving to/from SOLVED
 */
export async function transition(
  currentUser: PolicyUser,
  ticket: TicketDTO,
  nextStatus: Status
): Promise<TicketDTO>

/**
 * Auto-assign ticket to an agent
 * - Only when AUTO_ASSIGN_ENABLED=true and no assignee
 * - Stub strategy returns 'auto-assigned-agent-1'
 */
export async function autoAssign(
  currentUser: PolicyUser,
  ticket: TicketDTO
): Promise<TicketDTO>

/**
 * Assign ticket to specific agent
 * - Validates user permission via policy.canAssign()
 */
export async function assign(
  currentUser: PolicyUser,
  ticket: TicketDTO,
  assigneeId: string | null
): Promise<TicketDTO>
```

### 2. Policy Extensions (`modules/tickets/policy.ts`) - UPDATED

**New Authorization Guards**:
```typescript
/**
 * Check if user can transition a ticket
 * - ADMIN/STAFF: can transition any ticket to any allowed state
 * - CLIENT: can ONLY transition own tickets to CLOSED
 */
export function canTransition(
  user: PolicyUser,
  ticket: TicketDTO,
  nextStatus: any
): boolean

/**
 * Check if user can assign a ticket
 * - ADMIN/STAFF: can assign any ticket
 * - CLIENT: cannot assign
 */
export function canAssign(
  user: PolicyUser,
  ticket: TicketDTO,
  assigneeId: string | null
): boolean
```

### 3. Repository Extensions (`modules/tickets/repo.impl.ts`) - UPDATED

**New Data Access Methods**:
```typescript
/**
 * Update ticket status with optional resolvedAt handling
 */
export async function updateStatus(
  id: string,
  status: Status,
  opts?: { resolvedAt?: Date | null }
): Promise<TicketDTO>

/**
 * Update ticket assignee
 */
export async function updateAssignee(
  id: string,
  assigneeId: string | null
): Promise<TicketDTO>
```

**resolvedAt Logic**:
- Moving TO SOLVED: `resolvedAt = new Date()`
- Moving OFF SOLVED: `resolvedAt = null`
- Other transitions: no change

### 4. Configuration (`lib/config.ts`) - UPDATED

**New Feature Flag**:
```typescript
/**
 * Tickets Workflow Configuration
 * Phase 8: Auto-assignment feature flag
 */
AUTO_ASSIGN_ENABLED: process.env.AUTO_ASSIGN_ENABLED === 'true',
```

**Default**: `false` (auto-assign disabled)

### 5. New Routes

#### PATCH /api/tickets/:id/status

**Location**: `app/api/tickets/[id]/status/route.js`

**Request Body**:
```json
{
  "status": "PENDING" | "OPEN" | "SOLVED" | "CLOSED" | ...
}
```

**Flow**:
1. Authenticate user (getCurrentUser)
2. Fetch ticket (service.get)
3. Validate transition (workflows.transition)
4. Return updated ticket

**Error Responses**:
- 400: Invalid transition
- 401: Not authenticated
- 403: Forbidden (policy violation)
- 404: Ticket not found
- 500: Server error

#### PATCH /api/tickets/:id/assign

**Location**: `app/api/tickets/[id]/assign/route.js`

**Request Body**:
```json
{
  "assigneeId": "agent-1" | null
}
```

**Flow**:
1. Authenticate user
2. Fetch ticket
3. Validate assignment (workflows.assign)
4. Return updated ticket

**Error Responses**:
- 401: Not authenticated
- 403: Forbidden (CLIENT cannot assign)
- 404: Ticket not found
- 500: Server error

### 6. RBAC Updates (`modules/users/rbac.ts`) - UPDATED

**Client Permission Addition**:
```typescript
Client: [
  Action.TICKET_CREATE,
  Action.TICKET_READ,
  Action.TICKET_READ_OWN,
  Action.TICKET_UPDATE, // Phase 8: Allow clients to close own tickets
  Action.COMMENT_CREATE,
  Action.COMMENT_READ,
],
```

## Testing Results

### ✅ All Tests Passing: 199/199

```
✓ tests/phase6-email.test.ts (29 tests) 6ms
✓ tests/phase5-ai-abstraction.test.ts (19 tests) 10ms
✓ tests/phase7-comments.test.ts (34 tests) 8ms
✓ tests/phase8-workflows.test.ts (34 tests) 9ms
✓ tests/phase4-tickets-service.test.ts (16 tests) 5ms
✓ tests/phase2-scaffold.test.ts (30 tests) 8ms
✓ tests/phase3-auth-rbac.test.ts (37 tests) 10ms

Test Files  7 passed (7)
Tests       199 passed (199)
Duration    575ms
```

**New Phase 8 Tests (34)**:
- Transition Map validation (8 tests)
- transition() function (7 tests)
- autoAssign() function (3 tests)
- assign() function (4 tests)
- Policy Integration (7 tests)
- Workflow Exports (5 tests)

### ✅ Build Successful: 45/45 Routes

```
✓ Compiled successfully
✓ Generating static pages (45/45)
```

## Workflow Validation Examples

### Valid Transitions

| From | To | Allowed? | Notes |
|------|-----|----------|-------|
| NEW | OPEN | ✅ | Standard flow |
| NEW | CLOSED | ✅ | Quick close |
| OPEN | PENDING | ✅ | Awaiting info |
| OPEN | SOLVED | ✅ | Resolved |
| OPEN | CLOSED | ✅ | Direct close |
| SOLVED | CLOSED | ✅ | Final close |
| SOLVED | OPEN | ✅ | Reopened |

### Invalid Transitions

| From | To | Error |
|------|-----|-------|
| CLOSED | OPEN | ❌ "Invalid transition: Cannot move from CLOSED to OPEN" |
| CLOSED | ANY | ❌ Terminal state |
| NEW | PENDING | ❌ Must go through OPEN |
| PENDING | CLOSED | ❌ Must resolve first |

### CLIENT-Specific Rules

| Scenario | Allowed? | Error |
|----------|----------|-------|
| CLIENT closes own ticket (OPEN→CLOSED) | ✅ | - |
| CLIENT transitions own ticket (OPEN→PENDING) | ❌ | "Forbidden: Cannot transition this ticket" |
| CLIENT closes other's ticket | ❌ | "Forbidden: Cannot transition this ticket" |
| CLIENT assigns any ticket | ❌ | "Forbidden: Cannot assign this ticket" |

## Auto-Assignment

**When**: `AUTO_ASSIGN_ENABLED=true` and ticket has no assignee

**Strategy** (Phase 8 stub):
- Returns deterministic mock agent ID: `'auto-assigned-agent-1'`
- Future: Query available agents, round-robin, or requester's last handler

**Example**:
```typescript
// AUTO_ASSIGN_ENABLED=true
const ticket = { id: 'ticket-1', assigneeId: null, ... }
const result = await workflows.autoAssign(user, ticket)
// result.assigneeId === 'auto-assigned-agent-1'
```

## Breaking Changes

**None**. All existing functionality preserved:
- Existing routes unchanged
- Response shapes identical
- DB schema unchanged
- Legacy code continues to work

## Environment Variables

**New (Optional)**:
- `AUTO_ASSIGN_ENABLED=true|false` (default: `false`)

## Files Changed

**Created (3)**:
- `modules/tickets/workflows.ts` - Workflow orchestration
- `app/api/tickets/[id]/status/route.js` - Status transition route
- `app/api/tickets/[id]/assign/route.js` - Assignment route
- `tests/phase8-workflows.test.ts` - Comprehensive tests (34 tests)

**Modified (5)**:
- `modules/tickets/domain.ts` - Added workflow types
- `modules/tickets/policy.ts` - Added canTransition, canAssign
- `modules/tickets/repo.impl.ts` - Added updateStatus, updateAssignee
- `modules/tickets/repo.ts` - Exported new functions
- `lib/config.ts` - Added AUTO_ASSIGN_ENABLED
- `modules/users/rbac.ts` - Added TICKET_UPDATE for Client role

## Risk Assessment

**Risk Level**: Low

**Mitigations**:
- Minimal scope (2 new routes only)
- No changes to existing routes
- Comprehensive test coverage (34 new tests)
- Type safety with TypeScript
- State machine prevents invalid transitions
- Policy layer enforces authorization
- All tests passing (199/199)

## Metrics

| Metric | Value |
|--------|-------|
| Files Created | 3 |
| Files Modified | 5 |
| Lines Added | ~500 |
| Test Cases Added | 34 |
| Test Pass Rate | 100% (199/199) |
| Build Success | ✅ (45/45 routes) |
| Type Errors | 0 |
| New Routes | 2 |
| Breaking Changes | 0 |

---

**Ready for Review** ✅
