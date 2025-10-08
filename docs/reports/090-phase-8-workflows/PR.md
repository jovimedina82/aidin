# Phase 8: Tickets Workflows (Status Transitions + Auto-Assign)

Implements workflow layer for ticket status transitions and optional auto-assignment. Adds state machine validation, policy enforcement, and RBAC integration. Zero breaking changes, preserves all existing response shapes.

**New Routes**:
- PATCH /api/tickets/:id/status - Transition ticket status with validation
- PATCH /api/tickets/:id/assign - Assign/unassign tickets with policy checks

**Features**:
- State machine with allowed transitions (NEW→OPEN, OPEN→PENDING/SOLVED/CLOSED, etc.)
- Auto-assignment when AUTO_ASSIGN_ENABLED=true
- resolvedAt timestamp management (set on SOLVED, clear when reopened)
- ADMIN/STAFF can transition any ticket; CLIENT can only close own tickets

**Testing**: 199/199 tests passing (34 new Phase 8 tests)
**Build**: ✅ 45/45 routes compiled
**Risk**: Low (minimal scope, new routes only)
