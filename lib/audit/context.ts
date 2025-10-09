/**
 * Async context management for audit logging
 * Tracks request IDs, correlation IDs, and actor context
 */

import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import type { ActorType } from './types';
import { SYSTEM_ACTOR } from './types';

interface AuditContext {
  requestId?: string;
  correlationId?: string;
  actorEmail?: string;
  actorId?: string;
  actorType?: ActorType;
  ip?: string;
  userAgent?: string;
  isSystemContext?: boolean;
}

const asyncLocalStorage = new AsyncLocalStorage<AuditContext>();

/**
 * Get current audit context
 */
export function getAuditContext(): AuditContext {
  return asyncLocalStorage.getStore() || {};
}

/**
 * Set audit context
 */
export function setAuditContext(context: AuditContext): void {
  const existing = getAuditContext();
  asyncLocalStorage.enterWith({ ...existing, ...context });
}

/**
 * Run function with audit context
 */
export function runWithAuditContext<T>(
  context: AuditContext,
  fn: () => T
): T {
  return asyncLocalStorage.run(context, fn);
}

/**
 * Get or generate request ID
 */
export function getRequestId(): string {
  const context = getAuditContext();
  if (context.requestId) {
    return context.requestId;
  }

  const requestId = randomUUID();
  setAuditContext({ requestId });
  return requestId;
}

/**
 * Get or generate correlation ID
 */
export function getCorrelationId(): string {
  const context = getAuditContext();
  if (context.correlationId) {
    return context.correlationId;
  }

  const correlationId = randomUUID();
  setAuditContext({ correlationId });
  return correlationId;
}

/**
 * Mark current context as system/automation
 */
export function markSystemContext(): void {
  setAuditContext({
    isSystemContext: true,
    actorEmail: SYSTEM_ACTOR.email,
    actorType: SYSTEM_ACTOR.type,
  });
}

/**
 * Wrap async function to run in system context
 * Use for automation, jobs, webhooks, cron tasks
 */
export function withSystemActor<T>(fn: () => Promise<T>): Promise<T> {
  const context: AuditContext = {
    isSystemContext: true,
    actorEmail: SYSTEM_ACTOR.email,
    actorType: SYSTEM_ACTOR.type,
    requestId: randomUUID(),
    correlationId: randomUUID(),
  };

  return asyncLocalStorage.run(context, fn);
}

/**
 * Wrap async function to run with specific actor
 */
export function withActor<T>(
  actorEmail: string,
  actorId: string | undefined,
  actorType: ActorType,
  fn: () => Promise<T>
): Promise<T> {
  const context: AuditContext = {
    actorEmail,
    actorId,
    actorType,
    requestId: getRequestId(),
    correlationId: getCorrelationId(),
  };

  return asyncLocalStorage.run(context, fn);
}

/**
 * Extract actor information from current context
 * Falls back to system actor if context indicates automation
 */
export function resolveActor(): {
  actorEmail: string;
  actorId: string | null;
  actorType: ActorType;
} {
  const context = getAuditContext();

  // If explicitly marked as system context or no actor info, use system actor
  if (context.isSystemContext || !context.actorEmail) {
    return {
      actorEmail: SYSTEM_ACTOR.email,
      actorId: null,
      actorType: SYSTEM_ACTOR.type,
    };
  }

  return {
    actorEmail: context.actorEmail,
    actorId: context.actorId || null,
    actorType: context.actorType || 'human',
  };
}
