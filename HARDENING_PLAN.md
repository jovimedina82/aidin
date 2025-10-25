# AidIN Hardening & Performance Plan

## Current Status
- ✅ Feature branch created: feat/hardening-perf-2025-10
- ✅ Strict TypeScript enabled
- ✅ Dev tooling installed (Playwright, Vitest, knip, etc.)
- 🔄 Package.json scripts - IN PROGRESS

## Phase 1: Foundation (Current)
1. Add test scripts to package.json
2. Configure Playwright
3. Configure Vitest  
4. Set up ESLint security plugins

## Phase 2: Security Audit
1. Review existing auth implementation in /lib
2. Review existing access control
3. Review existing audit logging
4. Document gaps

## Phase 3: Core Security Implementation
1. Create centralized authorization guards (/lib/guards.ts)
2. Add Zod schemas to all API routes
3. Implement security headers middleware
4. Add rate limiting

## Phase 4: Database & Performance
1. Add database indexes
2. Eliminate N+1 queries
3. Implement code splitting
4. Add virtualization for large lists

## Phase 5: Admin Features
1. Build module assignment UI
2. Create role management interface
3. Implement user overrides

## Phase 6: Testing
1. Create Playwright fixtures for 4 roles
2. Build "test every button" crawler
3. Run dead code detection
4. Fix discovered issues

## Phase 7: Documentation & SDK
1. Generate OpenAPI spec
2. Create TypeScript SDK
3. Write PERMISSIONS.md
4. Write API_REFERENCE.md

## Phase 8: Final Polish
1. Run full test suite
2. Create PR with CHANGELOG
3. Review and merge
