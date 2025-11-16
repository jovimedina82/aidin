# Aidin Helpdesk - Complete API Reference

**Version:** 0.1.0
**Total Endpoints:** 98
**Last Updated:** November 16, 2025

---

## Base URL

```
Development: http://localhost:3000/api
Production: https://your-domain.com/api
```

---

## Authentication

All authenticated endpoints require:
- JWT token in `Authorization: Bearer <token>` header
- OR `aidin_token` cookie (httpOnly)

CSRF-protected endpoints (POST/PUT/PATCH/DELETE) require:
- `x-csrf-token` header matching `csrf_token` cookie

---

## Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20
  }
}
```

### Error Response
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "status": 400
}
```

---

## 1. Authentication Endpoints (10)

### POST /auth/login
Email/password authentication.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "roles": ["Staff"]
  }
}
```

**Rate Limit:** 5 attempts per 15 minutes per IP:email

---

### POST /auth/register
User self-registration.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Rate Limit:** 5 attempts per hour per IP

---

### GET /auth/azure/login
Initiate Azure AD SSO flow.

**Response:** Redirect to Microsoft login page

---

### GET /auth/azure-callback
Azure AD OAuth callback handler.

**Query Parameters:**
- `code` - Authorization code from Azure AD

---

### POST /auth/logout
Terminate user session.

**Auth Required:** Yes

**Response:**
```json
{ "ok": true }
```

---

### GET /auth/me
Get current user profile.

**Auth Required:** Yes

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "roles": ["Admin"],
  "departments": ["IT Support"],
  "preferences": { ... }
}
```

---

### GET /auth/csrf-token
Get CSRF token for form submissions.

**Response:**
```json
{
  "csrfToken": "hex-string"
}
```

---

### POST /auth/mint-token
Generate short-lived API token (Admin only).

**Auth Required:** Admin role

**Response:**
```json
{
  "token": "eyJhbGc...",
  "expiresIn": "30m"
}
```

---

### POST /auth/dev-login
Development-only quick login (DISABLED in production).

---

### GET /auth/sso-success
Handle SSO token handoff (internal).

---

## 2. Ticket Endpoints (28)

### GET /tickets
List tickets with filtering and pagination.

**Auth Required:** Yes

**Query Parameters:**
- `status` - Filter by status (NEW, OPEN, PENDING, ON_HOLD, SOLVED)
- `priority` - Filter by priority (LOW, NORMAL, HIGH, URGENT)
- `assigneeId` - Filter by assignee
- `requesterId` - Filter by requester
- `departmentId` - Filter by department
- `search` - Search in title/description
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 20, max: 100)
- `sortBy` - Sort field (default: createdAt)
- `sortOrder` - asc or desc (default: desc)

**Response:**
```json
{
  "tickets": [...],
  "total": 150,
  "page": 1,
  "totalPages": 8
}
```

---

### POST /tickets
Create new ticket.

**Auth Required:** Yes

**Request:**
```json
{
  "title": "Issue with login",
  "description": "Cannot access my account...",
  "priority": "HIGH",
  "departmentId": "uuid",
  "requesterId": "uuid" // Optional, defaults to current user
}
```

**Response:**
```json
{
  "ticket": {
    "id": "uuid",
    "ticketNumber": "TICK-2025-001",
    "title": "Issue with login",
    "status": "NEW",
    ...
  }
}
```

---

### GET /tickets/:id
Get single ticket with full details.

**Auth Required:** Yes (Requester, Assignee, or Staff/Admin)

**Response:**
```json
{
  "id": "uuid",
  "ticketNumber": "TICK-2025-001",
  "title": "...",
  "description": "...",
  "status": "OPEN",
  "priority": "HIGH",
  "requester": { ... },
  "assignee": { ... },
  "comments": [...],
  "attachments": [...],
  "tags": [...],
  "aiDecision": { ... },
  "createdAt": "2025-11-16T..."
}
```

---

### PATCH /tickets/:id
Update ticket fields.

**Auth Required:** Yes (Assignee or Staff/Admin)

**Request:**
```json
{
  "status": "OPEN",
  "priority": "URGENT",
  "assigneeId": "uuid"
}
```

---

