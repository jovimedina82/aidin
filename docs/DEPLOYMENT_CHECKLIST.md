# Deployment Checklist — MVP Hardening

This checklist ensures safe deployment of the MVP hardening features (Admin APIs, Module Permissions, Audit Logging, E2E Tests).

## Pre-Deployment

### 1. Code Review
- [ ] All PR comments addressed
- [ ] CI pipeline passing (lint, build, tests)
- [ ] Security review completed
- [ ] No secrets in code or git history

### 2. Database Verification
- [ ] Run database spot-checks: `psql $DATABASE_URL < scripts/db-spotchecks.sql`
- [ ] Verify `role_modules` table exists
- [ ] Verify `user_modules` table exists
- [ ] Verify `audit_logs` table has hash chaining fields
- [ ] Seed role modules: `npx tsx scripts/seed-role-modules.ts`

### 3. Environment Variables
- [ ] Confirm all feature flags are OFF in production `.env`:
  ```bash
  NEXT_PUBLIC_FEATURE_ADMIN_MODULES_UI=false
  NEXT_PUBLIC_FEATURE_ROUTE_GUARDS=false
  NEXT_PUBLIC_FEATURE_OPENAPI_DOCS=false
  ```
- [ ] Database connection string is correct
- [ ] JWT secret is secure and rotated

### 4. Build & Test
- [ ] Run full build locally: `npm run build`
- [ ] Run type check: `npm run type-check`
- [ ] Generate OpenAPI: `npm run openapi:gen`
- [ ] Verify OpenAPI output: `cat docs/openapi.yaml`

## Deployment Steps

### 1. Merge to Main
- [ ] Squash and merge PR to `main`
- [ ] Tag release: `git tag -a v1.0.0-hardening -m "MVP Hardening Release"`
- [ ] Push tags: `git push --tags`

### 2. Deploy to Staging
- [ ] Pull latest main on staging server
- [ ] Install dependencies: `npm ci`
- [ ] Generate Prisma client: `npx prisma generate`
- [ ] Run database migrations: `npx prisma db push` (or manual SQL)
- [ ] Seed role modules: `npx tsx scripts/seed-role-modules.ts`
- [ ] Build application: `npm run build`
- [ ] Restart service: `systemctl restart aidin.service` (or `pm2 restart aidin`)

### 3. Staging Smoke Tests (10 minutes)
Run smoke tests per role (see `docs/SMOKE_TESTS.md`):

- [ ] **Requester:** Login, view tickets, verify no admin access
- [ ] **Staff:** Login, view tickets, verify no admin access
- [ ] **Manager:** Login, view reports, verify no admin access
- [ ] **Admin:** Login, access `/admin/modules` (should see 404/403 - feature flag OFF)
- [ ] Verify top mutations succeed (create ticket, update ticket)
- [ ] Check audit log entries: `psql $DATABASE_URL -c "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 5;"`
- [ ] Run E2E tests: `npm run test:e2e` (if test accounts exist)

### 4. SQL Spot-Checks
- [ ] Run spot-checks: `psql $DATABASE_URL < scripts/db-spotchecks.sql`
- [ ] Verify role_modules has 4 rows (requester, staff, manager, admin)
- [ ] Verify audit_logs has hash chaining working
- [ ] Check for any database errors in logs

### 5. Deploy to Production
- [ ] Pull latest main on production server: `cd /opt/apps/aidin && git pull`
- [ ] Install dependencies: `npm ci`
- [ ] Generate Prisma client: `npx prisma generate`
- [ ] **BACKUP DATABASE:** `pg_dump $DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql`
- [ ] Run database setup: `npx tsx scripts/create-module-tables.ts`
- [ ] Seed role modules: `npx tsx scripts/seed-role-modules.ts`
- [ ] Build application: `npm run build`
- [ ] Restart service: `systemctl restart aidin.service` (or `pm2 restart aidin`)

