# Phase 4: Tickets Service & Policy Layer

## Summary

Implements clean service/policy/repo architecture for tickets module with two new API endpoints demonstrating the pattern. All Prisma calls isolated in repository layer, authorization logic in policy layer, pure orchestration in service layer. Zero breaking changes to existing functionality.

## Implementation Details

### 1. Policy Layer (`modules/tickets/policy.ts`)

**canCreate(user: PolicyUser): boolean**
- Validates user has TICKET_CREATE permission via Phase 3 RBAC
- Admin ✅, Staff ✅, Client ✅
- Returns false for users without roles

**canView(user: PolicyUser, ticket: TicketDTO): boolean**
- Admin/Staff: can view any ticket (TICKET_READ_ANY)
- Client: can only view own tickets (ticket.requesterId === user.id)
- Delegates to Phase 3 RBAC canOn() for resource ownership

### 2. Repository Layer (`modules/tickets/repo.impl.ts`) - NEW

**create(data: CreateTicketDTO & { requesterId: string }): Promise<TicketDTO>**
- Generates ticket number (format: T-YYYYMMDD-XXXX)
- Creates ticket in database via Prisma
- Returns mapped TicketDTO

**findById(id: string): Promise<TicketDTO | null>**
- Fetches ticket by ID via Prisma
- Returns null if not found
- Maps Prisma model to TicketDTO

### 3. Service Layer (`modules/tickets/service.ts`)

**create(currentUser: PolicyUser, input): Promise<TicketDTO>**
```typescript
// 1. Policy check
if (!policy.canCreate(currentUser)) {
  throw new Error('FORBIDDEN: ...')
}

// 2. Set requesterId based on role
const requesterId = hasStaffRole && input.requesterId
  ? input.requesterId
  : currentUser.id

// 3. Delegate to repository
return await repo.create(data)
```

**get(currentUser: PolicyUser, id: string): Promise<TicketDTO | null>**
```typescript
// 1. Fetch from repository
const ticket = await repo.findById(id)
if (!ticket) return null

// 2. Policy check
if (!policy.canView(currentUser, ticket)) {
  throw new Error('FORBIDDEN: ...')
}

return ticket
```

### 4. API Routes

**POST /api/v1/tickets** (`app/api/v1/tickets/route.ts`)
- Uses Phase 3 `auth.middleware.requireUser()` for authentication
- Validates required fields (title, description)
- Calls `tickets.service.create()` with policy checks
- Returns 201 on success, 400/403/500 on errors

**GET /api/v1/tickets/:id** (`app/api/v1/tickets/[id]/route.ts`)
- Uses Phase 3 `auth.middleware.requireUser()` for authentication
- Calls `tickets.service.get()` with policy checks
- Returns 200 on success, 404/403/500 on errors

## Testing Results

### ✅ All Tests Passing: 83/83

```
✓ tests/phase4-tickets-service.test.ts (16 tests) 3ms
✓ tests/phase2-scaffold.test.ts (30 tests) 6ms
✓ tests/phase3-auth-rbac.test.ts (37 tests) 8ms

Test Files  3 passed (3)
Tests       83 passed (83)
Duration    481ms
```

**New Phase 4 Tests (16)**:
- Policy - canCreate (5 tests)
- Policy - canView (5 tests)
- Service - create (1 test)
- Service - get (1 test)
- Module Exports (4 tests)

### ✅ Build Successful: 47/47 Routes

```
✓ Compiled successfully
✓ Generating static pages (47/47)
```

**New Routes Added**:
- `/api/v1/tickets` - POST endpoint
- `/api/v1/tickets/[id]` - GET endpoint

## Breaking Changes

**None**. Existing `/api/tickets` routes unchanged.

## Error Responses

**403 Forbidden** (User lacks permission):
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Access denied. You do not have permission to create tickets."
  }
}
```

**404 Not Found** (Ticket doesn't exist):
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Ticket not found"
  }
}
```

## Files Changed

**Created (4)**:
- `modules/tickets/repo.impl.ts` - Repository implementation
- `app/api/v1/tickets/route.ts` - POST endpoint
- `app/api/v1/tickets/[id]/route.ts` - GET endpoint
- `tests/phase4-tickets-service.test.ts` - Test suite

**Modified (3)**:
- `modules/tickets/policy.ts` - Real policy implementations
- `modules/tickets/service.ts` - Real service implementations
- `tests/phase2-scaffold.test.ts` - Updated legacy test

## Risk Assessment

**Risk Level**: Low

**Mitigations**:
- No breaking changes (existing routes untouched)
- Comprehensive test coverage (16 new tests)
- Type safety with TypeScript
- Policy checks enforced at service layer
- All Prisma calls isolated in repository

## Metrics

- **Files Created**: 4
- **Files Modified**: 3
- **Lines Added**: ~500
- **Test Cases**: 16 new
- **Test Pass Rate**: 100% (83/83)
- **Build Success**: ✅ (47/47 routes)
- **Type Errors**: 0

---

**Ready for Review** ✅
