# Smoke Tests — MVP Hardening

Quick manual tests to verify the MVP hardening features are working correctly in staging/production.

## Prerequisites

- Application deployed and running
- Test accounts for each role: requester, staff, manager, admin
- Database seeded with role modules
- Feature flags configured per environment

## Test Accounts (Configure These)

```bash
# Set these in your test environment
TEST_REQUESTER_EMAIL=test-requester@example.com
TEST_REQUESTER_PASSWORD=test123

TEST_STAFF_EMAIL=test-staff@example.com
TEST_STAFF_PASSWORD=test123

TEST_MANAGER_EMAIL=test-manager@example.com
TEST_MANAGER_PASSWORD=test123

TEST_ADMIN_EMAIL=test-admin@example.com
TEST_ADMIN_PASSWORD=test123
```

## 1. Authentication Tests (2 minutes)

### Test: Login as Each Role

**Steps:**
1. Navigate to `/login`
2. Login with requester credentials
3. Verify redirect to dashboard/tickets
4. Logout
5. Repeat for staff, manager, admin

**Expected:**
- ✅ All logins succeed
- ✅ Redirect to appropriate page based on role
- ✅ User menu shows correct role

**Failure Indicators:**
- ❌ Login fails or hangs
- ❌ Infinite redirect loop
- ❌ Wrong role displayed

## 2. Admin Module UI Tests (3 minutes)

### Test: Admin Access to Module Management

**Prerequisite:** `NEXT_PUBLIC_FEATURE_ADMIN_MODULES_UI=true` (staging only)

**Steps:**
1. Login as admin
2. Navigate to `/admin/modules`
3. Verify page loads with role selector and module checkboxes

**Expected:**
- ✅ Page loads successfully
- ✅ Role selector shows 4 roles
- ✅ Module checkboxes visible (tickets, reports, presence, kb, uploads)

**Failure Indicators:**
- ❌ 404 or 403 error
- ❌ Page crashes or blank screen
- ❌ Missing UI elements

### Test: Non-Admin Access Denied

**Steps:**
1. Login as staff (non-admin)
2. Navigate to `/admin/modules`
3. Verify access denied

**Expected:**
- ✅ 403 Forbidden or redirect to dashboard
- ✅ No module assignment UI visible

**Failure Indicators:**
- ❌ Page loads for non-admin
- ❌ Crash or error

### Test: Module Toggle Persistence

**Prerequisite:** Admin logged in at `/admin/modules`

**Steps:**
1. Select "Staff" role from dropdown
2. Toggle "Reports" module checkbox
3. Click "Save Role Modules"
4. Wait for success toast
5. Refresh page
6. Select "Staff" role again

**Expected:**
- ✅ Success toast appears
- ✅ After refresh, "Reports" checkbox state matches what you set
- ✅ No errors in browser console

**Failure Indicators:**
- ❌ Changes don't persist after refresh
- ❌ Error toast or API error
- ❌ Database errors in server logs

### Test: User Override Precedence

**Prerequisite:** Admin logged in at `/admin/modules`

**Steps:**
1. Scroll to "User Module Overrides" section
2. Enter a test staff user ID
3. Click "Load User Modules"
4. Toggle different modules than their role default
5. Click "Save User Modules"
6. Verify success toast

**Expected:**
- ✅ User modules load successfully
- ✅ Can save different modules than role default
- ✅ Success confirmation

