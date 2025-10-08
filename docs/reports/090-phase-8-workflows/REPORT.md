---
report_version: 1
phase: phase-8-workflows
branch: refactor/phase-8-workflows
pr: <placeholder>
status: success
impacts: ["api","tickets","workflows","authz"]
risk_level: low
---

# Phase 8: Tickets Workflows — Status Transitions + Auto-Assign

## Executive Summary

Phase 8 implements workflow layer for ticket status transitions and optional auto-assignment. Adds state machine validation with allowed transitions map, policy enforcement (ADMIN/STAFF can transition any ticket; CLIENT can only close own tickets), and RBAC integration. Includes 2 new routes with comprehensive testing and zero breaking changes.

**Key Achievements**:
- ✅ Workflow layer implemented (transition, autoAssign, assign)
- ✅ State machine with transition validation
- ✅ Policy enforcement (CLIENT self-close only)
- ✅ 2 new routes (PATCH status, PATCH assign)
- ✅ 34 comprehensive tests (199/199 total passing)
- ✅ Zero breaking changes
- ✅ Build successful (45/45 routes)

## Objectives

### Primary Goal
Introduce workflow layer to centralize ticket status transitions and optional auto-assignment with minimal refactoring.

### Specific Requirements
1. **Scope**: Only 2 new routes (PATCH status, PATCH assign)
2. **State Machine**: Define allowed transitions, prevent invalid jumps
3. **Policy Rules**:
   - ADMIN/STAFF: can transition any ticket to any allowed state
   - CLIENT: can ONLY close own tickets (CLOSED status)
   - ADMIN/STAFF: can assign any ticket
   - CLIENT: cannot assign
4. **resolvedAt Management**: Set on SOLVED, clear when reopened
5. **Auto-Assignment**: Optional feature flag (AUTO_ASSIGN_ENABLED)
6. **Testing**: Unit + integration tests with mocked providers
7. **Documentation**: 4 artifacts (REPORT, PR, PR_DESCRIPTION, terminal-output)

## Technical Implementation

### 1. Workflow Layer (`modules/tickets/workflows.ts`) - NEW

**Allowed Transitions Map**:
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

**Key Features**:
- Pure orchestration layer (no Prisma)
- Policy checks before transitions
- State machine validation
- resolvedAt timestamp management
- Auto-assignment stub strategy

**Core Function**:
```typescript
export async function transition(
  currentUser: PolicyUser,
  ticket: TicketDTO,
  nextStatus: Status
): Promise<TicketDTO> {
  // 1. Check policy permission
  if (!policy.canTransition(currentUser, ticket, nextStatus)) {
    throw new Error('Forbidden: Cannot transition this ticket')
  }

  // 2. Validate state machine allows transition
  if (!isValidTransition(ticket.status, nextStatus)) {
    throw new Error(
      `Invalid transition: Cannot move from ${ticket.status} to ${nextStatus}`
    )
  }

  // 3. Handle resolvedAt
  const opts: { resolvedAt?: Date | null } = {}
  if (nextStatus === Status.SOLVED && ticket.status !== Status.SOLVED) {
    opts.resolvedAt = new Date()
  }
  if (ticket.status === Status.SOLVED && nextStatus !== Status.SOLVED) {
    opts.resolvedAt = null
  }

  // 4. Update via repository
  return repo.updateStatus(ticket.id, nextStatus, opts)
}
```

### 2. Policy Extensions (`modules/tickets/policy.ts`)

**New Authorization Guards**:
```typescript
export function canTransition(
  user: PolicyUser,
  ticket: TicketDTO,
  nextStatus: any
): boolean {
  if (!users.rbac.can(userDTO, users.rbac.Action.TICKET_UPDATE)) {
    return false
  }

  const hasStaffRole = user.roles.some((r) =>
    ['Admin', 'Staff', 'Manager'].includes(r)
  )

  if (hasStaffRole) {
    return true
  }

  // CLIENT can only close own tickets
  const isOwner = ticket.requesterId === user.id
  const isClosing = nextStatus === 'CLOSED'
  return isOwner && isClosing
}

export function canAssign(
  user: PolicyUser,
  ticket: TicketDTO,
  assigneeId: string | null
): boolean {
  if (!users.rbac.can(userDTO, users.rbac.Action.TICKET_ASSIGN)) {
    return false
  }

  // Only ADMIN/STAFF can assign
  const hasStaffRole = user.roles.some((r) =>
    ['Admin', 'Staff', 'Manager'].includes(r)
  )
  return hasStaffRole
}
```

### 3. Repository Extensions (`modules/tickets/repo.impl.ts`)

**New Data Access Methods**:
```typescript
export async function updateStatus(
  id: string,
  status: Status,
  opts?: { resolvedAt?: Date | null }
): Promise<TicketDTO> {
  const updateData: any = {
    status,
    updatedAt: new Date(),
  }

  if (opts && 'resolvedAt' in opts) {
    updateData.resolvedAt = opts.resolvedAt
  }

  const ticket = await prisma.ticket.update({
    where: { id },
    data: updateData,
  })

  return mapPrismaTicketToDTO(ticket)
}

export async function updateAssignee(
  id: string,
  assigneeId: string | null
): Promise<TicketDTO> {
  const ticket = await prisma.ticket.update({
    where: { id },
    data: {
      assigneeId,
      updatedAt: new Date(),
    },
  })

  return mapPrismaTicketToDTO(ticket)
}
```

### 4. Configuration (`lib/config.ts`)