### 6. Production Smoke Tests (5 minutes)
- [ ] Verify application loads: `curl https://helpdesk.surterreproperties.com`
- [ ] Test admin API (authenticated): `curl https://helpdesk.surterreproperties.com/api/admin/modules`
- [ ] Verify audit logs are being created
- [ ] Check application logs for errors: `journalctl -u aidin.service -n 100` or `pm2 logs aidin`

## Post-Deployment

### 1. Monitoring (First 24 Hours)
Watch for:
- [ ] **HTTP 5xx errors** - Target: <0.5%
- [ ] **P95 API latency** - No regression from baseline
- [ ] **Database errors** - Should be zero
- [ ] **AuditLog inserts/min** - Non-zero on mutations
- [ ] **Memory usage** - Should be stable

See `scripts/canary-metrics.md` for detailed metrics and thresholds.

### 2. Canary Rollout (Optional Features)

**Admin Modules UI (Admin-only):**
- [ ] Enable in staging: `NEXT_PUBLIC_FEATURE_ADMIN_MODULES_UI=true`
- [ ] Test module assignment workflow
- [ ] Verify role and user overrides work
- [ ] Check audit logs capture changes
- [ ] Enable in production for 10% of admins (use feature flag service if available)
- [ ] Monitor for 24 hours
- [ ] Enable for 100% of admins

**Route Guards (API Protection):**
- [ ] Enable in staging: `NEXT_PUBLIC_FEATURE_ROUTE_GUARDS=true`
- [ ] Test all protected routes with different roles
- [ ] Verify 403 responses for unauthorized access
- [ ] Monitor API error rates
- [ ] Enable in production with canary: 10% → 50% → 100%

**OpenAPI Documentation (Optional):**
- [ ] Generate spec: `npm run openapi:gen`
- [ ] Deploy to admin-only route
- [ ] Never expose unauthenticated

### 3. Verification
- [ ] All critical user flows working
- [ ] No new errors in logs
- [ ] Database performance normal
- [ ] Audit logs capturing mutations
- [ ] Module permissions enforced (when enabled)

## Rollback Procedure

If issues arise, rollback immediately:

### 1. Disable Feature Flags
```bash
# Set all flags to false in .env
NEXT_PUBLIC_FEATURE_ADMIN_MODULES_UI=false
NEXT_PUBLIC_FEATURE_ROUTE_GUARDS=false
NEXT_PUBLIC_FEATURE_OPENAPI_DOCS=false

# Restart service
systemctl restart aidin.service  # or pm2 restart aidin
```

### 2. Rollback Code (If Necessary)
```bash
# Revert to previous commit
git revert HEAD
npm ci
npm run build
systemctl restart aidin.service
```

### 3. Rollback Database (Nuclear Option)
```bash
# Only if database changes caused issues
# Restore from backup
psql $DATABASE_URL < backup-YYYYMMDD-HHMMSS.sql

# Drop new tables (if they're causing issues)
psql $DATABASE_URL -c "DROP TABLE IF EXISTS role_modules;"
psql $DATABASE_URL -c "DROP TABLE IF EXISTS user_modules;"
```

### 4. Verify Rollback
- [ ] Application loads normally
- [ ] All critical flows working
- [ ] No errors in logs
- [ ] Monitor for 1 hour

## Emergency Contacts

- **On-Call Engineer:** [Contact info]
- **Database Admin:** [Contact info]
- **DevOps Team:** [Contact info]

## Notes

- All feature flags default to OFF for safety
- Database changes are additive only (no column drops/renames)
- All scripts are idempotent (safe to run multiple times)
- Audit logs provide tamper-evident trail of all changes
- Full rollback possible without data loss

## Success Criteria

Deployment is successful when:
- ✅ Application running normally
- ✅ No increase in error rates
- ✅ No performance degradation
- ✅ Database tables created successfully
- ✅ Audit logs working (when mutations occur)
- ✅ Feature flags can be toggled without issues
