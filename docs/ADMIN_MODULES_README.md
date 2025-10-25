# Admin Modules — User Guide

This guide explains how to use the Admin Module Assignment interface to manage user permissions in AidIN.

## Overview

The Admin Modules feature allows administrators to control which features (modules) different users can access. Permissions are assigned at two levels:
1. **Role-level defaults** - Applies to all users with a given role
2. **User-specific overrides** - Custom permissions for individual users

## Access

**Who can access:** Admin users only

**URL:** `/admin/modules`

**Feature Flag:** `NEXT_PUBLIC_FEATURE_ADMIN_MODULES_UI` (must be `true`)

## Available Modules

| Module | Description |
|--------|-------------|
| **tickets** | Create, view, update, and manage support tickets |
| **reports** | Access analytics and reporting dashboards |
| **presence** | Manage staff presence and scheduling |
| **kb** | Access and contribute to knowledge base |
| **uploads** | Upload and manage file attachments |

## Permission Precedence

Permissions are resolved in this order:

1. **User-specific override** (highest priority)
2. **Role default** (if no user override)
3. **Deny access** (if neither exists)

### Example

If Sarah is a "staff" user:
- Role default for staff: `[tickets, kb, presence]`
- User override for Sarah: `[tickets, kb, reports]`
- **Sarah's actual modules:** `[tickets, kb, reports]` ← User override wins

## Managing Role Defaults

Role defaults apply to ALL users with that role (unless they have a user override).

### Steps

1. Navigate to `/admin/modules`
2. Select a role from the dropdown (requester, staff, manager, or admin)
3. Check/uncheck modules to assign
4. Click **"Save Role Modules"**
5. Confirm success toast

### Default Assignments

Out-of-the-box defaults:

- **Requester:** tickets, kb
- **Staff:** tickets, kb, presence
- **Manager:** tickets, kb, presence, reports
- **Admin:** All modules (tickets, kb, presence, reports, uploads)

**Note:** Admins bypass all permission checks regardless of module assignments.

### When to Modify Role Defaults

- Adding a new module that should be available to a role
- Restricting access to a sensitive module (e.g., reports)
- Adjusting permissions after organizational changes

### Best Practices

- ✅ Use role defaults for broad permissions
- ✅ Keep role defaults minimal (principle of least privilege)
- ✅ Document changes in a changelog
- ❌ Don't give all roles all modules
- ❌ Don't change role defaults frequently (use user overrides instead)

## Managing User Overrides

User overrides allow custom permissions for specific users that differ from their role's defaults.

### Steps

1. Navigate to `/admin/modules`
2. Scroll to **"User Module Overrides"** section
3. Enter the user's ID in the text input
4. Click **"Load User Modules"**
5. Check/uncheck modules for this specific user
6. Click **"Save User Modules"**
7. Confirm success toast

### When to Use User Overrides

- Granting temporary elevated access (e.g., staff covering for manager)
- Restricting a user without changing their role
- Pilot testing a new module with select users
- Accommodating unique job responsibilities

### Examples

**Scenario 1: Temporary Manager Coverage**
- User: John (staff)
- Need: Access reports while manager is on vacation
- Solution: Add user override with `[tickets, kb, presence, reports]`

**Scenario 2: Restricted Access**
- User: Jane (manager)
- Need: Remove uploads access due to policy violation
- Solution: Add user override with `[tickets, kb, presence, reports]` (excluding uploads)

**Scenario 3: Pilot Testing**
- Users: Alice, Bob, Carol (staff)
- Need: Test new reporting feature before full rollout
- Solution: Add user overrides with `[tickets, kb, presence, reports]` for these 3 users

### Best Practices

- ✅ Document WHY you're adding an override (add comment in notes doc)
- ✅ Review overrides periodically (monthly audit)
- ✅ Remove overrides when no longer needed (e.g., after vacation)
- ✅ Use overrides sparingly (indicates need for role restructure if too many)
- ❌ Don't use overrides as primary permission method
- ❌ Don't forget to remove temporary overrides

## Verifying Changes

After making changes, verify they took effect:

### Method 1: Check Database

```sql
-- View role defaults
SELECT * FROM role_modules ORDER BY role;

-- View user override
SELECT * FROM user_modules WHERE user_id = 'USER_ID_HERE';
```

### Method 2: Test User Login

1. Login as the affected user (or ask them to test)
2. Navigate to module pages (e.g., `/reports`)
3. Verify access granted/denied as expected

### Method 3: Review Audit Logs

All permission changes are logged:

```sql
SELECT *
FROM audit_logs
WHERE entity = 'role_modules' OR entity = 'user_modules'
ORDER BY created_at DESC
LIMIT 10;
```

## Troubleshooting

### Issue: Changes don't take effect