### DELETE /tickets/:id
Delete ticket (Admin only).

**Auth Required:** Admin role

---

### GET /tickets/:id/comments
Get ticket comments.

**Auth Required:** Yes (Requester, Assignee, or Staff/Admin)

**Response:**
```json
{
  "comments": [
    {
      "id": "uuid",
      "content": "...",
      "isPublic": true,
      "user": { ... },
      "createdAt": "..."
    }
  ]
}
```

---

### POST /tickets/:id/comments
Add comment to ticket.

**Auth Required:** Yes

**Request:**
```json
{
  "content": "Comment text...",
  "isPublic": true,
  "attachments": ["attachment-id-1", "attachment-id-2"]
}
```

---

### POST /tickets/:id/ai-draft
Generate AI draft response.

**Auth Required:** Staff/Admin

**Response:**
```json
{
  "draft": "Thank you for contacting us...",
  "suggestedArticles": [...]
}
```

---

### POST /tickets/:id/merge
Merge tickets together.

**Auth Required:** Staff/Admin

**Request:**
```json
{
  "sourceTicketId": "uuid-to-merge-from"
}
```

---

### POST /tickets/:id/send-reply
Send email reply to ticket requester.

**Auth Required:** Staff/Admin

**Request:**
```json
{
  "content": "Email content...",
  "ccEmails": ["cc@example.com"]
}
```

---

### GET /tickets/:id/thread
Get ticket thread (parent/children).

**Auth Required:** Yes

---

### POST /tickets/:id/rate
Submit satisfaction rating.

**Request:**
```json
{
  "rating": 5,
  "feedback": "Excellent service!"
}
```

---

### GET /tickets/:id/messages
Get email messages for ticket.

**Auth Required:** Yes

---

### POST /tickets/:id/upload-draft-file
Upload file for draft response.

**Auth Required:** Staff/Admin

---

### Additional ticket endpoints cover:
- Tag management (`/tickets/:id/tags`)
- CC management (`/tickets/:id/cc`)
- Knowledge base linking (`/tickets/:id/kb`)
- Attachments (`/tickets/:id/attachments`)
- Status history (`/tickets/:id/history`)

---

## 3. User Endpoints (14)

### GET /users
List all users.

**Auth Required:** Staff/Admin

**Query Parameters:**
- `role` - Filter by role
- `departmentId` - Filter by department
- `isActive` - Filter by active status
- `search` - Search by name/email

---

### POST /users
Create new user.

**Auth Required:** Admin

**Request:**
```json
{
  "email": "new@example.com",
  "firstName": "Jane",
  "lastName": "Doe",
  "password": "password123",
  "roles": ["Staff"],
  "departments": ["uuid-1", "uuid-2"]
}
```

---

### GET /users/:id
Get user details.

**Auth Required:** Self, or Staff/Admin

---

### PATCH /users/:id
Update user.

**Auth Required:** Self, or Admin

---

### DELETE /users/:id
Deactivate user (soft delete).

**Auth Required:** Admin

---

### GET /users/:id/roles
Get user's assigned roles.

---

### POST /users/:id/roles
Assign roles to user.

**Request:**
```json
{
  "roles": ["Admin", "Staff"]
}
```

---

### DELETE /users/:id/roles/:roleId
Remove role from user.

---

### GET /users/:id/hierarchy
Get user's organizational hierarchy (manager/reports).

---

### GET /users/:id/modules
Get user's accessible modules.

---

### PATCH /users/:id/modules
Update user's module access.

---

### GET /users/:id/schedules
Get user's presence schedule.

---

### GET /users/:id/preferences
Get user preferences.

---

### PATCH /users/:id/preferences
Update user preferences.

---

## 4. Admin Endpoints (14)

### GET /admin/audit
Query audit log with filters.

**Auth Required:** Admin

**Query Parameters:**
- `startDate` - Filter start (ISO date)
- `endDate` - Filter end (ISO date)
- `action` - Filter by action type
- `entityType` - Filter by entity
- `actorEmail` - Filter by actor
- `limit` - Results (max: 1000)
- `offset` - Pagination offset (max: 100000)

---

### GET /admin/audit/export
Export audit log to CSV/JSON.

---

