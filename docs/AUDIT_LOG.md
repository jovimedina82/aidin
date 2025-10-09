= AIDIN Helpdesk - Production-Grade Audit Log System

**Organization:** Surterre Properties
**Domain:** surterreproperties.com
**Version:** 1.0.0

## Overview

The AIDIN Audit Log System provides a **tamper-evident, append-only audit trail** for all actions in the helpdesk system. It uses **hash chain integrity** to prevent modification or deletion of audit records, and enforces **system actor assignment** for all automated actions.

### Key Features

- ✅ **Tamper-evident hash chain** - Each entry is cryptographically linked to the previous
- ✅ **Append-only enforcement** - Database triggers prevent UPDATE/DELETE operations
- ✅ **System actor enforcement** - All automations/webhooks/cron jobs log as `admin@surterreproperties.com`
- ✅ **Multi-level redaction** - Configurable PII/sensitive data sanitization
- ✅ **Idempotency** - Duplicate events (same request_id) are safely ignored
- ✅ **Dead letter queue** - Failed audit events are queued for retry
- ✅ **Admin-only UI** - Powerful filtering, export, and chain verification
- ✅ **Streaming exports** - JSONL and CSV formats for large datasets

---

## Table of Contents

1. [Installation](#installation)
2. [Database Schema](#database-schema)
3. [Configuration](#configuration)
4. [Usage](#usage)
5. [Integration Points](#integration-points)
6. [Admin UI](#admin-ui)
7. [API Endpoints](#api-endpoints)
8. [Hash Chain Verification](#hash-chain-verification)
9. [Redaction Policies](#redaction-policies)
10. [Troubleshooting](#troubleshooting)
11. [Operations Runbook](#operations-runbook)

---

## Installation

### 1. Run Database Migration

```bash
npx prisma migrate deploy
```

This creates:
- `audit_log` table with hash chain fields
- Indexes for high-performance queries
- Triggers to prevent UPDATE/DELETE
- `audit_log_dlq` table for failed events
- `audit_chain_verification` table for integrity checks

### 2. Generate Prisma Client

```bash
npx prisma generate
```

### 3. Environment Variables

Add to your `.env` file:

```bash
# Audit system actor (default for automations)
AUDIT_SYSTEM_ACTOR_EMAIL=admin@surterreproperties.com

# Enable/disable audit logging (default: true)
AUDIT_ENABLED=true

# Default redaction level (0=none, 1=moderate, 2=aggressive)
AUDIT_DEFAULT_REDACTION_LEVEL=1

# Chain verification schedule (cron format)
AUDIT_VERIFY_CRON="0 * * * *"  # Every hour
```

---

## Database Schema

### `audit_log` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `ts` | DATETIME | Timestamp (UTC) |
| `action` | TEXT | Action type (e.g., `ticket.created`) |
| `actor_id` | TEXT | User ID (nullable) |
| `actor_email` | TEXT | Actor email (required) |
| `actor_type` | TEXT | `human`, `system`, or `service` |
| `impersonated_user` | TEXT | If admin acting as another user |
| `entity_type` | TEXT | `ticket`, `user`, `email`, etc. |
| `entity_id` | TEXT | Entity identifier |
| `target_id` | TEXT | Related entity (e.g., comment ID) |
| `request_id` | TEXT | Request identifier for tracing |
| `correlation_id` | TEXT | Correlation across multiple requests |
| `ip` | TEXT | Client IP address (redacted if configured) |
| `user_agent` | TEXT | Client user agent |
| `prev_values` | TEXT | JSON of previous state |
| `new_values` | TEXT | JSON of new state |
| `metadata` | TEXT | JSON of additional context |
| `redaction_level` | INT | 0, 1, or 2 |
| `prev_hash` | TEXT | Previous entry's hash (chain link) |
| `hash` | TEXT | This entry's SHA-256 hash |

### Constraints

- **Unique index**: `(action, entity_id, request_id)` for idempotency
- **Triggers**: `prevent_audit_log_update`, `prevent_audit_log_delete`

---

## Configuration

### System Actor

All automated actions (AI, webhooks, cron jobs, email inbound) are logged with:

```typescript
{
  actorEmail: 'admin@surterreproperties.com',
  actorType: 'system',
  actorId: null
}
```

This is **automatically enforced** when using `withSystemActor()` or when no actor is provided in the context.

### Redaction Levels

| Level | Description | Examples |
|-------|-------------|----------|
| 0 | **None** - Store as-is | Internal admin actions |
| 1 | **Moderate** - Hash email local parts, mask tokens, truncate long bodies | Most user actions |
| 2 | **Aggressive** - Domain-only emails, full phone masking, never store secrets | External integrations, public data |

---

## Usage

### Basic Logging

```typescript
import { logEvent } from '@/lib/audit';

await logEvent({
  action: 'ticket.created',
  entityType: 'ticket',
  entityId: 'TCK-12345',
  newValues: {
    title: 'Printer not working',
    status: 'NEW',
  },
  metadata: {
    source: 'web',
  },
});
```

### System/Automation Context

```typescript
import { withSystemActor } from '@/lib/audit';

await withSystemActor(async () => {
  // All logEvent calls here will use system actor
  await logEvent({
    action: 'ai.classified',
    entityType: 'ticket',
    entityId: 'TCK-12345',
    metadata: {
      confidence: 0.89,
      category: 'IT',
    },
  });
});
```

### Middleware Integration

#### Next.js App Router

```typescript
// middleware.ts
import { auditMiddleware } from '@/lib/audit/middleware';

export function middleware(request: NextRequest) {
  return auditMiddleware(request);
}
```

#### Pages Router

```typescript
// pages/api/tickets.ts
import { withAudit } from '@/lib/audit/middleware';

async function handler(req, res) {
  // Your logic here
  // Request context is automatically captured
}

export default withAudit(handler);
```

---

## Integration Points

### Ticket Handlers

```typescript
import {
  auditTicketCreated,
  auditTicketStatusChanged,
  auditCommentAdded,
} from '@/lib/audit/integrations';

// In your ticket creation handler
await auditTicketCreated(ticket.id, ticket, user.id);

// In status change handler
await auditTicketStatusChanged(
  ticket.id,
  oldStatus,
  newStatus
);

// In comment handler
await auditCommentAdded(
  ticket.id,
  comment.id,
  comment.isPublic,
  comment.content
);
```

### Email Handlers

```typescript
import {
  auditEmailInbound,
  auditEmailOutbound,
} from '@/lib/audit/integrations';

// Microsoft Graph webhook handler
await auditEmailInbound(
  message.id,
  message.from.emailAddress.address,
  message.subject,
  message.conversationId
);

// Sending email
await auditEmailOutbound(
  messageId,
  ticketId,
  to,
  subject,
  true // success
);
```

### AI Handlers

```typescript
import {
  auditAIClassification,
  auditAIAutoReply,
  auditAIAutoClose,
} from '@/lib/audit/integrations';

// AI classification
await auditAIClassification(
  ticketId,
  'IT',
  0.89,
  ['printer', 'error']
);

// AI auto-reply
await auditAIAutoReply(ticketId, messageId, prompt);

// AI auto-close
await auditAIAutoClose(ticketId, 'no_response_7_days');
```

### Security Events

```typescript
import {
  auditLogin,
  auditRoleChange,
  auditSettingChange,
} from '@/lib/audit/integrations';

// Login event
await auditLogin(email, true, ip, userAgent);

// Role change
await auditRoleChange(userId, email, oldRoles, newRoles);

// Setting change
await auditSettingChange('auto_assign', false, true);
```

---

## Admin UI

### Accessing the Audit Log

1. Navigate to `/admin/audit`
2. **Admin or Manager role required**
3. Access denied otherwise

### Features

- **Filtering**: Date range, action, actor, entity type
- **Pagination**: 100 entries per page
- **Detail View**: Click any row to see full JSON and diff
- **Export**: Download JSONL or CSV
- **Chain Verification**: Verify hash integrity for date range
- **Chain Status Indicator**: Green (valid), Red (broken)

### Example Filters

```
Start Date: 2025-01-01
End Date: 2025-01-31
Action: ticket.created
Actor Email: sara@surterreproperties.com
Entity Type: ticket
```

---

## API Endpoints

### GET /api/admin/audit

List audit logs with filters.

**Query Parameters:**
- `startDate` (ISO 8601)
- `endDate` (ISO 8601)
- `action`
- `actorEmail`
- `actorType` (human|system|service)
- `entityType`
- `entityId`
- `limit` (default: 100, max: 1000)
- `offset` (default: 0)

**Response:**
```json
{
  "data": [...],
  "total": 1523,
  "limit": 100,
  "offset": 0
}
```

### GET /api/admin/audit/export

Stream audit logs in JSONL or CSV format.

**Query Parameters:**
- Same as above, plus:
- `format` (jsonl|csv)

**Response:**
- Content-Type: `application/x-ndjson` or `text/csv`
- Transfer-Encoding: `chunked`
- Content-Disposition: `attachment; filename="audit-log-2025-01-08.jsonl"`

### POST /api/admin/audit/verify

Verify hash chain integrity for a date range.

**Request:**
```json
{
  "startDate": "2025-01-01T00:00:00Z",
  "endDate": "2025-01-08T23:59:59Z"
}
```

**Response:**
```json
{
  "status": "valid",
  "totalEntries": 1523,
  "verifiedEntries": 1523
}
```

Or if broken:
```json
{
  "status": "invalid",
  "totalEntries": 1523,
  "verifiedEntries": 1015,
  "firstFailureId": "uuid-...",
  "firstFailureTs": "2025-01-05T14:32:10Z",
  "details": {
    "expectedHash": "abc123...",
    "actualHash": "def456...",
    "brokenAt": "uuid-..."
  }
}
```

---

## Hash Chain Verification

### How It Works

Each audit log entry contains:
1. **prevHash**: The `hash` of the previous entry (chronologically)
2. **hash**: `SHA256(prevHash + canonicalJSON(entry))`

This creates a tamper-evident chain. If any entry is modified, all subsequent hashes become invalid.

### Manual Verification

```typescript
import { verifyChainRange } from '@/lib/audit/verifier';

const result = await verifyChainRange(
  new Date('2025-01-01'),
  new Date('2025-01-31')
);

if (result.status === 'invalid') {
  console.error('Chain broken at:', result.firstFailureId);
}
```

### Automated Verification Job

Set up a cron job to run hourly:

```typescript
// cron/verify-audit-chain.ts
import { verifyChainJob } from '@/lib/audit/verifier';

export async function runVerification() {
  await verifyChainJob();
}
```

This logs an `audit.chain.warning` event if verification fails.

---

## Redaction Policies

### Email Redaction

```typescript
// Level 0: user@example.com
// Level 1: a3f8d9b1@example.com (hash local part)
// Level 2: ***@example.com (mask local part)
```

### Phone Redaction

```typescript
// Level 0: 555-123-4567
// Level 1: 555-***67 (mask middle)
// Level 2: ********** (full mask)
```

### Token/Secret Redaction

```typescript
// Level 1: abcd****wxyz (first/last 4 chars)
// Level 2: [REDACTED]
```

### Automatic Sanitization

These keys are **always removed** from metadata:
- `password`, `pwd`
- `secret`, `apiKey`, `api_key`
- `privateKey`, `private_key`
- `accessToken`, `refreshToken`
- `ssn`, `creditCard`, `cvv`

---

## Troubleshooting

### Issue: Audit events not appearing

**Check:**
1. Is `AUDIT_ENABLED=true` in `.env`?
2. Are migrations applied? Run `npx prisma migrate deploy`
3. Check dead letter queue: `SELECT * FROM audit_log_dlq WHERE resolved = 0`

### Issue: "UPDATE operations not allowed" error

**This is expected!** The audit log is append-only. You cannot modify existing entries.

If you need to "correct" an entry, create a new compensating entry:

```typescript
await logEvent({
  action: 'audit.correction',
  entityType: 'ticket',
  entityId: 'TCK-12345',
  metadata: {
    originalEntryId: 'uuid-of-wrong-entry',
    correction: 'Actual status was OPEN, not CLOSED',
  },
});
```

### Issue: Chain verification failing

**Causes:**
1. **Database clock skew** - Entries inserted out of order
2. **Concurrent inserts** - Race condition on `prev_hash`
3. **Manual database modification** - Never directly edit `audit_log`

**Resolution:**
1. Check `audit_chain_verification` table for details
2. Identify `firstFailureId` and inspect surrounding entries
3. If corruption is detected, investigate unauthorized access

### Issue: DLQ entries piling up

**Check:**
1. Database connection issues
2. Disk space
3. Schema mismatches

**Retry:**
```typescript
import { retryDLQEvents } from '@/lib/audit/verifier';
await retryDLQEvents(maxRetries = 3);
```

---

## Operations Runbook

### Daily Tasks

- ✅ Monitor DLQ count: `SELECT COUNT(*) FROM audit_log_dlq WHERE resolved = 0`
- ✅ Check last verification: `SELECT * FROM audit_chain_verification ORDER BY verified_at DESC LIMIT 1`

### Weekly Tasks

- ✅ Review high-redaction events (level 2) for compliance
- ✅ Archive old verification results (keep last 90 days)

### Monthly Tasks

- ✅ Export audit logs for compliance archive
- ✅ Verify full chain integrity (can be slow)

### Emergency Procedures

#### Chain Integrity Compromised

1. **Stop all writes** to `audit_log`
2. **Export current state**: `GET /api/admin/audit/export?format=jsonl`
3. **Identify breach point**: Check `firstFailureId`
4. **Investigate access logs**: Who/what modified the database?
5. **Restore from backup** (if available)
6. **Re-seed** from last known good export

#### System Actor Email Changed

If you need to change from `admin@surterreproperties.com`:

1. Update `AUDIT_SYSTEM_ACTOR_EMAIL` in `.env`
2. Update `lib/audit/types.ts` constant
3. **Do NOT modify existing entries**
4. New entries will use the new email

---

## Performance Considerations

### Indexes

The migration creates these indexes for fast queries:
- `ts DESC` - Chronological queries
- `(entity_type, entity_id, ts DESC)` - Entity history
- `(action, ts DESC)` - Action filtering
- `(actor_email, ts DESC)` - Actor filtering

### Partitioning (Optional)

For very large datasets (>10M rows), consider time-based partitioning:

```sql
-- Example: Monthly partitions
CREATE TABLE audit_log_2025_01 (LIKE audit_log INCLUDING ALL);
ALTER TABLE audit_log_2025_01 INHERIT audit_log;
-- Add CHECK constraint for ts range
```

### Archival Strategy

Archive logs older than 2 years to cold storage:

```bash
# Export to JSONL
GET /api/admin/audit/export?startDate=2020-01-01&endDate=2023-01-01&format=jsonl > audit-2020-2023.jsonl

# Compress
gzip audit-2020-2023.jsonl

# Store in S3/Azure Blob
aws s3 cp audit-2020-2023.jsonl.gz s3://surterre-audit-archive/
```

---

## Compliance & Security

### GDPR / CCPA

- **Right to be forgotten**: Audit logs are **exempt** under legal compliance requirements
- **Data minimization**: Use redaction level 2 for external-facing events
- **Access logging**: All admin UI access is logged as `export.requested`

### SOC 2 / ISO 27001

- **Tamper-evident**: Hash chain provides cryptographic proof of integrity
- **Append-only**: Database triggers enforce immutability
- **Access control**: Admin-only UI with RBAC enforcement

### PCI DSS

- **Never log credit card numbers**: Automatically redacted via sanitization
- **Redact PII**: Use level 2 for payment-related events

---

## Testing

### Run Unit Tests

```bash
npm test __tests__/audit/
```

Tests cover:
- ✅ Redaction at all levels
- ✅ Hash chain continuity
- ✅ Actor resolution (system vs human)
- ✅ Context propagation
- ✅ Idempotency

### Seed Test Data

```bash
npx ts-node prisma/seeds/audit-log-seed.ts
```

Creates 20 example events covering all actor types and actions.

---

## Support

For issues or questions:
1. Check this documentation
2. Review `/api/admin/audit` for recent events
3. Inspect dead letter queue for failed events
4. Contact the development team

---

## License

Internal use only - Surterre Properties