**Possible Causes:**
1. Browser cache - Hard refresh (Ctrl+Shift+R)
2. User hasn't logged out/in - Permissions may cache in session
3. Feature guards not enabled - Check `NEXT_PUBLIC_FEATURE_ROUTE_GUARDS`

**Solution:**
```bash
# Have user logout and login again
# Or clear session cookies
```

### Issue: User still can't access module

**Check:**
1. User override exists? Check database
2. Role default includes module? Check database
3. Guards enabled? Check environment variable
4. User's actual role? Verify in users table

**Debug SQL:**
```sql
-- Get user's role
SELECT id, email, role FROM users WHERE email = 'user@example.com';

-- Get user's modules (from override or role)
SELECT modules FROM user_modules WHERE user_id = 'USER_ID'
UNION
SELECT modules FROM role_modules WHERE role = 'USER_ROLE';
```

### Issue: Admin can't access `/admin/modules`

**Check:**
1. User is actually admin? `SELECT role FROM users WHERE id = 'USER_ID';`
2. Feature flag enabled? `echo $NEXT_PUBLIC_FEATURE_ADMIN_MODULES_UI`
3. Application restarted after flag change?

**Solution:**
```bash
# Verify flag in .env
grep ADMIN_MODULES_UI .env

# Rebuild and restart
npm run build
systemctl restart aidin.service
```

### Issue: Error when saving

**Check:**
1. Browser console for JavaScript errors
2. Server logs for API errors
3. Database connection

**Debug:**
```bash
# Check server logs
journalctl -u aidin.service -n 100

# Test API directly
curl -X PUT https://your-domain.com/api/admin/role-modules \
  -H "Content-Type: application/json" \
  -d '{"role":"staff","modules":["tickets","kb"]}'
```

## Audit Trail

All changes to role and user modules are automatically logged with:
- Who made the change (actor_email)
- When it was made (created_at)
- What changed (before/after snapshots)
- Tamper-evident hash chain for integrity

### View Recent Changes

```sql
SELECT
  actor_email,
  action,
  entity,
  before,
  after,
  created_at
FROM audit_logs
WHERE entity IN ('role_modules', 'user_modules')
ORDER BY created_at DESC
LIMIT 20;
```

## Security Considerations

### Admin Bypass

**Important:** Admins ALWAYS bypass all module checks, regardless of their module assignments. This is by design for emergency access.

### Principle of Least Privilege

- Only grant modules users actually need
- Start with role defaults
- Use user overrides sparingly
- Review permissions quarterly

### Separation of Duties

Consider creating roles with limited module access to prevent conflicts of interest:
- Ticket handlers shouldn't necessarily have reporting access
- Upload management should be limited to trusted users

## Safe Usage Tips

1. **Test in staging first** - Try permission changes in non-production before applying to production

2. **Make small changes** - Change one role or user at a time, verify, then proceed

3. **Document changes** - Keep a changelog of who changed what and why

4. **Communicate changes** - Tell affected users before/after permission changes

5. **Monitor audit logs** - Review weekly for unexpected changes

6. **Have rollback plan** - Know how to quickly restore previous permissions

7. **Backup before bulk changes** - Export role_modules and user_modules tables:
   ```sql
   COPY role_modules TO '/tmp/role_modules_backup.csv' CSV HEADER;
   COPY user_modules TO '/tmp/user_modules_backup.csv' CSV HEADER;
   ```

## API Reference

For programmatic access, see `docs/API_REFERENCE.md`.

### Quick Reference

**Get modules list:**
```
GET /api/admin/modules
```

**Get role defaults:**
```
GET /api/admin/role-modules
```

**Update role defaults:**
```
PUT /api/admin/role-modules
Body: {"role": "staff", "modules": ["tickets", "kb"]}
```

**Get user override:**
```
GET /api/admin/user-modules?userId=USER_ID
```

**Update user override:**
```
PUT /api/admin/user-modules
Body: {"userId": "USER_ID", "modules": ["tickets", "kb", "reports"]}
```

## FAQ

**Q: Can users see their own module assignments?**
A: Not in the UI currently. They can only discover by attempting to access modules.

**Q: What happens if I remove a module a user is actively using?**
A: They'll lose access immediately on next request. Active sessions may continue until session refresh.

**Q: Can I assign modules to individual users without overriding all their role defaults?**
A: No, user overrides REPLACE role defaults entirely. Include all desired modules in the override.

**Q: How do I reset a user back to their role's defaults?**
A: Delete their user override row from `user_modules` table, or set modules to empty array `[]`.

**Q: Can non-admins view or modify permissions?**
A: No, only admins can access `/admin/modules` and the related APIs.

**Q: Is there a limit on number of modules per user?**
A: Role modules max: 64, User modules max: 128 (per Zod schema validation)

---

For technical details, see:
- `docs/PERMISSIONS.md` - Permission system architecture
- `docs/API_REFERENCE.md` - API documentation
- `lib/auth/guards.ts` - Guard implementation
