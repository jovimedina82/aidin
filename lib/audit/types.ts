/**
 * Production-Grade Audit Log Types for AIDIN Helpdesk
 * Organization: Surterre Properties (surterreproperties.com)
 */

export type ActorType = 'human' | 'system' | 'service';

export type EntityType =
  | 'ticket'
  | 'comment'
  | 'message'
  | 'user'
  | 'attachment'
  | 'setting'
  | 'integration'
  | 'rule'
  | 'email';

export type RedactionLevel = 0 | 1 | 2;

/**
 * Audit event action types - comprehensive coverage
 */
export type AuditAction =
  // Ticket lifecycle
  | 'ticket.received'
  | 'ticket.created'
  | 'ticket.opened'
  | 'ticket.updated'
  | 'ticket.assigned'
  | 'ticket.reassigned'
  | 'ticket.commented'
  | 'ticket.closed'
  | 'ticket.deleted'
  | 'ticket.restored'
  | 'ticket.merged'
  | 'ticket.split'
  // Workflow & ownership
  | 'assignment.taken'
  | 'assignment.released'
  | 'status.changed'
  | 'priority.changed'
  | 'tag.added'
  | 'tag.removed'
  | 'group.changed'
  | 'attachment.added'
  | 'attachment.removed'
  // Email
  | 'email.inbound.received'
  | 'email.outbound.sent'
  | 'email.outbound.failed'
  | 'email.reply.threaded'
  // AI & Automations
  | 'ai.classified'
  | 'ai.reply.sent'
  | 'ai.autoclose'
  | 'ai.autoreply'
  | 'rule.executed'
  | 'schedule.triggered'
  | 'webhook.delivered'
  | 'webhook.failed'
  // Security & Admin
  | 'login.success'
  | 'login.failed'
  | 'role.changed'
  | 'user.created'
  | 'user.disabled'
  | 'user.enabled'
  | 'setting.changed'
  | 'export.requested'
  | 'export.completed'
  | 'api.token.created'
  | 'api.token.rotated'
  | 'api.token.revoked'
  // Integrations
  | 'graph.api.call'
  | 'oauth2.assertion'
  | 'msal.refresh'
  // Audit system
  | 'audit.chain.warning'
  | 'audit.chain.verified';

/**
 * Core audit event structure
 */
export interface AuditEvent {
  action: AuditAction | string; // Allow custom actions beyond typed ones
  actorId?: string | null;
  actorEmail?: string | null; // Defaults to system actor if missing in automation context
  actorType?: ActorType;      // Defaults to 'system' for jobs/automations
  impersonatedUser?: string | null;
  entityType: EntityType;
  entityId: string;
  targetId?: string | null;
  requestId?: string | null;
  correlationId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  prevValues?: unknown;
  newValues?: unknown;
  metadata?: Record<string, unknown> | null;
  redactionLevel?: RedactionLevel;
  ts?: string | Date; // Will be normalized to UTC ISO-8601
}

/**
 * Stored audit log entry with hash chain
 */
export interface AuditLogEntry {
  id: string;
  ts: Date;
  action: string;
  actorId: string | null;
  actorEmail: string;
  actorType: ActorType;
  impersonatedUser: string | null;
  entityType: EntityType;
  entityId: string;
  targetId: string | null;
  requestId: string | null;
  correlationId: string | null;
  ip: string | null;
  userAgent: string | null;
  prevValues: string | null; // JSON string
  newValues: string | null;  // JSON string
  metadata: string | null;   // JSON string
  redactionLevel: RedactionLevel;
  prevHash: string | null;
  hash: string;
}

/**
 * Audit log filter parameters for queries
 */
export interface AuditLogFilters {
  startDate?: Date | string;
  endDate?: Date | string;
  actions?: string[];
  actorEmail?: string;
  actorType?: ActorType;
  entityType?: EntityType;
  entityId?: string;
  correlationId?: string;
  requestId?: string;
  searchTerm?: string; // Free-text search in metadata
  limit?: number;
  offset?: number;
  orderBy?: 'ts' | 'action' | 'actor_email';
  orderDir?: 'asc' | 'desc';
}

/**
 * Chain verification result
 */
export interface ChainVerificationResult {
  status: 'valid' | 'invalid' | 'partial';
  totalEntries: number;
  verifiedEntries: number;
  firstFailureId?: string;
  firstFailureTs?: Date;
  details?: {
    expectedHash?: string;
    actualHash?: string;
    brokenAt?: string;
  };
}

/**
 * Dead letter queue entry
 */
export interface AuditDLQEntry {
  id: string;
  failedAt: Date;
  error: string;
  retryCount: number;
  lastRetryAt: Date | null;
  eventData: string; // JSON of failed AuditEvent
  resolved: boolean;
  resolvedAt: Date | null;
}

/**
 * System actor constants for Surterre Properties
 */
export const SYSTEM_ACTOR = {
  email: 'admin@surterreproperties.com',
  type: 'system' as ActorType,
} as const;

/**
 * Redaction policy levels
 */
export const REDACTION_POLICIES = {
  NONE: 0,       // No redaction - store as-is
  MODERATE: 1,   // Hash email local parts, mask tokens, truncate bodies
  AGGRESSIVE: 2, // Domain-only emails, mask phone numbers, never store secrets
} as const;
