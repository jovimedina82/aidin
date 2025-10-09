/**
 * Core audit logging implementation for AIDIN Helpdesk
 * Production-grade with hash chain, idempotency, and DLQ
 */

import { PrismaClient } from '@/lib/generated/prisma';
import { randomUUID } from 'crypto';
import type { AuditEvent, ActorType, EntityType } from './types';
import { SYSTEM_ACTOR, REDACTION_POLICIES } from './types';
import { redactData, sanitizeMetadata, redactIP } from './redaction';
import { computeEntryHash } from './hash';
import {
  getAuditContext,
  resolveActor,
  getRequestId,
  getCorrelationId,
} from './context';

const prisma = new PrismaClient();

/**
 * Main audit logging function
 * Handles actor resolution, redaction, hash chaining, and idempotency
 */
export async function logEvent(event: AuditEvent): Promise<void> {
  try {
    // Normalize and enrich event
    const enrichedEvent = enrichEvent(event);

    // Validate event
    validateEvent(enrichedEvent);

    // Apply redaction
    const redactedEvent = applyRedaction(enrichedEvent);

    // Get last hash for chain continuity
    const lastEntry = await getLastAuditEntry();
    const prevHash = lastEntry?.hash || null;

    // Prepare entry for insertion
    const entry = {
      id: randomUUID(),
      ts: new Date(enrichedEvent.ts!),
      action: enrichedEvent.action,
      actorId: enrichedEvent.actorId || null,
      actorEmail: enrichedEvent.actorEmail!,
      actorType: enrichedEvent.actorType!,
      impersonatedUser: enrichedEvent.impersonatedUser || null,
      entityType: enrichedEvent.entityType,
      entityId: enrichedEvent.entityId,
      targetId: enrichedEvent.targetId || null,
      requestId: enrichedEvent.requestId || null,
      correlationId: enrichedEvent.correlationId || null,
      ip: enrichedEvent.ip || null,
      userAgent: enrichedEvent.userAgent || null,
      prevValues: redactedEvent.prevValues
        ? JSON.stringify(redactedEvent.prevValues)
        : null,
      newValues: redactedEvent.newValues
        ? JSON.stringify(redactedEvent.newValues)
        : null,
      metadata: redactedEvent.metadata
        ? JSON.stringify(redactedEvent.metadata)
        : null,
      redactionLevel: enrichedEvent.redactionLevel || 0,
      prevHash,
      hash: '', // Will be computed next
    };

    // Compute hash
    entry.hash = computeEntryHash(entry, prevHash);

    // Insert into database (with idempotency handling)
    await insertAuditEntry(entry);
  } catch (error) {
    // Log to DLQ if insertion fails
    await logToDLQ(event, error);

    // Re-throw in development for visibility
    if (process.env.NODE_ENV === 'development') {
      console.error('Audit log error:', error);
    }
  }
}

/**
 * Enrich event with context and defaults
 */
function enrichEvent(event: AuditEvent): Required<AuditEvent> {
  const context = getAuditContext();
  const actor = resolveActor();

  // Determine actor - prioritize event data, then context, then system default
  let actorEmail = event.actorEmail || context.actorEmail;
  let actorId = event.actorId !== undefined ? event.actorId : context.actorId;
  let actorType = event.actorType || context.actorType;

  // FORCE system actor for automations/service contexts
  if (
    context.isSystemContext ||
    !actorEmail ||
    actorType === 'system' ||
    actorType === 'service'
  ) {
    actorEmail = SYSTEM_ACTOR.email;
    actorType = actorType || SYSTEM_ACTOR.type;
    actorId = null;
  }

  return {
    action: event.action,
    actorId: actorId || null,
    actorEmail: actorEmail!,
    actorType: actorType!,
    impersonatedUser: event.impersonatedUser || null,
    entityType: event.entityType,
    entityId: event.entityId,
    targetId: event.targetId || null,
    requestId: event.requestId || context.requestId || getRequestId(),
    correlationId:
      event.correlationId || context.correlationId || getCorrelationId(),
    ip: event.ip || context.ip || null,
    userAgent: event.userAgent || context.userAgent || null,
    prevValues: event.prevValues || null,
    newValues: event.newValues || null,
    metadata: event.metadata || null,
    redactionLevel: event.redactionLevel ?? 1, // Default to moderate redaction
    ts: event.ts ? new Date(event.ts).toISOString() : new Date().toISOString(),
  };
}

/**
 * Validate event data
 */
function validateEvent(event: Required<AuditEvent>): void {
  if (!event.action) {
    throw new Error('Audit event must have an action');
  }

  if (!event.actorEmail) {
    throw new Error('Audit event must have an actorEmail');
  }

  if (!event.actorType) {
    throw new Error('Audit event must have an actorType');
  }

  if (!['human', 'system', 'service'].includes(event.actorType)) {
    throw new Error('Invalid actorType: must be human, system, or service');
  }

  if (!event.entityType) {
    throw new Error('Audit event must have an entityType');
  }

  if (!event.entityId) {
    throw new Error('Audit event must have an entityId');
  }

  const validEntityTypes = [
    'ticket',
    'comment',
    'message',
    'user',
    'attachment',
    'setting',
    'integration',
    'rule',
    'email',
  ];
  if (!validEntityTypes.includes(event.entityType)) {
    throw new Error(`Invalid entityType: ${event.entityType}`);
  }
}