### GET /admin/audit/verify
Verify audit chain integrity.

---

### GET /admin/audit/dlq
View dead letter queue entries.

---

### GET /admin/modules
List all system modules.

---

### PATCH /admin/modules/:id
Update module configuration.

---

### GET /admin/keywords
List department keywords.

---

### POST /admin/keywords
Add new keyword.

---

### DELETE /admin/keywords/:id
Remove keyword.

---

### GET /admin/settings
Get system settings.

---

### PATCH /admin/settings
Update system settings.

---

### GET /admin/notifications
Get/create admin notifications.

---

### POST /admin/blocked-domains
Block email domain.

---

### DELETE /admin/blocked-domains/:id
Unblock email domain.

---

## 5. Presence/Scheduling Endpoints (6)

### GET /presence/plan-day
Get day planning for current user.

**Auth Required:** Yes

---

### POST /presence/plan-day
Create/update day schedule.

**Request:**
```json
{
  "date": "2025-11-16",
  "segments": [
    {
      "statusId": "uuid",
      "officeLocationId": "uuid",
      "startAt": "09:00",
      "endAt": "12:00",
      "notes": "Morning shift"
    }
  ]
}
```

**Validation:** Total hours <= 8 per day

---

### GET /presence/day/:userId
Get specific user's schedule.

---

### POST /presence/segment
Create schedule segment.

---

### PATCH /presence/segment/:id
Update schedule segment.

---

### DELETE /presence/segment/:id
Delete schedule segment.

---

## 6. AI/Assistant Endpoints (6)

### POST /assistant/chat
Send message to AI assistant.

**Request:**
```json
{
  "message": "How do I reset a user's password?",
  "context": { ... }
}
```

---

### GET /aidin-chat/sessions
List user's chat sessions.

---

### POST /aidin-chat/sessions
Create new chat session.

---

### GET /aidin-chat/sessions/:id
Get chat session with messages.

---

### POST /aidin-chat/sessions/:id/messages
Add message to session.

---

### DELETE /aidin-chat/sessions/:id
Delete chat session.

---

## 7. Notification Endpoints (2)

### POST /notifications/:id/read
Mark notification as read.

**Response:**
```json
{ "success": true }
```

---

### POST /notifications/read-all
Mark all notifications as read.

**Response:**
```json
{
  "count": 5,
  "success": true
}
```

---

## 8. Knowledge Base Endpoints (5)

### GET /knowledge-base
List KB articles.

**Query Parameters:**
- `departmentId` - Filter by department
- `search` - Search in title/content
- `isActive` - Filter by active status

---

### POST /knowledge-base
Create KB article.

**Request:**
```json
{
  "title": "Password Reset Guide",
  "content": "Step 1...",
  "departmentId": "uuid",
  "tags": "password,security,reset"
}
```

---

### GET /knowledge-base/:id
Get article details.

---

### PATCH /knowledge-base/:id
Update article.

---

### DELETE /knowledge-base/:id
Archive article.

---

## 9. Department Endpoints (4)

### GET /departments
List all departments.

---

### POST /departments
Create department.

**Request:**
```json
{
  "name": "IT Support",
  "description": "Technical support team",
  "color": "blue"
}
```

---

### PATCH /departments/:id
Update department.

---

### DELETE /departments/:id
Deactivate department.

---

## 10. Tag Endpoints (4)

### GET /tags
List all tags.

---

### POST /tags
Create tag.

**Request:**
```json
{
  "name": "urgent",
  "displayName": "Urgent",
  "color": "#ff0000",
  "category": "priority"
}
```

---

### PATCH /tags/:id
Update tag.

---

### DELETE /tags/:id
Archive tag.

---

## 11. Attachment Endpoints (6)

### POST /attachments/upload
Upload file attachment.

**Content-Type:** multipart/form-data

**Form Fields:**
- `file` - File to upload
- `ticketId` - Associated ticket

**Max Size:** 25MB

---

### GET /attachments/:id
Download attachment.

**Response:** File stream with appropriate Content-Type

---

### DELETE /attachments/:id
Delete attachment.

**Auth Required:** Owner or Admin

---

### GET /attachments/:id/info
Get attachment metadata.

