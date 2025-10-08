# AIDIN Helpdesk - Architecture Overview

## System Architecture

AIDIN Helpdesk is a modern, modular ticketing system built with Next.js 14, featuring clean separation of concerns and extensible design patterns.

## Core Modules

### 1. Authentication & Authorization (`modules/auth`, `modules/users`)
**Purpose**: User authentication, session management, and role-based access control

**Key Components**:
- JWT-based authentication (`lib/auth.js`)
- RBAC permission system (`modules/users/rbac.ts`)
- Azure AD SSO integration
- Session middleware

**Permissions Model**:
```
Admin > Manager > Staff > Client
```

**Actions**: `user:*, ticket:*, comment:*, admin:*`

### 2. Tickets (`modules/tickets`)
**Purpose**: Core ticket management with policy-based authorization

**Architecture**:
```
routes -> service -> policy + workflows -> repo -> prisma
```

**Key Files**:
- `domain.ts` - Types and DTOs
- `service.ts` - Business logic
- `policy.ts` - Authorization guards
- `workflows.ts` - State machine transitions
- `repo.ts` - Data access interface
- `repo.impl.ts` - Prisma implementation

**State Machine**:
```
NEW → OPEN → PENDING/ON_HOLD/SOLVED → CLOSED
```

### 3. Comments (`modules/comments`)
**Purpose**: Ticket comments with public/internal visibility

**Features**:
- Public comments (visible to clients)
- Internal comments (staff only)
- Policy-based read/write access

### 4. Reports & Analytics (`modules/reports`)
**Purpose**: KPI computation and weekly snapshots

**Architecture**:
- In-memory KPI computation (no DB writes from API)
- Weekly snapshot jobs (manual CLI script)
- Historical trend data

**KPIs**:
- `tickets_open` - Current open tickets
- `tickets_pending` - Awaiting customer response
- `tickets_solved_7d` - Resolved in last 7 days
- `avg_first_response_minutes` - Support responsiveness

## Cross-Cutting Concerns

### Configuration (`lib/config.ts`)
Centralized environment configuration with Zod validation

**Validated Fields**:
- Security: JWT_SECRET, ALLOWED_ORIGINS
- Features: AUTO_ASSIGN_ENABLED, INBOUND_EMAIL_ENABLED
- Providers: AI_PROVIDER, EMAIL_PROVIDER
- Webhooks: N8N_WEBHOOK_SECRET, GRAPH_WEBHOOK_SECRET

### Security (`lib/http/security.ts`, `middleware.ts`)
Global security middleware for all `/api/**` routes

**Headers Applied**:
- Strict-Transport-Security (HSTS)
- X-Content-Type-Options
- X-Frame-Options
- Referrer-Policy
- Permissions-Policy
- Content-Security-Policy

**CORS**: Origin-based with ALLOWED_ORIGINS validation

**Rate Limiting**: In-memory, 60 req/min per IP (dev-safe)

### Error Handling (`lib/http/errors.ts`)
Unified error response model

**Standard Shape**:
```json
{
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  }
}
```

**Error Codes**:
- `VALIDATION_ERROR` (400)
- `UNAUTHORIZED` (401)
- `FORBIDDEN` (403)
- `NOT_FOUND` (404)
- `CONFLICT` (409)
- `RATE_LIMIT_EXCEEDED` (429)
- `INTERNAL_ERROR` (500)

### Policy Layer
Authorization guards separate from business logic

**Pattern**:
```typescript
// Check permission
if (!policy.canPerformAction(user, resource)) {
  throw new Error('Forbidden')
}

// Execute action
await service.performAction(resource)
```

### Workflows
State machine validation for ticket transitions

**Pattern**:
```typescript
// Check policy
if (!policy.canTransition(user, ticket, nextStatus)) {
  throw new Error('Forbidden')
}

// Validate state machine
if (!isValidTransition(ticket.status, nextStatus)) {
  throw new Error('Invalid transition')
}

// Execute transition
await repo.updateStatus(ticket.id, nextStatus)
```

