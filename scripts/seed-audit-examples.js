/**
 * Quick script to seed audit log examples
 * Run: node scripts/seed-audit-examples.js
 */

import { PrismaClient } from '../lib/generated/prisma/index.js';
import crypto from 'crypto';

const prisma = new PrismaClient();

function sha256(data) {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

function canonicalJSON(entry) {
  const canonical = {
    id: entry.id,
    ts: entry.ts instanceof Date ? entry.ts.toISOString() : entry.ts,
    action: entry.action,
    actorId: entry.actorId,
    actorEmail: entry.actorEmail,
    actorType: entry.actorType,
    impersonatedUser: entry.impersonatedUser,
    entityType: entry.entityType,
    entityId: entry.entityId,
    targetId: entry.targetId,
    requestId: entry.requestId,
    correlationId: entry.correlationId,
    ip: entry.ip,
    userAgent: entry.userAgent,
    prevValues: entry.prevValues,
    newValues: entry.newValues,
    metadata: entry.metadata,
    redactionLevel: entry.redactionLevel,
  };
  return JSON.stringify(canonical, Object.keys(canonical).sort());
}

function computeHash(entry, prevHash) {
  const canonical = canonicalJSON(entry);
  const chainedData = (prevHash || '') + canonical;
  return sha256(chainedData);
}

async function getLastHash() {
  const lastEntry = await prisma.auditLog.findFirst({
    orderBy: { ts: 'desc' },
    select: { hash: true },
  });
  return lastEntry?.hash || null;
}

async function createEvent(event) {
  const prevHash = await getLastHash();

  const entry = {
    id: crypto.randomUUID(),
    ts: new Date(),
    action: event.action,
    actorId: event.actorId || null,
    actorEmail: event.actorEmail,
    actorType: event.actorType,
    impersonatedUser: null,
    entityType: event.entityType,
    entityId: event.entityId,
    targetId: event.targetId || null,
    requestId: crypto.randomUUID(),
    correlationId: crypto.randomUUID(),
    ip: event.ip || null,
    userAgent: event.userAgent || null,
    prevValues: event.prevValues ? JSON.stringify(event.prevValues) : null,
    newValues: event.newValues ? JSON.stringify(event.newValues) : null,
    metadata: event.metadata ? JSON.stringify(event.metadata) : null,
    redactionLevel: event.redactionLevel || 1,
    prevHash,
    hash: '',
  };

  entry.hash = computeHash(entry, prevHash);

  await prisma.auditLog.create({ data: entry });
  console.log(`✓ Created: ${event.action} (${event.actorType})`);
}

async function seed() {
  console.log('🌱 Seeding audit log with example events...\n');

  try {
    // 1. System event - automated assignment
    await createEvent({
      action: 'assignment.taken',
      actorEmail: 'admin@surterreproperties.com',
      actorType: 'system',
      entityType: 'ticket',
      entityId: 'TCK-34219',
      prevValues: { assignee: null },
      newValues: { assignee: 'sara@surterreproperties.com' },
      metadata: {
        rule: 'round_robin_v2',
        automated: true,
      },
    });

    // 2. Service event - inbound email
    await createEvent({
      action: 'email.inbound.received',
      actorEmail: 'admin@surterreproperties.com',
      actorType: 'service',
      entityType: 'email',
      entityId: 'msg_9f3a',
      metadata: {
        from: 'user@gmail.com',
        subject: "Can't print",
        threadId: 'm-123',
      },
    });

    // 3. Human event - agent comment
    await createEvent({
      action: 'ticket.commented',
      actorEmail: 'tech1@surterreproperties.com',
      actorType: 'human',
      actorId: 'user-tech1',
      entityType: 'ticket',
      entityId: 'TCK-34219',
      targetId: 'cmt_77a2',
      ip: '192.168.1.100',
      userAgent: 'Mozilla/5.0',
      metadata: {
        visibility: 'internal',
      },
      newValues: {
        commentPreview: 'User says printer shows error 14…',
      },
    });

    // 4. Ticket creation
    await createEvent({
      action: 'ticket.created',
      actorEmail: 'john.doe@surterreproperties.com',
      actorType: 'human',
      actorId: 'user-john',
      entityType: 'ticket',
      entityId: 'TCK-34220',
      ip: '192.168.1.105',
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
    await createEvent({
      action: 'ai.classified',
      actorEmail: 'admin@surterreproperties.com',
      actorType: 'system',
      entityType: 'ticket',
      entityId: 'TCK-34220',
      metadata: {
        model: 'gpt-4',
        suggestedCategory: 'IT',
        confidence: 0.89,
        keywords: ['printer', 'error', 'hardware'],
      },
    });

    // 6. Status change
    await createEvent({
      action: 'status.changed',
      actorEmail: 'sara@surterreproperties.com',
      actorType: 'human',
      actorId: 'user-sara',
      entityType: 'ticket',
      entityId: 'TCK-34220',
      prevValues: { status: 'NEW' },
      newValues: { status: 'OPEN' },
      metadata: {
        transition: 'NEW -> OPEN',
      },
    });

    // 7. Priority change
    await createEvent({
      action: 'priority.changed',
      actorEmail: 'sara@surterreproperties.com',
      actorType: 'human',
      actorId: 'user-sara',
      entityType: 'ticket',
      entityId: 'TCK-34220',
      prevValues: { priority: 'NORMAL' },
      newValues: { priority: 'HIGH' },
      metadata: {
        reason: 'affecting_multiple_users',
      },
    });

    // 8. Ticket closed
    await createEvent({
      action: 'ticket.closed',
      actorEmail: 'sara@surterreproperties.com',
      actorType: 'human',
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

    // 9. Login success
    await createEvent({
      action: 'login.success',
      actorEmail: 'admin@surterreproperties.com',
      actorType: 'human',
      actorId: 'user-admin',
      entityType: 'user',
      entityId: 'admin@surterreproperties.com',
      ip: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      metadata: {
        method: 'password',
      },
    });

    // 10. Setting change
    await createEvent({
      action: 'setting.changed',
      actorEmail: 'admin@surterreproperties.com',
      actorType: 'human',
      actorId: 'user-admin',
      entityType: 'setting',
      entityId: 'auto_assignment_enabled',
      prevValues: { value: false },
      newValues: { value: true },
      redactionLevel: 2,
    });

    // 11. AI auto-reply
    await createEvent({
      action: 'ai.autoreply',
      actorEmail: 'admin@surterreproperties.com',
      actorType: 'system',
      entityType: 'ticket',
      entityId: 'TCK-34221',
      targetId: 'msg_auto_001',
      metadata: {
        model: 'gpt-4',
        promptLength: 450,
      },
    });

    // 12. Role changed
    await createEvent({
      action: 'role.changed',
      actorEmail: 'admin@surterreproperties.com',
      actorType: 'human',
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

    // 13. Attachment added
    await createEvent({
      action: 'attachment.added',
      actorEmail: 'john.doe@surterreproperties.com',
      actorType: 'human',
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

    // 14. Export requested
    await createEvent({
      action: 'export.requested',
      actorEmail: 'admin@surterreproperties.com',
      actorType: 'human',
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

    // 15. Webhook delivered
    await createEvent({
      action: 'webhook.delivered',
      actorEmail: 'admin@surterreproperties.com',
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

    console.log('\n✅ Seeded 15 example audit events!');
    console.log('\n📍 View them at: http://localhost:3000/admin/audit\n');
  } catch (error) {
    console.error('❌ Error seeding audit log:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seed();