---

### POST /attachments/presigned-url
Get presigned upload URL.

---

### POST /attachments/cleanup
Remove expired attachments (Admin).

---

## 12. Report/Analytics Endpoints (5)

### GET /stats
Get dashboard statistics.

**Response:**
```json
{
  "totalTickets": 150,
  "openTickets": 45,
  "resolvedToday": 12,
  "avgResolutionTime": 3600000,
  "ticketsByStatus": { ... },
  "ticketsByPriority": { ... }
}
```

---

### GET /stats/weekly
Get weekly aggregated statistics.

---

### GET /reports/analytics
Get detailed analytics report.

---

### GET /satisfaction-metrics
Get satisfaction survey results.

---

### POST /reports/export
Export report data to PDF/Excel.

---

## 13. Inbound Email Endpoints (5)

### POST /inbound/email
Receive email via webhook (N8N).

**Headers:**
- `x-webhook-signature` - HMAC signature

**Request:** Email payload (JSON)

---

### POST /webhooks/graph
Microsoft Graph subscription webhook.

**Headers:**
- `Authorization` - Graph token

---

### POST /webhooks/graph/notifications
Graph change notifications.

---

### GET /inbound/health
Email processing health check.

---

### POST /inbound/retry/:id
Retry failed email processing.

---

## 14. Background Job Endpoints (4)

### POST /jobs/email-polling/start
Start email polling job.

**Auth Required:** Admin

---

### POST /jobs/email-polling/stop
Stop email polling job.

---

### GET /jobs/email-polling/status
Get polling job status.

---

### POST /cron/cleanup
Run cleanup tasks (attachments, expired tokens).

---

## 15. Utility Endpoints

### GET /health
System health check.

**Response:**
```json
{
  "status": "healthy",
  "database": "connected",
  "uptime": 3600000,
  "timestamp": "2025-11-16T12:00:00Z"
}
```

---

### POST /classifier-feedback
Submit AI classifier feedback.

**Request:**
```json
{
  "ticketId": "uuid",
  "feedbackType": "wrong_category",
  "correctCategory": "Billing",
  "reason": "This is a billing issue, not technical"
}
```

---

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 204 | No Content (deleted) |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (not authenticated) |
| 403 | Forbidden (not authorized) |
| 404 | Not Found |
| 409 | Conflict (duplicate) |
| 422 | Unprocessable Entity |
| 429 | Too Many Requests (rate limited) |
| 500 | Internal Server Error |

---

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| POST /auth/login | 5 | 15 minutes |
| POST /auth/register | 5 | 1 hour |
| POST /inbound/email | 20 | 1 minute |
| Default endpoints | 100 | 1 minute |

When rate limited, response includes:
```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 60
}
```

---

## Webhook Authentication

For `/inbound/email` and `/webhooks/*`:

```
X-Webhook-Signature: sha256=<hex-signature>
```

Signature validation:
```javascript
const signature = hmac('sha256', secret, JSON.stringify(payload))
// Timing-safe comparison
```

---

## CSRF Protection

Protected methods: POST, PUT, PATCH, DELETE

Required headers:
```
x-csrf-token: <token-from-cookie>
Cookie: csrf_token=<same-token>
```

Exempt paths:
- `/api/webhooks/*`
- `/api/inbound/*`
- `/api/public/*`
- `/api/cron/*`

---

## Pagination

Standard pagination parameters:
- `page` - Page number (1-based)
- `limit` - Results per page (max varies by endpoint)
- `offset` - Alternative: skip N results

Response includes:
```json
{
  "data": [...],
  "meta": {
    "total": 1000,
    "page": 1,
    "limit": 20,
    "totalPages": 50
  }
}
```

---

## Sorting

Standard sorting parameters:
- `sortBy` - Field name (e.g., "createdAt", "status")
- `sortOrder` - "asc" or "desc"

---

## Filtering

Most list endpoints support:
- Exact match: `?status=OPEN`
- Multiple values: `?status=OPEN,PENDING`
- Search: `?search=keyword`
- Date ranges: `?startDate=2025-01-01&endDate=2025-12-31`

---

**Documentation Generated:** November 16, 2025
**API Version:** 0.1.0
