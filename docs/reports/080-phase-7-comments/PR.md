# Phase 7: Comments Module — Service/Policy/Repo Wiring

Implements comments module service/policy/repo layers with safe refactor of GET/POST comments routes. Zero breaking changes, preserves all existing response shapes, adds RBAC integration, and includes comprehensive policy enforcement (ADMIN/STAFF see all, CLIENT only public on owned tickets).

**Testing**: 165/165 tests passing (34 new Phase 7 tests)
**Build**: ✅ 45/45 routes compiled
**Risk**: Low (minimal scope, backward compatible)
