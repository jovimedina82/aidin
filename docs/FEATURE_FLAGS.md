# Feature Flags — MVP Hardening

This document describes all feature flags for the MVP hardening initiative, their purpose, defaults, and safe enablement procedures.

## Overview

All hardening features are controlled by environment variables (feature flags) for safe, gradual rollout. **All flags default to OFF in production** for maximum safety.

## Flag Reference

### `NEXT_PUBLIC_FEATURE_ADMIN_MODULES_UI`

**Purpose:** Controls visibility of the admin module assignment interface at `/admin/modules`.

**Default:** `false`

**Affects:**
- Admin UI page visibility
- Module assignment controls
- Role and user override management

**Safe to Enable When:**
- ✅ Database tables `role_modules` and `user_modules` exist
- ✅ Role modules seeded with defaults
- ✅ Admin accounts ready to manage permissions
- ✅ Audit logging is working

**How to Enable:**

```bash
# In .env or .env.local
NEXT_PUBLIC_FEATURE_ADMIN_MODULES_UI=true
```

**Recommended Rollout:**
1. Enable in local development first
2. Test in staging environment
3. Enable for 1-2 admin users in production
4. Monitor for 24 hours
5. Enable for all admins

**Rollback:**
```bash
# Set to false and restart
NEXT_PUBLIC_FEATURE_ADMIN_MODULES_UI=false
systemctl restart aidin.service  # or pm2 restart
```

