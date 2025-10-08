# Phase 4: Tickets Service & Policy Layer

This PR extracts ticket creation and retrieval logic into a clean service/policy/repo architecture. Implements two new API endpoints (POST /api/v1/tickets and GET /api/v1/tickets/:id) that demonstrate the pattern for future migrations. All Prisma calls isolated in repo.impl.ts, authorization logic in policy.ts, orchestration in service.ts.

**Status**: 83/83 tests passing, 47/47 routes building, zero breaking changes.
