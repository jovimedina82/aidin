# AidIN Permissions Matrix

## Overview

AidIN uses a two-tier permission system:
1. **Role-based access** - Default permissions by role (requester, staff, manager, admin)
2. **Module-based access** - Fine-grained control over feature modules

**Precedence Rule:** User-level module overrides > Role-level defaults

## Role Hierarchy

```
Requester (0) → Staff (1) → Manager (2) → Admin (3)
```

Higher roles inherit all permissions from lower roles, plus additional capabilities.

## Module Definitions

| Module | Description |
|--------|-------------|
| `tickets` | Create, view, update tickets and comments |
| `reports` | Access analytics, dashboards, and reports |
| `presence` | View and manage staff presence/availability |
| `kb` | Access and manage knowledge base articles |
| `uploads` | Upload and manage file attachments |

## Permissions Matrix

| Feature | Requester | Staff | Manager | Admin |
|---------|-----------|-------|---------|-------|
| **Tickets** | Own only | Assigned/Dept | Dept + reassign | All + admin |
| **Comments** | Own tickets | Assigned tickets | Dept tickets | All tickets |
| **Reports** | ❌ | Limited views | Dept analytics | Full access |
| **Presence** | ❌ | Self + view | Dept management | Full management |
| **Knowledge Base** | Read only | Read/Edit | Read/Edit | Full CRUD + admin |
| **Uploads** | Own tickets | Assigned tickets | Dept tickets | All |
| **Module Assignment** | ❌ | ❌ | ❌ | ✅ Manage all |
| **User Management** | ❌ | ❌ | Limited | Full admin |
| **Audit Logs** | ❌ | ❌ | Dept only | Full access |

## Role Capabilities

### Requester
- Create and view own tickets
- Add comments to own tickets
- Submit satisfaction surveys
- Read knowledge base articles
- Upload attachments to own tickets

**Default Modules:** `tickets`, `kb`

### Staff
- Everything Requester can do, plus:
- View and work on assigned tickets
- View department tickets
- Edit knowledge base articles
- View and update own presence status
- Access limited reporting

**Default Modules:** `tickets`, `kb`, `presence`

### Manager
- Everything Staff can do, plus:
- View all department tickets
- Reassign tickets within department
- Access department-level analytics
- Manage department presence/scheduling
- Approve/escalate tickets

**Default Modules:** `tickets`, `kb`, `presence`, `reports`

### Admin
- **Full access to all features**
- **Automatic bypass of all module checks**
- Manage users and roles
- Assign modules to roles and users
- View and verify audit logs
- System configuration
- Access all analytics and reports

**Default Modules:** `tickets`, `kb`, `presence`, `reports`, `uploads`

## Module Assignment

### Role-Level Assignment
Set default modules for all users with a specific role:

```
PUT /api/admin/role-modules
{
  "role": "staff",
  "modules": ["tickets", "kb", "presence"]
}
```

### User-Level Override
Override modules for a specific user (takes precedence):

```
PUT /api/admin/user-modules
{
  "userId": "user-123",
  "modules": ["tickets", "kb", "presence", "reports"]
}
```

### Precedence Example

If a user has role `staff` but a user override adds `reports`:
- **Role default:** `["tickets", "kb", "presence"]`
- **User override:** `["tickets", "kb", "presence", "reports"]`
- **Effective access:** User override is used → User can access reports

## Authorization Flow

```typescript
// 1. Extract user context from JWT/session
const user = await getCurrentUser(request);

// 2. Check role requirement
requireRole(user, 'staff'); // Throws 403 if insufficient

// 3. Check module requirement  
requireModule(user, 'tickets'); // Throws 403 if not assigned

// 4. Admin bypass
// If user.role === 'admin', both checks automatically pass
```

## Guards API

### `requireRole(ctx, role)`
Enforces minimum role level. Admin always passes.

**Example:**
```typescript
requireRole(ctx.auth, 'manager'); // Requires manager or admin
```

### `requireModule(ctx, module)`
Enforces module access. Admin always passes.

**Example:**
```typescript
requireModule(ctx.auth, 'reports'); // Requires reports module
```

### `hasRole(ctx, role)` (non-throwing)
Returns boolean for role check.

### `hasModule(ctx, module)` (non-throwing)
Returns boolean for module check.

## Best Practices

1. **Apply guards to all mutating endpoints** (POST, PUT, DELETE)
2. **Apply guards to sensitive read endpoints** (reports, PII, audit logs)
3. **Use `requireRole` for role-based restrictions**
4. **Use `requireModule` for feature-specific access**
5. **Combine both for fine-grained control**
6. **Always use `withAudit()` wrapper for mutations**

## Example: Protected Route

```typescript
import { requireRole, requireModule } from '@/lib/auth/guards';
import { withAudit } from '@/lib/audit/middleware';
import { parseOrThrow, json } from '@/lib/validation/http';

const UpdateSchema = z.object({
  status: z.enum(['open', 'closed']),
});

async function handler({ req, ctx }: { req: Request; ctx: any }) {
  // Enforce role: must be staff or higher
  requireRole(ctx.auth, 'staff');
  
  // Enforce module: must have tickets module
  requireModule(ctx.auth, 'tickets');
  
  // Validate input
  const data = parseOrThrow(UpdateSchema, await req.json());
  
  // Get before state for audit
  const ticket = await prisma.ticket.findUnique({ where: { id: ctx.params.id } });
  ctx.before = ticket;
  ctx.entityId = ctx.params.id;
  
  // Perform mutation
  const updated = await prisma.ticket.update({
    where: { id: ctx.params.id },
    data: { status: data.status },
  });
  ctx.after = updated;
  
  return json(200, { ticket: updated });
}

// Wrap with audit logging
export const PUT = withAudit('UPDATE', 'ticket', handler);
```

## Security Notes

- **Admin bypass is intentional** - admins need full access for troubleshooting
- **User overrides are powerful** - use sparingly and audit carefully
- **Module assignment changes are logged** - all changes to RoleModule/UserModule should be audited
- **Feature flags control UI** - APIs enforce permissions regardless of UI state

## See Also

- [API Reference](./API_REFERENCE.md) - API endpoint documentation
- [Audit Logging](../lib/audit/README.md) - Tamper-evident audit system
- `/app/admin/modules` - Module assignment UI (when enabled)

---

**Last Updated:** 2025-10-25  
**Version:** MVP 1.0