## Extension Points

### AI Providers (`modules/ai`)
Pluggable AI provider system

**Supported**:
- OpenAI (GPT-4o-mini)
- Anthropic (Claude)

**Interface**:
```typescript
interface AIProvider {
  classify(ticket: string): Promise<Category>
  respond(ticket: string, context: string): Promise<string>
}
```

### Email Providers (`modules/email`)
Pluggable email provider system

**Supported**:
- SMTP (direct)
- Microsoft Graph (Office 365)

**Interface**:
```typescript
interface EmailProvider {
  send(options: EmailOptions): Promise<EmailResult>
}
```

## Data Layer

### Database
SQLite (dev) / PostgreSQL (production compatible)

**ORM**: Prisma 6.x

**Key Models**:
- User, Role, UserRole
- Ticket, TicketComment
- WeeklyKPI (analytics snapshots)
- Department, KnowledgeBase
- AIDecision, ClassifierFeedback

### Repository Pattern
Data access isolated in repository layer

**Benefits**:
- Testability (easy mocking)
- Flexibility (swap Prisma for other ORMs)
- Clean separation (domain logic independent of data layer)

## API Design

### Versioning
- `/api/v1/**` - Stable v1 API
- `/api/**` - Internal/admin endpoints

### Authentication
All API routes require JWT token in:
- `Authorization: Bearer <token>` header
- `authToken` cookie

### Response Format
**Success**:
```json
{
  "id": "...",
  "field": "value"
}
```

**Error**:
```json
{
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Description"
  }
}
```

## Deployment Architecture

### Development
```
Next.js Dev Server (PORT=3000)
├─ API Routes (/api/**)
├─ SSR Pages
└─ Static Assets
```

### Production
```
Reverse Proxy (Nginx)
├─ Next.js Server (pm2/systemd)
│  ├─ API Routes
│  └─ SSR/SSG Pages
├─ Database (SQLite/PostgreSQL)
└─ File Storage (local/S3)
```

### Cron Jobs
- Weekly KPI snapshots: `scripts/report-weekly.ts`
- Azure AD sync: Manual trigger via `/api/azure-sync/sync`

## Testing Strategy

### Unit Tests
- Module-level (service, policy, repo)
- Mocked dependencies
- Fast execution

### Integration Tests
- API route testing
- Database interactions (in-memory)
- E2E workflows

### Smoke Tests
- Critical path validation
- Health checks
- Security header verification

## Performance Considerations

### Caching
- Prisma query caching (built-in)
- Static page generation (Next.js)
- Rate limit store (in-memory Map)

### Optimization
- Database indexes on frequently queried columns
- Selective field loading (`select` in Prisma)
- Pagination for list endpoints

### Scalability
- Stateless API design
- Horizontal scaling ready
- Database connection pooling

## Security Hardening

### Authentication
- JWT with secure secrets (min 32 chars)
- Token expiration
- Secure cookie flags

### Authorization
- RBAC at every entry point
- Policy layer for fine-grained control
- Owner-based access for clients

### Input Validation
- Zod schemas for all inputs
- SQL injection prevention (Prisma)
- XSS prevention (React escaping)

### API Security
- Rate limiting
- CORS restrictions
- Security headers
- Webhook signature validation

## Monitoring & Observability

### Logging
- Structured console logging
- Error tracking
- Audit trail for sensitive operations

### Metrics
- Response times
- Error rates
- Rate limit hits
- Database query performance

### Health Checks
- `/api/auth/me` - Auth system
- `/api/reports/kpis` - Analytics system
- Database connectivity

## Future Enhancements

### Planned
- Redis-backed rate limiting
- WebSocket for real-time updates
- Advanced auto-assignment strategies
- SLA tracking and alerts
- Customer satisfaction surveys

### Under Consideration
- Multi-tenancy
- Custom fields
- Automation rules
- Mobile app (React Native)
