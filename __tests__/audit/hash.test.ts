/**
 * Unit tests for hash chain verification
 */

import { computeEntryHash, verifyChain, verifyEntryHash } from '@/lib/audit/hash';
import type { AuditLogEntry } from '@/lib/audit/types';

describe('Audit Log Hash Chain', () => {
  const createMockEntry = (partial: Partial<AuditLogEntry>): AuditLogEntry => ({
    id: 'test-id',
    ts: new Date('2025-01-08T00:00:00Z'),
    action: 'test.action',
    actorId: null,
    actorEmail: 'test@example.com',
    actorType: 'human',
    impersonatedUser: null,
    entityType: 'ticket',
    entityId: 'TCK-001',
    targetId: null,
    requestId: null,
    correlationId: null,
    ip: null,
    userAgent: null,
    prevValues: null,
    newValues: null,
    metadata: null,
    redactionLevel: 0,
    prevHash: null,
    hash: '',
    ...partial,
  });

  describe('computeEntryHash', () => {
    it('should compute deterministic hash', () => {
      const entry = createMockEntry({});
      const hash1 = computeEntryHash(entry, null);
      const hash2 = computeEntryHash(entry, null);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex
    });

    it('should change hash when entry changes', () => {
      const entry1 = createMockEntry({ action: 'test.action1' });
      const entry2 = createMockEntry({ action: 'test.action2' });
      const hash1 = computeEntryHash(entry1, null);
      const hash2 = computeEntryHash(entry2, null);
      expect(hash1).not.toBe(hash2);
    });

    it('should chain with previous hash', () => {
      const entry = createMockEntry({});
      const hash1 = computeEntryHash(entry, null);
      const hash2 = computeEntryHash(entry, 'prev-hash');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyChain', () => {
    it('should verify empty chain', () => {
      const result = verifyChain([]);
      expect(result.valid).toBe(true);
      expect(result.firstFailure).toBeUndefined();
    });

    it('should verify single entry', () => {
      const entry = createMockEntry({
        prevHash: null,
      });
      entry.hash = computeEntryHash(entry, null);

      const result = verifyChain([entry]);
      expect(result.valid).toBe(true);
    });

    it('should verify valid chain', () => {
      const entry1 = createMockEntry({ id: '1', prevHash: null });
      entry1.hash = computeEntryHash(entry1, null);

      const entry2 = createMockEntry({ id: '2', prevHash: entry1.hash });
      entry2.hash = computeEntryHash(entry2, entry1.hash);

      const entry3 = createMockEntry({ id: '3', prevHash: entry2.hash });
      entry3.hash = computeEntryHash(entry3, entry2.hash);

      const result = verifyChain([entry1, entry2, entry3]);
      expect(result.valid).toBe(true);
    });

    it('should detect broken chain', () => {
      const entry1 = createMockEntry({ id: '1', prevHash: null });
      entry1.hash = computeEntryHash(entry1, null);

      const entry2 = createMockEntry({ id: '2', prevHash: 'wrong-hash' });
      entry2.hash = computeEntryHash(entry2, entry2.prevHash);

      const result = verifyChain([entry1, entry2]);
      expect(result.valid).toBe(false);
      expect(result.firstFailure).toBeDefined();
      expect(result.firstFailure?.entry.id).toBe('2');
    });

    it('should detect tampered entry', () => {
      const entry1 = createMockEntry({ id: '1', prevHash: null });
      entry1.hash = computeEntryHash(entry1, null);

      const entry2 = createMockEntry({ id: '2', prevHash: entry1.hash });
      entry2.hash = 'tampered-hash'; // Invalid hash

      const result = verifyChain([entry1, entry2]);
      expect(result.valid).toBe(false);
      expect(result.firstFailure).toBeDefined();
    });
  });

  describe('verifyEntryHash', () => {
    it('should verify valid entry', () => {
      const entry = createMockEntry({ prevHash: null });
      entry.hash = computeEntryHash(entry, null);
      expect(verifyEntryHash(entry)).toBe(true);
    });

    it('should reject tampered entry', () => {
      const entry = createMockEntry({ prevHash: null });
      entry.hash = 'tampered';
      expect(verifyEntryHash(entry)).toBe(false);
    });
  });
});
