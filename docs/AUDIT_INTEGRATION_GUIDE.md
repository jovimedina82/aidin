# Audit Log Integration Guide for AIDIN

This guide shows **exactly where** to add `logEvent()` calls in the existing AIDIN codebase.

## 1. Ticket API Routes

### `/app/api/tickets/route.ts` - Create Ticket

```typescript
import { logEvent } from '@/lib/audit';

export async function POST(request: Request) {
  // ... existing ticket creation logic ...

  const ticket = await prisma.ticket.create({ /* ... */ });

  // ADD AUDIT LOG
  await logEvent({
    action: 'ticket.created',
    entityType: 'ticket',
    entityId: ticket.ticketNumber,
    newValues: {
      title: ticket.title,
      status: ticket.status,
      priority: ticket.priority,
      category: ticket.category,
    },
    metadata: {
      source: 'web',
      departmentId: ticket.departmentId,
    },
  });

  return NextResponse.json(ticket);
}
```

### `/app/api/tickets/[id]/route.ts` - Update Ticket

```typescript
import { logEvent } from '@/lib/audit';

export async function PATCH(request: Request, { params }) {
  const oldTicket = await prisma.ticket.findUnique({ where: { id: params.id } });
  const updates = await request.json();

  const ticket = await prisma.ticket.update({
    where: { id: params.id },
    data: updates,
  });

  // ADD AUDIT LOG for status changes
  if (updates.status && updates.status !== oldTicket.status) {
    await logEvent({
      action: 'status.changed',
      entityType: 'ticket',
      entityId: ticket.ticketNumber,
      prevValues: { status: oldTicket.status },
      newValues: { status: ticket.status },
      metadata: {
        transition: `${oldTicket.status} -> ${ticket.status}`,
      },
    });
  }

  // ADD AUDIT LOG for assignment changes
  if (updates.assigneeId && updates.assigneeId !== oldTicket.assigneeId) {
    await logEvent({
      action: oldTicket.assigneeId ? 'ticket.reassigned' : 'ticket.assigned',
      entityType: 'ticket',
      entityId: ticket.ticketNumber,
      prevValues: { assignee: oldTicket.assigneeId },
      newValues: { assignee: ticket.assigneeId },
    });
  }

  // ADD AUDIT LOG for priority changes
  if (updates.priority && updates.priority !== oldTicket.priority) {
    await logEvent({
      action: 'priority.changed',
      entityType: 'ticket',
      entityId: ticket.ticketNumber,
      prevValues: { priority: oldTicket.priority },
      newValues: { priority: ticket.priority },
    });
  }

  return NextResponse.json(ticket);
}
```

## 2. Comment API Routes

### `/app/api/tickets/[id]/comments/route.ts`

```typescript
import { logEvent } from '@/lib/audit';

export async function POST(request: Request, { params }) {
  // ... existing comment creation logic ...

  const comment = await prisma.ticketComment.create({ /* ... */ });

  // ADD AUDIT LOG
  await logEvent({
    action: 'ticket.commented',
    entityType: 'ticket',
    entityId: ticket.ticketNumber,
    targetId: comment.id,
    metadata: {
      visibility: comment.isPublic ? 'public' : 'internal',
      commentPreview: comment.content.substring(0, 100),
    },
  });

  return NextResponse.json(comment);
}
```

## 3. Email Handlers

### Inbound Email Webhook (Microsoft Graph)

```typescript
// /app/api/webhooks/email/route.ts
import { logEvent, withSystemActor } from '@/lib/audit';

export async function POST(request: Request) {
  const notification = await request.json();

  // ... process email ...

  // ADD AUDIT LOG (as system actor)
  await withSystemActor(async () => {
    await logEvent({
      action: 'email.inbound.received',
      actorType: 'service',
      entityType: 'email',
      entityId: message.id,
      metadata: {
        from: message.from.emailAddress.address,
        subject: message.subject,
        threadId: message.conversationId,
        messageId: message.internetMessageId,
      },
      redactionLevel: 1,
    });
  });

  return NextResponse.json({ success: true });
}
```

