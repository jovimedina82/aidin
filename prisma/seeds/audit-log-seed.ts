/**
 * Audit Log Seed Script
 * Creates example audit events for development and testing
 */

import { logEvent, withSystemActor } from '@/lib/audit';

export async function seedAuditLog() {
  console.log('🌱 Seeding audit log with example events...');

  // 1. SYSTEM EVENTS - Automated assignment
  console.log('  Creating system events (automated assignment)...');
  await withSystemActor(async () => {
    await logEvent({
      action: 'assignment.taken',
      actorType: 'system',
      actorEmail: 'admin@surterreproperties.com',
      entityType: 'ticket',
      entityId: 'TCK-34219',
      metadata: {
        rule: 'round_robin_v2',
        assignee: 'sara@surterreproperties.com',
      },
      prevValues: { assignee: null },
      newValues: { assignee: 'sara@surterreproperties.com' },
    });
  });

  // 2. SERVICE EVENTS - Inbound email
  console.log('  Creating service events (inbound email)...');
  await withSystemActor(async () => {
    await logEvent({
      action: 'email.inbound.received',
      actorType: 'service',
      actorEmail: 'admin@surterreproperties.com',
      entityType: 'email',
      entityId: 'msg_9f3a',
      metadata: {
        from: 'user@gmail.com',
        subject: "Can't print",
        threadId: 'm-123',
        messageId: '<abc@outlook>',
      },
      redactionLevel: 1,
    });
  });

  // 3. HUMAN EVENTS - Agent comment
  console.log('  Creating human events (agent comment)...');
  await logEvent({
    action: 'ticket.commented',
    actorType: 'human',
    actorEmail: 'tech1@surterreproperties.com',
    actorId: 'user-tech1',
    entityType: 'ticket',
    entityId: 'TCK-34219',
    targetId: 'cmt_77a2',
    metadata: {
      visibility: 'internal',
    },
    newValues: {
      commentPreview: 'User says printer shows error 14…',
    },
  });

  // 4. Ticket creation
  console.log('  Creating ticket lifecycle events...');
  await logEvent({
    action: 'ticket.created',
    actorType: 'human',
    actorEmail: 'john.doe@surterreproperties.com',
    actorId: 'user-john',
    entityType: 'ticket',
    entityId: 'TCK-34220',
    newValues: {
      title: 'Printer not working',
      status: 'NEW',
      priority: 'NORMAL',
      category: 'IT',
    },
    metadata: {
      source: 'web',
      department: 'IT',
    },
  });

  // 5. AI Classification
  console.log('  Creating AI events...');
  await withSystemActor(async () => {
    await logEvent({
      action: 'ai.classified',
      entityType: 'ticket',
      entityId: 'TCK-34220',
      metadata: {
        model: 'gpt-4',
        suggestedCategory: 'IT',
        confidence: 0.89,
        keywords: ['printer', 'error', 'hardware'],
      },
    });
  });

  // 6. Status change
  await logEvent({
    action: 'status.changed',
    actorType: 'human',
    actorEmail: 'sara@surterreproperties.com',
    actorId: 'user-sara',
    entityType: 'ticket',
    entityId: 'TCK-34220',
    prevValues: { status: 'NEW' },
    newValues: { status: 'OPEN' },
    metadata: {
      transition: 'NEW -> OPEN',
    },
  });

  // 7. Outbound email
  await logEvent({
    action: 'email.outbound.sent',
    actorType: 'human',
    actorEmail: 'sara@surterreproperties.com',
    entityType: 'email',
    entityId: 'msg_out_001',
    targetId: 'TCK-34220',
    metadata: {
      to: 'john.doe@surterreproperties.com',
      subject: 'Re: Printer not working',
    },
    redactionLevel: 1,
  });

  // 8. AI auto-reply
  console.log('  Creating AI auto-reply event...');
  await withSystemActor(async () => {
    await logEvent({
      action: 'ai.autoreply',
      entityType: 'ticket',
      entityId: 'TCK-34221',
      targetId: 'msg_auto_001',
      metadata: {
        model: 'gpt-4',
        promptLength: 450,
      },
      redactionLevel: 1,
    });
  });

  // 9. Ticket resolved
  await logEvent({
    action: 'ticket.closed',
    actorType: 'human',
    actorEmail: 'sara@surterreproperties.com',
    actorId: 'user-sara',
    entityType: 'ticket',
    entityId: 'TCK-34220',
    prevValues: { status: 'OPEN' },
    newValues: { status: 'SOLVED' },
    metadata: {
      resolutionTime: 3600,
      satisfaction: 5,
    },
  });

  // 10. Login events
  console.log('  Creating security events...');
  await logEvent({
    action: 'login.success',
    actorType: 'human',
    actorEmail: 'admin@surterreproperties.com',
    actorId: 'user-admin',
    entityType: 'user',
    entityId: 'admin@surterreproperties.com',
    ip: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    metadata: {
      method: 'password',
    },
  });

  await logEvent({
    action: 'login.failed',
    actorType: 'human',
    actorEmail: 'unknown@example.com',
    entityType: 'user',
    entityId: 'unknown@example.com',
    ip: '203.0.113.42',
    userAgent: 'Mozilla/5.0',
    metadata: {
      method: 'password',
      reason: 'invalid_credentials',
    },
  });

  // 11. Role change
  await logEvent({
    action: 'role.changed',
    actorType: 'human',
    actorEmail: 'admin@surterreproperties.com',
    actorId: 'user-admin',
    entityType: 'user',
    entityId: 'user-new-staff',
    prevValues: { roles: ['Requester'] },
    newValues: { roles: ['Requester', 'Staff'] },
    metadata: {
      addedRoles: ['Staff'],
      removedRoles: [],
    },
  });

  // 12. Setting change
  await logEvent({
    action: 'setting.changed',
    actorType: 'human',
    actorEmail: 'admin@surterreproperties.com',
    actorId: 'user-admin',
    entityType: 'setting',
    entityId: 'auto_assignment_enabled',
    prevValues: { value: false },
    newValues: { value: true },
    redactionLevel: 2,
  });

  // 13. Integration events
  console.log('  Creating integration events...');
  await withSystemActor(async () => {
    await logEvent({
      action: 'graph.api.call',
      entityType: 'integration',
      entityId: 'microsoft_graph',
      metadata: {
        endpoint: '/me/messages',
        method: 'GET',
        success: true,
        statusCode: 200,
      },
    });
  });

  await withSystemActor(async () => {
    await logEvent({
      action: 'msal.refresh',
      actorType: 'service',
      entityType: 'integration',
      entityId: 'azure_ad',
      metadata: {
        success: true,
        timestamp: new Date().toISOString(),
      },
    });
  });

  // 14. Scheduled job
  await withSystemActor(async () => {
    await logEvent({
      action: 'schedule.triggered',
      entityType: 'integration',
      entityId: 'ticket_cleanup_job',
      metadata: {
        result: 'success',
        details: {
          ticketsProcessed: 42,
          ticketsArchived: 15,
        },
        timestamp: new Date().toISOString(),
      },
    });
  });

  // 15. Export request
  await logEvent({
    action: 'export.requested',
    actorType: 'human',
    actorEmail: 'admin@surterreproperties.com',
    actorId: 'user-admin',
    entityType: 'setting',
    entityId: 'ticket_export',
    metadata: {
      format: 'csv',
      filters: {
        startDate: '2025-01-01',
        endDate: '2025-01-31',
      },
      recordCount: 150,
    },
  });

  // 16. Attachment added
  await logEvent({
    action: 'attachment.added',
    actorType: 'human',
    actorEmail: 'john.doe@surterreproperties.com',
    actorId: 'user-john',
    entityType: 'ticket',
    entityId: 'TCK-34220',
    targetId: 'att_001',
    metadata: {
      fileName: 'screenshot.png',
      fileSize: 152400,
      mimeType: 'image/png',
    },
  });

  // 17. Priority change
  await logEvent({
    action: 'priority.changed',
    actorType: 'human',
    actorEmail: 'sara@surterreproperties.com',
    actorId: 'user-sara',
    entityType: 'ticket',
    entityId: 'TCK-34220',
    prevValues: { priority: 'NORMAL' },
    newValues: { priority: 'HIGH' },
    metadata: {
      reason: 'affecting_multiple_users',
    },
  });

  // 18. Webhook event
  await withSystemActor(async () => {
    await logEvent({
      action: 'webhook.delivered',
      actorType: 'service',
      entityType: 'integration',
      entityId: 'slack_notifications',
      metadata: {
        url: 'https://hooks.slack.com/services/...',
        event: 'ticket.created',
        statusCode: 200,
        responseTime: 245,
      },
    });
  });

  // 19. AI auto-close
  await withSystemActor(async () => {
    await logEvent({
      action: 'ai.autoclose',
      entityType: 'ticket',
      entityId: 'TCK-34222',
      prevValues: { status: 'PENDING' },
      newValues: { status: 'SOLVED' },
      metadata: {
        reason: 'no_response_7_days',
        automated: true,
      },
    });
  });

  // 20. Ticket reassignment
  await logEvent({
    action: 'ticket.reassigned',
    actorType: 'human',
    actorEmail: 'manager@surterreproperties.com',
    actorId: 'user-manager',
    entityType: 'ticket',
    entityId: 'TCK-34220',
    prevValues: { assignee: 'sara@surterreproperties.com' },
    newValues: { assignee: 'tech2@surterreproperties.com' },
    metadata: {
      reason: 'workload_balancing',
    },
  });

  console.log('✅ Audit log seeded with 20 example events');
}

// Run seed if executed directly
if (require.main === module) {
  seedAuditLog()
    .then(() => {
      console.log('Seed complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seed failed:', error);
      process.exit(1);
    });
}