/**
 * Apply redaction policies
 */
function applyRedaction(event: Required<AuditEvent>): Required<AuditEvent> {
  const level = event.redactionLevel;

  return {
    ...event,
    ip: event.ip ? redactIP(event.ip, level) : null,
    prevValues: event.prevValues ? redactData(event.prevValues, level) : null,
    newValues: event.newValues ? redactData(event.newValues, level) : null,
    metadata: event.metadata
      ? sanitizeMetadata(event.metadata as Record<string, unknown>, level)
      : null,
  };
}

/**
 * Get the last audit entry for hash chaining
 */
async function getLastAuditEntry() {
  return await prisma.auditLog.findFirst({
    orderBy: { ts: 'desc' },
    select: { id: true, hash: true },
  });
}

/**
 * Insert audit entry with idempotency
 */
async function insertAuditEntry(entry: {
  id: string;
  ts: Date;
  action: string;
  actorId: string | null;
  actorEmail: string;
  actorType: string;
  impersonatedUser: string | null;
  entityType: string;
  entityId: string;
  targetId: string | null;
  requestId: string | null;
  correlationId: string | null;
  ip: string | null;
  userAgent: string | null;
  prevValues: string | null;
  newValues: string | null;
  metadata: string | null;
  redactionLevel: number;
  prevHash: string | null;
  hash: string;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: entry,
    });
  } catch (error: any) {
    // Check for unique constraint violation (idempotency - duplicate request_id)
    if (
      error.code === 'P2002' &&
      error.meta?.target?.includes('request_id')
    ) {
      // This is an idempotent duplicate, silently ignore
      return;
    }

    // Re-throw other errors
    throw error;
  }
}

/**
 * Log failed events to dead letter queue
 */
async function logToDLQ(event: AuditEvent, error: unknown): Promise<void> {
  try {
    await prisma.auditLogDLQ.create({
      data: {
        id: randomUUID(),
        error: error instanceof Error ? error.message : String(error),
        eventData: JSON.stringify(event),
        retryCount: 0,
        resolved: false,
      },
    });
  } catch (dlqError) {
    // Last resort: log to console
    console.error('Failed to log to DLQ:', dlqError);
    console.error('Original event:', event);
    console.error('Original error:', error);
  }
}

/**
 * Batch log multiple events (for bulk operations)
 */
export async function logEventBatch(events: AuditEvent[]): Promise<void> {
  for (const event of events) {
    await logEvent(event);
  }
}

/**
 * Query audit log with filters
 */
export async function queryAuditLog(filters: {
  startDate?: Date;
  endDate?: Date;
  actions?: string[];
  actorEmail?: string;
  actorType?: ActorType;
  entityType?: EntityType;
  entityId?: string;
  limit?: number;
  offset?: number;
}) {
  const where: any = {};

  if (filters.startDate || filters.endDate) {
    where.ts = {};
    if (filters.startDate) {
      where.ts.gte = filters.startDate;
    }
    if (filters.endDate) {
      where.ts.lte = filters.endDate;
    }
  }

  if (filters.actions && filters.actions.length > 0) {
    where.action = { in: filters.actions };
  }

  if (filters.actorEmail) {
    where.actorEmail = filters.actorEmail;
  }

  if (filters.actorType) {
    where.actorType = filters.actorType;
  }

  if (filters.entityType) {
    where.entityType = filters.entityType;
  }

  if (filters.entityId) {
    where.entityId = filters.entityId;
  }

  return await prisma.auditLog.findMany({
    where,
    orderBy: { ts: 'desc' },
    take: filters.limit || 100,
    skip: filters.offset || 0,
  });
}

/**
 * Get audit log count
 */
export async function getAuditLogCount(filters: {
  startDate?: Date;
  endDate?: Date;
  actions?: string[];
  actorEmail?: string;
  entityType?: EntityType;
  entityId?: string;
}) {
  const where: any = {};

  if (filters.startDate || filters.endDate) {
    where.ts = {};
    if (filters.startDate) {
      where.ts.gte = filters.startDate;
    }
    if (filters.endDate) {
      where.ts.lte = filters.endDate;
    }
  }

  if (filters.actions) {
    where.action = { in: filters.actions };
  }

  if (filters.actorEmail) {
    where.actorEmail = filters.actorEmail;
  }

  if (filters.entityType) {
    where.entityType = filters.entityType;
  }

  if (filters.entityId) {
    where.entityId = filters.entityId;
  }

  return await prisma.auditLog.count({ where });
}