**New Feature Flag**:
```typescript
AUTO_ASSIGN_ENABLED: process.env.AUTO_ASSIGN_ENABLED === 'true',
```

**Default**: `false` (disabled)

### 5. New Routes

#### PATCH /api/tickets/:id/status

**Purpose**: Transition ticket status with workflow validation

**Authentication**: Required (getCurrentUser)

**Request Body**:
```json
{
  "status": "PENDING" | "OPEN" | "SOLVED" | "CLOSED" | ...
}
```

**Responses**:
- 200: Transition successful, returns updated ticket
- 400: Invalid transition (state machine violation)
- 401: Not authenticated
- 403: Forbidden (policy violation)
- 404: Ticket not found

#### PATCH /api/tickets/:id/assign

**Purpose**: Assign or unassign ticket

**Authentication**: Required

**Request Body**:
```json
{
  "assigneeId": "agent-1" | null
}
```

**Responses**:
- 200: Assignment successful
- 401: Not authenticated
- 403: Forbidden (CLIENT cannot assign)
- 404: Ticket not found

### 6. RBAC Updates (`modules/users/rbac.ts`)

**Client Permission Addition**:
- Added `Action.TICKET_UPDATE` to Client role
- Allows clients to close own tickets (policy layer enforces CLOSED-only rule)

## Testing Strategy

### Test Coverage

**Total**: 199 tests (34 new Phase 8 tests)
- Transition Map: 8 tests
- transition() function: 7 tests
- autoAssign() function: 3 tests
- assign() function: 4 tests
- Policy Integration: 7 tests
- Workflow Exports: 5 tests

### Test Scenarios

**Transition Map Validation**:
- ✅ Valid transitions allowed (NEW→OPEN, OPEN→PENDING, SOLVED→CLOSED)
- ✅ Invalid transitions blocked (CLOSED→OPEN, NEW→PENDING)

**Policy Enforcement**:
- ✅ ADMIN/STAFF can transition any ticket
- ✅ CLIENT can only close own tickets
- ✅ CLIENT cannot transition to non-CLOSED states
- ✅ CLIENT cannot close tickets they don't own
- ✅ ADMIN/STAFF can assign tickets
- ✅ CLIENT cannot assign tickets

**resolvedAt Management**:
- ✅ Set resolvedAt when moving TO SOLVED
- ✅ Clear resolvedAt when moving OFF SOLVED
- ✅ No change for other transitions

**Auto-Assignment**:
- ✅ Returns ticket unchanged when feature disabled
- ✅ Returns ticket unchanged when already assigned
- ✅ Assigns to mock agent when enabled and no assignee

## Workflow State Machine

### Allowed Transitions

```
NEW
├─→ OPEN
└─→ CLOSED ■

OPEN
├─→ PENDING
├─→ ON_HOLD
├─→ SOLVED
└─→ CLOSED ■

PENDING
├─→ OPEN
└─→ SOLVED

ON_HOLD
├─→ OPEN
└─→ SOLVED

SOLVED
├─→ CLOSED ■
└─→ OPEN

CLOSED ■ (Terminal - no transitions)
```

### Validation Examples

**Valid**:
- NEW → OPEN → PENDING → SOLVED → CLOSED ✅
- NEW → OPEN → SOLVED → CLOSED ✅
- NEW → CLOSED ✅
- SOLVED → OPEN (reopened) ✅

**Invalid**:
- CLOSED → OPEN ❌
- NEW → PENDING ❌
- PENDING → CLOSED ❌

## Security Considerations

### Authorization Improvements

1. **State Machine Validation**: Prevents invalid status transitions
2. **Policy Enforcement**: Centralized authorization in policy layer
3. **CLIENT Restrictions**: Can only close own tickets, cannot assign
4. **RBAC Integration**: Leverages Phase 3 RBAC for permission checks

## Backward Compatibility

### Preserved Interfaces

1. **Response Shapes**: New routes return standard TicketDTO
2. **Existing Routes**: No changes to existing ticket routes
3. **DB Schema**: No migrations required
4. **Legacy Code**: Continues to work unchanged

## Performance Impact

### Minimal Overhead

- **Transition**: +2 function calls (policy + state machine check)
- **Assignment**: +1 policy check
- **DB Queries**: Same as before (1 UPDATE per operation)

**Total**: Negligible overhead for improved validation and security

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

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Invalid transitions | Medium | State machine validation + 8 tests |
| Unauthorized transitions | High | Policy layer + 7 policy tests |
| CLIENT privilege escalation | Medium | Strict policy (CLOSED-only for own tickets) |
| Missing routes | Low | Only 2 new routes, both implemented and tested |

## Future Work

### Not In Scope (Phase 8)

1. **Advanced Auto-Assignment**: Round-robin, load balancing
2. **Transition Webhooks**: Notify on status changes
3. **Transition History**: Audit trail of status changes
4. **Bulk Transitions**: Update multiple tickets at once

### Recommended Next Steps

1. **Phase 9**: Implement advanced auto-assignment strategies
2. **Phase 10**: Add transition history/audit trail
3. **Phase 11**: Webhook notifications for status changes

## Conclusion

Phase 8 successfully implements workflow layer for ticket status transitions and auto-assignment. Adds robust state machine validation, policy enforcement, and maintains 100% backward compatibility. All tests pass (199/199), build succeeds, zero breaking changes.

**Key Wins**:
- ✅ State machine prevents invalid transitions
- ✅ Policy layer enforces CLIENT self-close only
- ✅ Comprehensive test coverage (34 new tests)
- ✅ Zero breaking changes
- ✅ Type-safe implementation

**Ready for PR and merge**.
