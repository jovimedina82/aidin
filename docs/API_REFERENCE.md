# AidIN API Reference

## Base URL

```
Production: https://helpdesk.surterreproperties.com/api
Development: http://localhost:3011/api
```

## Authentication

All API requests require authentication via JWT token in the `Authorization` header or session cookie.

```
Authorization: Bearer <jwt-token>
```

The auth context includes:
- `userId` - Unique user identifier
- `email` - User email address
- `role` - One of: requester, staff, manager, admin
- `modules` - Array of enabled module keys

## Authorization

Requests are authorized using:
1. **Role-based checks** - Minimum role level required
2. **Module-based checks** - Required module assignment

Admin role **bypasses all checks** automatically.

## Error Responses

All errors follow a consistent format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {...}  // Optional additional context
  }
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed (Zod schema) |
| `INSUFFICIENT_ROLE` | 403 | User role insufficient for action |
| `MODULE_NOT_ASSIGNED` | 403 | User lacks required module |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

## Rate Limiting

- **Auth endpoints:** 5 requests/minute
- **Read endpoints:** 100 requests/minute
- **Write endpoints:** 30 requests/minute

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1698765432
```

## Admin Endpoints

### List Available Modules

```
GET /api/admin/modules
```

**Authorization:** None (public list)

**Response:**
```json
{
  "modules": [
    "tickets",
    "reports",
    "presence",
    "kb",
    "uploads"
  ]
}
```

### Get Role Module Assignments

```
GET /api/admin/role-modules
```

**Authorization:** Admin

**Response:**
```json
[
  {
    "role": "staff",
    "modules": ["tickets", "kb", "presence"],
    "createdAt": "2025-10-25T10:00:00Z",
    "updatedAt": "2025-10-25T10:00:00Z"
  }
]
```

### Update Role Module Assignment

```
PUT /api/admin/role-modules
```

**Authorization:** Admin

**Request Body:**
```json
{
  "role": "staff",
  "modules": ["tickets", "kb", "presence", "reports"]
}
```

**Validation:**
- `role`: Must be one of: requester, staff, manager, admin
- `modules`: Array of strings, max 64 items

**Response:**
```json
{
  "ok": true
}
```

### Get User Module Overrides

```
GET /api/admin/user-modules?userId=<userId>
```

**Authorization:** Admin

**Query Parameters:**
- `userId` (required) - User identifier

**Response:**
```json
{
  "userId": "user-123",
  "modules": ["tickets", "kb", "reports"],
  "createdAt": "2025-10-25T10:00:00Z",
  "updatedAt": "2025-10-25T10:00:00Z"
}
```

If no override exists:
```json
{
  "userId": "user-123",
  "modules": []
}
```

### Update User Module Overrides

```
PUT /api/admin/user-modules
```

**Authorization:** Admin

**Request Body:**
```json
{
  "userId": "user-123",
  "modules": ["tickets", "kb", "reports"]
}
```

**Validation:**
- `userId`: Required, min length 1
- `modules`: Array of strings, max 128 items

**Response:**
```json
{
  "ok": true
}
```

## Audit Logging

All mutating operations (POST, PUT, DELETE) are automatically logged with:
- Actor ID and email
- Actor role at time of action
- Action type (CREATE, UPDATE, DELETE, etc.)
- Entity type and ID
- Before/after snapshots (with PII redaction)
- Request IP and user agent
- Tamper-evident hash chain

Audit logs are stored in the `audit_logs` table and can be queried by admins.

## Feature Flags

Certain features are gated by environment variables:

| Flag | Default | Description |
|------|---------|-------------|
| `FEATURE_ADMIN_MODULES_UI` | false | Enable admin modules UI |
| `FEATURE_AUDIT_LOG_ENFORCE` | false | Fail mutations if audit write fails |
| `FEATURE_OPENAPI_DOCS` | false | Enable OpenAPI spec endpoint |
| `FEATURE_DEV_LOGIN` | false | Enable dev login (never in prod) |

## Webhooks

_(Not yet implemented in MVP)_

Planned webhook events:
- `ticket.created`
- `ticket.updated`
- `ticket.closed`
- `comment.added`

## SDK Usage

TypeScript SDK (generated from OpenAPI):

```typescript
import { AidinClient } from @/sdk/aidin-client;

const client = new AidinClient({
  baseUrl: https://helpdesk.surterreproperties.com/api,
  token: process.env.AIDIN_API_TOKEN,
});

// Get role modules
const roles = await client.admin.getRoleModules();

// Update role modules
await client.admin.updateRoleModules({
  role: staff,
  modules: [tickets, kb, presence],
});
```

## Best Practices

1. **Always handle 403 errors** - User may lack required role/module
2. **Check feature flags** - Features may be disabled in certain environments
3. **Respect rate limits** - Implement exponential backoff
4. **Validate all inputs** - Even if using TypeScript SDK
5. **Never log sensitive data** - Audit logs automatically redact PII
6. **Use bulk endpoints** - When updating multiple resources

## Support

- **Documentation:** https://docs.surterreproperties.com/aidin
- **Issues:** Contact IT department
- **API Status:** https://status.surterreproperties.com

---

**Last Updated:** 2025-10-25  
**API Version:** 1.0 (MVP)  
**OpenAPI Spec:** `/docs/openapi.yaml` (when feature enabled)
