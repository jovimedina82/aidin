# Audit Log Quick Reference Card

## 🚀 Setup (One-Time)

```bash
./scripts/setup-audit-log.sh
```

Or manually:
```bash
npx prisma migrate deploy
npx prisma generate
npx ts-node prisma/seeds/audit-log-seed.ts
```

---

## 📝 Basic Usage

### Human Action (Web/API)

```typescript
import { logEvent } from '@/lib/audit';

await logEvent({
  action: 'ticket.created',
  entityType: 'ticket',
  entityId: 'TCK-12345',
  newValues: { status: 'NEW' },
});
```

### System/Automation Action

```typescript
import { logEvent, withSystemActor } from '@/lib/audit';

await withSystemActor(async () => {
  await logEvent({
    action: 'ai.classified',
    entityType: 'ticket',
    entityId: 'TCK-12345',
    metadata: { confidence: 0.89 },
  });
});
```

---

## 🎯 Common Patterns

### Ticket Created
```typescript
await logEvent({
  action: 'ticket.created',
  entityType: 'ticket',
  entityId: ticket.ticketNumber,
  newValues: { title, status, priority },
});
```

### Status Changed
```typescript
await logEvent({
  action: 'status.changed',
  entityType: 'ticket',
  entityId: ticket.ticketNumber,
  prevValues: { status: oldStatus },
  newValues: { status: newStatus },
});
```

### Comment Added
```typescript
await logEvent({
  action: 'ticket.commented',
  entityType: 'ticket',
  entityId: ticket.ticketNumber,
  targetId: comment.id,
  metadata: { visibility: 'internal' },
});
```

### Email Received (Webhook)
```typescript
await withSystemActor(async () => {
  await logEvent({
    action: 'email.inbound.received',
    actorType: 'service',
    entityType: 'email',
    entityId: message.id,
    metadata: { from, subject },
    redactionLevel: 1,
  });
});
```

### AI Classification
```typescript
await withSystemActor(async () => {
  await logEvent({
    action: 'ai.classified',
    entityType: 'ticket',
    entityId: ticketId,
    metadata: { category, confidence },
  });
});
```

### Login
```typescript
await logEvent({
  action: 'login.success',
  actorEmail: email,
  actorType: 'human',
  entityType: 'user',
  entityId: email,
});
```

### Setting Changed
```typescript
await logEvent({
  action: 'setting.changed',
  entityType: 'setting',
  entityId: settingKey,
  prevValues: { value: oldValue },
  newValues: { value: newValue },
  redactionLevel: 2,
});
```

---

## 🔍 Querying

### API
```bash
GET /api/admin/audit?startDate=2025-01-01&action=ticket.created&limit=100
```

### Export
```bash
GET /api/admin/audit/export?format=jsonl&startDate=2025-01-01
GET /api/admin/audit/export?format=csv&entityType=ticket
```

### Verify Chain
```bash
POST /api/admin/audit/verify
{
  "startDate": "2025-01-01T00:00:00Z",
  "endDate": "2025-01-31T23:59:59Z"
}
```

---

## 🛡️ Actor Types

| Type | When to Use | Example |
|------|-------------|---------|
| `human` | User actions via UI/API | Ticket creation, comments |
| `system` | Automated rules, AI, cron | Auto-assignment, AI classification |
| `service` | External webhooks, integrations | Inbound email, OAuth refresh |

**Note:** `system` and `service` automatically use `admin@surterreproperties.com` as actor.

---

## 🔐 Redaction Levels

| Level | Use Case | Redaction |
|-------|----------|-----------|
| 0 | Internal admin actions | None |
| 1 | Most user actions | Hash emails, mask tokens |
| 2 | External/public data | Domain-only emails, full mask |

Default: **Level 1**

---

## 📊 Event Types Reference

### Ticket
`ticket.created`, `ticket.updated`, `ticket.assigned`, `ticket.reassigned`, `ticket.commented`, `ticket.closed`, `ticket.deleted`

### Status & Priority
`status.changed`, `priority.changed`

### Email
`email.inbound.received`, `email.outbound.sent`, `email.outbound.failed`

### AI
`ai.classified`, `ai.autoreply`, `ai.autoclose`

### Security
`login.success`, `login.failed`, `role.changed`, `user.created`, `user.disabled`

### Admin
`setting.changed`, `export.requested`, `export.completed`

### Integrations
`graph.api.call`, `webhook.delivered`, `msal.refresh`

---

## 🧪 Testing

### Run Tests
```bash
npm test __tests__/audit/
```

### Seed Data
```bash
npx ts-node prisma/seeds/audit-log-seed.ts
```

### View in UI
```
http://localhost:3000/admin/audit
```

---

## ⚠️ Important Rules

1. **Never UPDATE or DELETE** audit_log entries (database will reject)
2. **Always use `withSystemActor()`** for automations/webhooks/cron
3. **Set `redactionLevel`** appropriately (default is 1)
4. **Provide `requestId`** for idempotency if needed
5. **Failed events go to DLQ** automatically - check periodically

---

## 📚 Full Documentation

- **Complete Reference:** `/docs/AUDIT_LOG.md`
- **Integration Guide:** `/docs/AUDIT_INTEGRATION_GUIDE.md`
- **Summary:** `/docs/AUDIT_LOG_SUMMARY.md`

---

## 🆘 Troubleshooting

### Events not appearing?
- Check `AUDIT_ENABLED=true` in `.env`
- Check `audit_log_dlq` table for failures

### "UPDATE not allowed" error?
- This is correct! Audit log is append-only
- Create a new compensating entry instead

### Chain verification failed?
- Check `audit_chain_verification` table
- Investigate `firstFailureId` entry
- Look for unauthorized database access

---

**System Actor:** `admin@surterreproperties.com`
**Admin UI:** `/admin/audit`
**API Prefix:** `/api/admin/audit`