### Outbound Email

```typescript
// In your sendEmail function
import { logEvent } from '@/lib/audit';

async function sendEmail(to: string, subject: string, body: string, ticketId: string) {
  try {
    const result = await graphClient.api('/me/sendMail').post({ /* ... */ });

    // ADD AUDIT LOG (success)
    await logEvent({
      action: 'email.outbound.sent',
      entityType: 'email',
      entityId: result.id || 'msg-' + Date.now(),
      targetId: ticketId,
      metadata: {
        to,
        subject,
      },
      redactionLevel: 1,
    });
  } catch (error) {
    // ADD AUDIT LOG (failure)
    await logEvent({
      action: 'email.outbound.failed',
      entityType: 'email',
      entityId: 'failed-' + Date.now(),
      targetId: ticketId,
      metadata: {
        to,
        subject,
        error: error.message,
      },
      redactionLevel: 1,
    });
    throw error;
  }
}
```

## 4. AI Classification

### `/app/api/ai/classify/route.ts` or n8n webhook handler

```typescript
import { logEvent, withSystemActor } from '@/lib/audit';

async function classifyTicket(ticketId: string, content: string) {
  const result = await openai.chat.completions.create({ /* ... */ });

  const suggestedCategory = result.choices[0].message.content;

  // ADD AUDIT LOG (as system)
  await withSystemActor(async () => {
    await logEvent({
      action: 'ai.classified',
      entityType: 'ticket',
      entityId: ticketId,
      metadata: {
        model: 'gpt-4',
        suggestedCategory,
        confidence: 0.89, // If available
        keywords: extractedKeywords,
      },
    });
  });

  return suggestedCategory;
}
```

## 5. Auto-Assignment Logic

### Round-robin or rule-based assignment

```typescript
import { logEvent, withSystemActor } from '@/lib/audit';

async function autoAssignTicket(ticketId: string) {
  const assignee = await getRoundRobinAssignee();

  await prisma.ticket.update({
    where: { id: ticketId },
    data: { assigneeId: assignee.id },
  });

  // ADD AUDIT LOG (as system)
  await withSystemActor(async () => {
    await logEvent({
      action: 'assignment.taken',
      entityType: 'ticket',
      entityId: ticketId,
      prevValues: { assignee: null },
      newValues: { assignee: assignee.email },
      metadata: {
        rule: 'round_robin_v2',
        automated: true,
      },
    });
  });
}
```

## 6. Authentication

### `/app/api/auth/[...nextauth]/route.ts`

```typescript
import { logEvent } from '@/lib/audit';

// In your signIn callback
callbacks: {
  async signIn({ user, account, profile }) {
    // ADD AUDIT LOG
    await logEvent({
      action: 'login.success',
      actorEmail: user.email,
      actorType: 'human',
      entityType: 'user',
      entityId: user.email,
      metadata: {
        method: account.provider,
      },
    });

    return true;
  },

  async error({ error }) {
    // ADD AUDIT LOG (login failure)
    await logEvent({
      action: 'login.failed',
      actorEmail: 'unknown',
      actorType: 'human',
      entityType: 'user',
      entityId: 'unknown',
      metadata: {
        error: error.message,
      },
    });
  }
}
```

## 7. User Management

### `/app/api/users/[id]/roles/route.ts`

```typescript
import { logEvent } from '@/lib/audit';

export async function PATCH(request: Request, { params }) {
  const user = await prisma.user.findUnique({
    where: { id: params.id },
    include: { roles: true },
  });

  const { roleIds } = await request.json();

  const oldRoles = user.roles.map(r => r.role.name);

  // ... update roles logic ...

  const newRoles = updatedUser.roles.map(r => r.role.name);

  // ADD AUDIT LOG
  await logEvent({
    action: 'role.changed',
    entityType: 'user',
    entityId: user.id,
    prevValues: { roles: oldRoles },
    newValues: { roles: newRoles },
    metadata: {
      addedRoles: newRoles.filter(r => !oldRoles.includes(r)),
      removedRoles: oldRoles.filter(r => !newRoles.includes(r)),
    },
  });

  return NextResponse.json(updatedUser);
}
```