**Production Notes:**
- Only affects admins (non-admins can't access `/admin/*` anyway)
- Low risk - UI only, doesn't enforce permissions yet
- Can be toggled instantly without code deploy

---

### `NEXT_PUBLIC_FEATURE_ROUTE_GUARDS`

**Purpose:** Enables authorization guards on API routes to enforce role and module permissions.

**Default:** `false`

**Affects:**
- API route access control
- Permission checks on mutations
- 403 Forbidden responses for unauthorized access

**Protected Routes (when enabled):**
- `/api/tickets/*` - Requires `tickets` module
- `/api/reports/*` - Requires `reports` module
- `/api/presence/*` - Requires `presence` module
- `/api/kb/*` - Requires `kb` module
- `/api/uploads/*` - Requires `uploads` module
- `/api/admin/*` - Requires `admin` role

**Safe to Enable When:**
- ✅ `NEXT_PUBLIC_FEATURE_ADMIN_MODULES_UI` has been tested
- ✅ All users have appropriate module assignments
- ✅ Role modules seeded and verified
- ✅ Smoke tests passing in staging

**How to Enable:**

```bash
# In .env or .env.local
NEXT_PUBLIC_FEATURE_ROUTE_GUARDS=true
```

**Recommended Rollout:**
1. Test extensively in staging with all 4 roles
2. Verify no critical workflows break
3. Enable in production during low-traffic window
4. Monitor 5xx error rates closely
5. Have rollback plan ready

**Rollback:**
```bash
# Set to false and restart immediately
NEXT_PUBLIC_FEATURE_ROUTE_GUARDS=false
systemctl restart aidin.service
```

**Production Notes:**
- **HIGH RISK** - Can block user access if permissions misconfigured
- Enable during business hours with team on standby
- Monitor error rates continuously for first hour
- Have database backup before enabling

**Emergency Bypass:**
If permissions misconfigured, admins always bypass guards. Promote a user to admin:
```sql
UPDATE users SET role = 'admin' WHERE email = 'user@example.com';
```

---

### `NEXT_PUBLIC_FEATURE_OPENAPI_DOCS`

**Purpose:** Enables public access to OpenAPI documentation endpoint.

**Default:** `false`

**Affects:**
- `/api/docs` endpoint visibility
- OpenAPI spec public accessibility

**Safe to Enable When:**
- ✅ OpenAPI spec generated and validated
- ✅ No sensitive information in spec
- ✅ Rate limiting configured

**How to Enable:**

```bash
# In .env or .env.local
NEXT_PUBLIC_FEATURE_OPENAPI_DOCS=true
```

**Recommended Rollout:**
1. Review OpenAPI spec for sensitive data
2. Configure rate limiting on docs endpoint
3. Enable in staging
4. Enable in production if public API desired

**Rollback:**
```bash
NEXT_PUBLIC_FEATURE_OPENAPI_DOCS=false
systemctl restart aidin.service
```

**Production Notes:**
- Low risk if spec contains no secrets
- Consider admin-only access instead of public
- Can enable permanently if API is public

---

### `NEXT_PUBLIC_FEATURE_AUDIT_ENFORCEMENT`

**Purpose:** Makes audit logging mandatory (fails requests if audit write fails).

**Default:** `false` (audit logging is best-effort)

**Affects:**
- Mutation failure behavior
- Transaction rollback on audit failure
- Data consistency guarantees

**Safe to Enable When:**
- ✅ Audit logging working reliably for 7+ days
- ✅ Database has sufficient capacity
- ✅ No audit write failures in logs

**How to Enable:**

```bash
# In .env or .env.local
NEXT_PUBLIC_FEATURE_AUDIT_ENFORCEMENT=true
```

**Recommended Rollout:**
1. Monitor audit write success rate (should be 99.9%+)
2. Enable in staging for 1 week
3. Enable in production gradually

**Rollback:**
```bash
NEXT_PUBLIC_FEATURE_AUDIT_ENFORCEMENT=false
systemctl restart aidin.service
```

**Production Notes:**
- **MEDIUM RISK** - Can cause mutations to fail
- Only enable when audit system is rock-solid
- Monitor database performance closely

---

## Multi-Flag Configurations

### Development (All Features)

```bash
# .env.local (local development)
NODE_ENV=development
NEXT_PUBLIC_FEATURE_ADMIN_MODULES_UI=true
NEXT_PUBLIC_FEATURE_ROUTE_GUARDS=false  # Optional: test guards
NEXT_PUBLIC_FEATURE_OPENAPI_DOCS=true
NEXT_PUBLIC_FEATURE_AUDIT_ENFORCEMENT=false
```

### Staging (Testing)

```bash
# .env.staging
NODE_ENV=production
NEXT_PUBLIC_FEATURE_ADMIN_MODULES_UI=true
NEXT_PUBLIC_FEATURE_ROUTE_GUARDS=true  # Test guards here
NEXT_PUBLIC_FEATURE_OPENAPI_DOCS=true
NEXT_PUBLIC_FEATURE_AUDIT_ENFORCEMENT=false
```

### Production (Safe Defaults)

```bash
# .env.production
NODE_ENV=production
NEXT_PUBLIC_FEATURE_ADMIN_MODULES_UI=false  # Enable after testing
NEXT_PUBLIC_FEATURE_ROUTE_GUARDS=false      # Enable after admin UI tested
NEXT_PUBLIC_FEATURE_OPENAPI_DOCS=false      # Optional
NEXT_PUBLIC_FEATURE_AUDIT_ENFORCEMENT=false # Enable last
```

### Production (Fully Enabled)

```bash
# .env.production (after successful rollout)
NODE_ENV=production
NEXT_PUBLIC_FEATURE_ADMIN_MODULES_UI=true
NEXT_PUBLIC_FEATURE_ROUTE_GUARDS=true
NEXT_PUBLIC_FEATURE_OPENAPI_DOCS=false      # Keep false if internal API
NEXT_PUBLIC_FEATURE_AUDIT_ENFORCEMENT=true  # After 7 days of reliable auditing
```

## Verification Commands

### Check Current Flag Values

```bash
# View current environment variables
cat .env | grep NEXT_PUBLIC_FEATURE

# Or check running process
ps aux | grep node | head -1
# Look for NEXT_PUBLIC_FEATURE_ variables in environment
```

### Test Flag Changes Without Restart

```bash
# For Next.js, NEXT_PUBLIC_ vars are embedded at build time
# Must rebuild to change them:
npm run build
systemctl restart aidin.service
```

### Verify Flags in Browser

```javascript
// Open browser console on the app
console.log({
  adminModulesUI: process.env.NEXT_PUBLIC_FEATURE_ADMIN_MODULES_UI,
  routeGuards: process.env.NEXT_PUBLIC_FEATURE_ROUTE_GUARDS,
  openApiDocs: process.env.NEXT_PUBLIC_FEATURE_OPENAPI_DOCS,
  auditEnforcement: process.env.NEXT_PUBLIC_FEATURE_AUDIT_ENFORCEMENT,
});
```

## Monitoring After Flag Changes

After enabling any flag, monitor:

**Metrics to Watch:**
- **HTTP 5xx errors** - Should stay <0.5%
- **HTTP 4xx errors** - May increase slightly (expected with guards)
- **P95 API latency** - Should not regress >10%
- **Database errors** - Should remain zero
- **Audit log inserts/min** - Should match mutation rate

**Logs to Check:**
```bash
# Application logs
journalctl -u aidin.service -f -n 100
# or
pm2 logs aidin --lines 100

# Database logs
tail -f /var/log/postgresql/postgresql-*.log
```

**Dashboard Checks:**
- Error rate dashboard
- Latency percentiles
- Active users (shouldn't drop)
- Request rate (shouldn't drop dramatically)

## Troubleshooting

### Issue: Flag change not taking effect

**Cause:** Next.js embeds NEXT_PUBLIC_ vars at build time

**Solution:**
```bash
npm run build
systemctl restart aidin.service
```

### Issue: Users can't access features after enabling guards

**Cause:** Missing module assignments

**Solution:**
1. Check user's modules:
   ```sql
   SELECT * FROM user_modules WHERE user_id = 'USER_ID';
   SELECT * FROM role_modules WHERE role = 'USER_ROLE';
   ```

2. Assign missing modules via admin UI or SQL:
   ```sql
   INSERT INTO user_modules (user_id, modules)
   VALUES ('USER_ID', ARRAY['tickets', 'reports'])
   ON CONFLICT (user_id)
   DO UPDATE SET modules = EXCLUDED.modules;
   ```

### Issue: 5xx errors spike after enabling flag

**Action:** Rollback immediately

```bash
# 1. Disable flag
NEXT_PUBLIC_FEATURE_[FLAG_NAME]=false

# 2. Rebuild and restart
npm run build
systemctl restart aidin.service

# 3. Check logs for root cause
journalctl -u aidin.service -n 500

# 4. File incident report
```

## Safe Guards

All feature flags have built-in safe guards:

1. **Default OFF:** No features enabled by accident
2. **Admin Bypass:** Admins always bypass guards (emergency access)
3. **Best-Effort Audit:** Audit failures don't block mutations (unless enforcement enabled)
4. **Graceful Degradation:** Missing flags treated as `false`

## Recommendations

**Enablement Order:**
1. `ADMIN_MODULES_UI` first (admin-only, low risk)
2. Test and verify for 24 hours
3. `ROUTE_GUARDS` second (higher risk, needs testing)
4. Monitor for 7 days
5. `AUDIT_ENFORCEMENT` last (only if needed)

**Never Enable:**
- Multiple flags at once (can't isolate issues)
- During high-traffic periods (weekends, month-end)
- Without rollback plan ready
- In production before staging validation

**Always Do:**
- Test in local dev first
- Validate in staging for 24+ hours
- Have team on standby during production enable
- Monitor metrics for 1 hour after change
- Document any issues or learnings
