/**
 * Hash chain utilities for audit log integrity
 * Implements tamper-evident hash chaining
 */

import crypto from 'crypto';
import type { AuditLogEntry } from './types';

/**
 * Compute canonical JSON representation of audit entry
 * Excludes hash and prevHash fields for consistent hashing
 */
export function canonicalJSON(entry: Partial<AuditLogEntry>): string {
  // Create a copy without hash fields
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

  // Deterministic JSON stringification (sorted keys)
  return JSON.stringify(canonical, Object.keys(canonical).sort());
}

/**
 * Compute SHA-256 hash of a string
 */
export function sha256(data: string): string {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

/**
 * Compute hash for an audit log entry
 * hash = SHA256(prevHash || canonicalJSON(entry))
 */
export function computeEntryHash(
  entry: Partial<AuditLogEntry>,
  prevHash: string | null
): string {
  const canonical = canonicalJSON(entry);
  const chainedData = (prevHash || '') + canonical;
  return sha256(chainedData);
}

/**
 * Verify hash chain integrity for a sequence of entries
 * Returns first failing entry or null if all valid
 */
export function verifyChain(
  entries: AuditLogEntry[]
): {
  valid: boolean;
  firstFailure?: {
    entry: AuditLogEntry;
    expectedHash: string;
    actualHash: string;
  };
} {
  if (entries.length === 0) {
    return { valid: true };
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const expectedPrevHash = i === 0 ? null : entries[i - 1].hash;

    // Verify prevHash matches previous entry's hash
    if (entry.prevHash !== expectedPrevHash) {
      return {
        valid: false,
        firstFailure: {
          entry,
          expectedHash: expectedPrevHash || 'null',
          actualHash: entry.prevHash || 'null',
        },
      };
    }

    // Verify entry's own hash
    const computedHash = computeEntryHash(entry, entry.prevHash);
    if (entry.hash !== computedHash) {
      return {
        valid: false,
        firstFailure: {
          entry,
          expectedHash: computedHash,
          actualHash: entry.hash,
        },
      };
    }
  }

  return { valid: true };
}

/**
 * Verify a single entry's hash without checking chain continuity
 */
export function verifyEntryHash(entry: AuditLogEntry): boolean {
  const computedHash = computeEntryHash(entry, entry.prevHash);
  return entry.hash === computedHash;
}