## 8. Settings/Admin Changes

### `/app/api/admin/settings/route.ts`

```typescript
import { logEvent } from '@/lib/audit';

export async function PATCH(request: Request) {
  const { key, value } = await request.json();

  const oldSetting = await prisma.setting.findUnique({ where: { key } });

  const setting = await prisma.setting.update({
    where: { key },
    data: { value },
  });

  // ADD AUDIT LOG
  await logEvent({
    action: 'setting.changed',
    entityType: 'setting',
    entityId: key,
    prevValues: { value: oldSetting.value },
    newValues: { value: setting.value },
    redactionLevel: 2, // Aggressive for settings
  });

  return NextResponse.json(setting);
}
```

## 9. Attachment Upload

### `/app/api/tickets/[id]/attachments/route.ts`

```typescript
import { logEvent } from '@/lib/audit';

export async function POST(request: Request, { params }) {
  const formData = await request.formData();
  const file = formData.get('file');

  // ... save file logic ...

  const attachment = await prisma.attachment.create({ /* ... */ });

  // ADD AUDIT LOG
  await logEvent({
    action: 'attachment.added',
    entityType: 'ticket',
    entityId: ticket.ticketNumber,
    targetId: attachment.id,
    metadata: {
      fileName: attachment.fileName,
      fileSize: attachment.fileSize,
      mimeType: attachment.mimeType,
    },
  });

  return NextResponse.json(attachment);
}
```

## 10. Scheduled Jobs (Cron/n8n)

### Auto-close stale tickets

```typescript
import { logEvent, withSystemActor } from '@/lib/audit';

async function autoCloseStaleTickets() {
  const staleTickets = await prisma.ticket.findMany({
    where: {
      status: 'PENDING',
      updatedAt: { lt: sevenDaysAgo },
    },
  });

  for (const ticket of staleTickets) {
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: 'SOLVED' },
    });

    // ADD AUDIT LOG (as system)
    await withSystemActor(async () => {
      await logEvent({
        action: 'ai.autoclose',
        entityType: 'ticket',
        entityId: ticket.ticketNumber,
        prevValues: { status: 'PENDING' },
        newValues: { status: 'SOLVED' },
        metadata: {
          reason: 'no_response_7_days',
          automated: true,
        },
      });
    });
  }
}
```

## Quick Checklist

Add `logEvent()` calls to these handlers:

- [ ] `POST /api/tickets` - ticket.created
- [ ] `PATCH /api/tickets/[id]` - status.changed, ticket.assigned, priority.changed
- [ ] `DELETE /api/tickets/[id]` - ticket.deleted
- [ ] `POST /api/tickets/[id]/comments` - ticket.commented
- [ ] `POST /api/tickets/[id]/attachments` - attachment.added
- [ ] Email inbound webhook - email.inbound.received
- [ ] Email send function - email.outbound.sent / email.outbound.failed
- [ ] AI classification - ai.classified
- [ ] AI auto-reply - ai.autoreply
- [ ] AI auto-close - ai.autoclose
- [ ] Auto-assignment - assignment.taken
- [ ] Login success/failure - login.success / login.failed
- [ ] Role changes - role.changed
- [ ] Settings changes - setting.changed
- [ ] Data exports - export.requested

## Testing Integration

After adding audit calls, test with:

```bash
# Seed example events
npx ts-node prisma/seeds/audit-log-seed.ts

# View in UI
open http://localhost:3000/admin/audit

# Verify chain
curl -X POST http://localhost:3000/api/admin/audit/verify \
  -H "Content-Type: application/json" \
  -d '{"startDate":"2025-01-01T00:00:00Z","endDate":"2025-01-08T23:59:59Z"}'
```

## Performance Tips

- Audit logging is **async** - it won't block your handlers
- Failed events go to DLQ automatically
- Use `redactionLevel: 1` for most events
- Use `redactionLevel: 2` for external/public data
- Batch operations with `logEventBatch()` if needed

---

For full documentation, see `/docs/AUDIT_LOG.md`