**Failure Indicators:**
- ❌ User ID not found error (acceptable if user doesn't exist)
- ❌ Cannot save user overrides
- ❌ API errors

## 3. Mutation & Audit Tests (2 minutes)

### Test: Top Mutations Succeed

**Steps:**
1. Login as staff
2. Create a new ticket
3. Update the ticket (add a comment)
4. Verify both operations succeed

**Expected:**
- ✅ Ticket created successfully
- ✅ Ticket updated successfully
- ✅ No errors in UI or console

**Failure Indicators:**
- ❌ Mutations fail
- ❌ 500 errors
- ❌ Data not persisting

### Test: Audit Log Entries Created

**Prerequisite:** Performed mutations above

**Steps:**
1. SSH to database server
2. Run audit log query:
   ```sql
   SELECT
     id,
     actor_email,
     role,
     action,
     entity,
     entity_id,
     created_at
   FROM audit_logs
   ORDER BY created_at DESC
   LIMIT 10;
   ```

**Expected:**
- ✅ Recent audit entries visible
- ✅ Entries match the mutations you performed
- ✅ `actor_email` matches your login
- ✅ `prev_hash` and `hash` fields populated

**Failure Indicators:**
- ❌ No audit entries
- ❌ Missing hash fields
- ❌ Incorrect actor information

## 4. API Access Control Tests (2 minutes)

### Test: Admin APIs Require Auth

**Steps:**
1. Open terminal
2. Test unauthenticated access:
   ```bash
   curl -i https://helpdesk.surterreproperties.com/api/admin/modules
   ```

**Expected:**
- ✅ Returns 401 Unauthorized or 403 Forbidden
- ✅ No data leaked

**Failure Indicators:**
- ❌ Returns 200 with data (SECURITY ISSUE!)
- ❌ Crashes or 500 error

### Test: Admin APIs Work When Authenticated

**Steps:**
1. Login as admin via browser
2. Get auth token from browser dev tools (cookies/localStorage)
3. Test authenticated request:
   ```bash
   curl -i -H "Authorization: Bearer YOUR_TOKEN" \
     https://helpdesk.surterreproperties.com/api/admin/modules
   ```

**Expected:**
- ✅ Returns 200 OK
- ✅ JSON response with module list

**Failure Indicators:**
- ❌ Returns 401/403 even with valid token
- ❌ Empty or malformed response

## 5. E2E Test Execution (5 minutes)

### Test: Run Playwright E2E Tests

**Prerequisite:**
- Test accounts configured
- Application running locally or in test environment

**Steps:**
1. Ensure test environment variables set:
   ```bash
   export BASE_URL=http://localhost:3000
   export TEST_ADMIN_EMAIL=test-admin@example.com
   export TEST_ADMIN_PASSWORD=test123
   # ... other test credentials
   ```

2. Run E2E tests:
   ```bash
   npm run test:e2e
   ```

3. Review test results

**Expected:**
- ✅ All smoke tests pass
- ✅ Login tests pass for all 4 roles
- ✅ Crawler tests complete without crashes
- ✅ No critical failures

**Failure Indicators:**
- ❌ Login tests fail
- ❌ Page crashes during navigation
- ❌ Timeout errors

## 6. Database Integrity Tests (1 minute)

### Test: Role Modules Seeded

**Steps:**
1. SSH to database
2. Check role modules:
   ```sql
   SELECT role, modules FROM role_modules ORDER BY role;
   ```

**Expected:**
- ✅ 4 rows (requester, staff, manager, admin)
- ✅ Each has appropriate modules array
- ✅ Example:
  ```
  role      | modules
  ----------+--------------------------------
  admin     | {tickets,reports,presence,kb,uploads}
  manager   | {tickets,reports,presence,kb}
  requester | {tickets,kb}
  staff     | {tickets,presence,kb}
  ```

**Failure Indicators:**
- ❌ Missing roles
- ❌ Empty modules arrays
- ❌ Table doesn't exist

### Test: Audit Chain Integrity

**Steps:**
1. Check audit log chain:
   ```sql
   SELECT
     id,
     prev_hash IS NOT NULL as has_prev,
     hash IS NOT NULL as has_hash,
     created_at
   FROM audit_logs
   ORDER BY created_at DESC
   LIMIT 5;
   ```

**Expected:**
- ✅ All entries (except first) have `prev_hash`
- ✅ All entries have `hash`
- ✅ Hash chain is continuous

**Failure Indicators:**
- ❌ Missing hashes
- ❌ Broken chain (prev_hash doesn't match previous entry's hash)

## Quick Smoke Test Script

For rapid verification, run all checks in one go:

```bash
#!/bin/bash
# Quick smoke test for MVP hardening

echo "🔍 1. Testing application health..."
curl -f https://helpdesk.surterreproperties.com/login || echo "❌ App not responding"

echo "🔍 2. Testing admin API (should be 401/403)..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://helpdesk.surterreproperties.com/api/admin/modules)
if [ "$STATUS" = "401" ] || [ "$STATUS" = "403" ]; then
  echo "✅ Admin API protected"
else
  echo "❌ Admin API returned $STATUS (expected 401/403)"
fi

echo "🔍 3. Checking database tables..."
psql $DATABASE_URL -c "SELECT COUNT(*) as role_count FROM role_modules;" || echo "❌ role_modules table issue"
psql $DATABASE_URL -c "SELECT COUNT(*) as audit_count FROM audit_logs;" || echo "❌ audit_logs table issue"

echo "🔍 4. Checking recent audit activity..."
psql $DATABASE_URL -c "SELECT COUNT(*) as recent_audits FROM audit_logs WHERE created_at > NOW() - INTERVAL '24 hours';"

echo "✅ Smoke tests complete!"
```

## Test Report Template

After running smoke tests, document results:

```
## Smoke Test Results

**Date:** YYYY-MM-DD
**Environment:** [Staging/Production]
**Tester:** [Name]
**Build:** [Git commit hash]

### Results
- [ ] Authentication: PASS / FAIL
- [ ] Admin UI Access Control: PASS / FAIL / N/A (feature flag off)
- [ ] Module Toggle Persistence: PASS / FAIL / N/A
- [ ] Mutations & Audit: PASS / FAIL
- [ ] API Access Control: PASS / FAIL
- [ ] E2E Tests: PASS / FAIL / N/A (no test accounts)
- [ ] Database Integrity: PASS / FAIL

### Issues Found
1. [Issue description]
2. [Issue description]

### Notes
[Any additional observations]

### Recommendation
[APPROVE FOR PROD / NEEDS FIXES / ROLLBACK]
```

## Troubleshooting

**Issue: Admin UI shows 404**
- Check feature flag: `NEXT_PUBLIC_FEATURE_ADMIN_MODULES_UI=true`
- Restart application after changing flags
- Verify build includes new admin page

**Issue: Audit logs not appearing**
- Check mutations are actually occurring
- Verify `audit_logs` table exists
- Check server logs for database errors
- Ensure audit middleware is applied

**Issue: E2E tests fail immediately**
- Verify test accounts exist in database
- Check BASE_URL is correct
- Ensure application is running
- Review Playwright browser installation

**Issue: Module changes don't persist**
- Check database connection
- Verify `role_modules` table has correct schema
- Check for transaction rollbacks in logs
- Test database write permissions

## Success Criteria

Smoke tests are successful when:
- ✅ All 4 roles can login
- ✅ Admin UI access control working (if enabled)
- ✅ Mutations succeed and generate audit logs
- ✅ API access properly authenticated
- ✅ Database tables populated correctly
- ✅ No critical errors in logs
