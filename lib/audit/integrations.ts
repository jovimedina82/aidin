/**
 * Audit Log Integration Examples for AIDIN Helpdesk
 * Shows where and how to call logEvent() in ticket/email/AI handlers
 */

import { logEvent, withSystemActor } from '@/lib/audit';

/**
 * TICKET HANDLERS
 */

// Example: Ticket creation
export async function auditTicketCreated(ticketId: string, ticket: any, requesterId: string) {
  await logEvent({
    action: 'ticket.created',
    entityType: 'ticket',
    entityId: ticketId,
    newValues: {
      title: ticket.title,
      status: ticket.status,
      priority: ticket.priority,
      category: ticket.category,
    },
    metadata: {
      source: ticket.source || 'web',
      department: ticket.departmentId,
    },
  });
}

// Example: Ticket assignment (automated via round-robin)
export async function auditTicketAutoAssigned(
  ticketId: string,
  assigneeEmail: string,
  rule: string
) {
  await withSystemActor(async () => {
    await logEvent({
      action: 'assignment.taken',
      entityType: 'ticket',
      entityId: ticketId,
      prevValues: { assignee: null },
      newValues: { assignee: assigneeEmail },
      metadata: {
        rule,
        automated: true,
      },
    });
  });
}

// Example: Ticket status change
export async function auditTicketStatusChanged(
  ticketId: string,
  oldStatus: string,
  newStatus: string,
  userId?: string
) {
  await logEvent({
    action: 'status.changed',
    entityType: 'ticket',
    entityId: ticketId,
    prevValues: { status: oldStatus },
    newValues: { status: newStatus },
    metadata: {
      transition: `${oldStatus} -> ${newStatus}`,
    },
  });
}

// Example: Comment added
export async function auditCommentAdded(
  ticketId: string,
  commentId: string,
  isPublic: boolean,
  contentPreview: string
) {
  await logEvent({
    action: 'ticket.commented',
    entityType: 'ticket',
    entityId: ticketId,
    targetId: commentId,
    metadata: {
      visibility: isPublic ? 'public' : 'internal',
      commentPreview: contentPreview.substring(0, 100),
    },
  });
}

/**
 * EMAIL HANDLERS
 */

// Example: Inbound email received (service/webhook)
export async function auditEmailInbound(messageId: string, from: string, subject: string, threadId?: string) {
  await withSystemActor(async () => {
    await logEvent({
      action: 'email.inbound.received',
      actorType: 'service',
      entityType: 'email',
      entityId: messageId,
      metadata: {
        from,
        subject,
        threadId,
        source: 'microsoft_graph',
      },
      redactionLevel: 1, // Redact email addresses
    });
  });
}

// Example: Outbound email sent
export async function auditEmailOutbound(
  messageId: string,
  ticketId: string,
  to: string,
  subject: string,
  success: boolean,
  error?: string
) {
  await logEvent({
    action: success ? 'email.outbound.sent' : 'email.outbound.failed',
    entityType: 'email',
    entityId: messageId,
    targetId: ticketId,
    metadata: {
      to,
      subject,
      error,
    },
    redactionLevel: 1,
  });
}

/**
 * AI/AUTOMATION HANDLERS
 */

// Example: AI classification
export async function auditAIClassification(
  ticketId: string,
  suggestedCategory: string,
  confidence: number,
  keywords: string[]
) {
  await withSystemActor(async () => {
    await logEvent({
      action: 'ai.classified',
      entityType: 'ticket',
      entityId: ticketId,
      metadata: {
        model: 'gpt-4',
        suggestedCategory,
        confidence,
        keywords,
      },
    });
  });
}

// Example: AI auto-reply sent
export async function auditAIAutoReply(ticketId: string, messageId: string, prompt: string) {
  await withSystemActor(async () => {
    await logEvent({
      action: 'ai.autoreply',
      entityType: 'ticket',
      entityId: ticketId,
      targetId: messageId,
      metadata: {
        model: 'gpt-4',
        promptLength: prompt.length,
      },
      redactionLevel: 1,
    });
  });
}

// Example: AI auto-close
export async function auditAIAutoClose(ticketId: string, reason: string) {
  await withSystemActor(async () => {
    await logEvent({
      action: 'ai.autoclose',
      entityType: 'ticket',
      entityId: ticketId,
      prevValues: { status: 'OPEN' },
      newValues: { status: 'SOLVED' },
      metadata: {
        reason,
        automated: true,
      },
    });
  });
}

// Example: Scheduled job/cron
export async function auditScheduledJob(jobName: string, result: 'success' | 'failure', details: any) {
  await withSystemActor(async () => {
    await logEvent({
      action: 'schedule.triggered',
      entityType: 'integration',
      entityId: jobName,
      metadata: {
        result,
        details,
        timestamp: new Date().toISOString(),
      },
    });
  });
}

/**
 * SECURITY/ADMIN HANDLERS
 */

// Example: User login
export async function auditLogin(email: string, success: boolean, ip: string, userAgent: string) {
  await logEvent({
    action: success ? 'login.success' : 'login.failed',
    actorEmail: email,
    actorType: 'human',
    entityType: 'user',
    entityId: email,
    ip,
    userAgent,
    metadata: {
      method: 'password',
    },
  });
}

// Example: Role change
export async function auditRoleChange(
  userId: string,
  userEmail: string,
  oldRoles: string[],
  newRoles: string[]
) {
  await logEvent({
    action: 'role.changed',
    entityType: 'user',
    entityId: userId,
    prevValues: { roles: oldRoles },
    newValues: { roles: newRoles },
    metadata: {
      addedRoles: newRoles.filter(r => !oldRoles.includes(r)),
      removedRoles: oldRoles.filter(r => !newRoles.includes(r)),
    },
  });
}

// Example: Setting changed
export async function auditSettingChange(
  settingKey: string,
  oldValue: any,
  newValue: any
) {
  await logEvent({
    action: 'setting.changed',
    entityType: 'setting',
    entityId: settingKey,
    prevValues: { value: oldValue },
    newValues: { value: newValue },
    redactionLevel: 2, // Aggressive redaction for settings
  });
}

// Example: Export/data access
export async function auditDataExport(
  exportType: string,
  filters: Record<string, any>,
  recordCount: number
) {
  await logEvent({
    action: 'export.requested',
    entityType: 'setting',
    entityId: exportType,
    metadata: {
      filters,
      recordCount,
      format: 'csv',
    },
  });
}

/**
 * INTEGRATION HANDLERS
 */

// Example: Microsoft Graph API call
export async function auditGraphAPICall(
  endpoint: string,
  method: string,
  success: boolean,
  statusCode: number
) {
  await withSystemActor(async () => {
    await logEvent({
      action: 'graph.api.call',
      entityType: 'integration',
      entityId: 'microsoft_graph',
      metadata: {
        endpoint,
        method,
        success,
        statusCode,
      },
    });
  });
}

// Example: OAuth2 token refresh
export async function auditOAuthRefresh(provider: string, success: boolean) {
  await withSystemActor(async () => {
    await logEvent({
      action: 'msal.refresh',
      actorType: 'service',
      entityType: 'integration',
      entityId: provider,
      metadata: {
        success,
        timestamp: new Date().toISOString(),
      },
    });
  });
}
