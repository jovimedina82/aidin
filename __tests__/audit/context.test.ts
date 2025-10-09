/**
 * Unit tests for audit context and actor resolution
 */

import {
  getAuditContext,
  setAuditContext,
  runWithAuditContext,
  withSystemActor,
  resolveActor,
  markSystemContext,
} from '@/lib/audit/context';
import { SYSTEM_ACTOR } from '@/lib/audit/types';

describe('Audit Context', () => {
  describe('getAuditContext and setAuditContext', () => {
    it('should return empty context initially', () => {
      const context = getAuditContext();
      expect(context).toEqual({});
    });

    it('should set and get context', () => {
      setAuditContext({ requestId: 'test-123' });
      const context = getAuditContext();
      expect(context.requestId).toBe('test-123');
    });

    it('should merge context', () => {
      setAuditContext({ requestId: 'req-1' });
      setAuditContext({ correlationId: 'corr-1' });
      const context = getAuditContext();
      expect(context.requestId).toBe('req-1');
      expect(context.correlationId).toBe('corr-1');
    });
  });

  describe('runWithAuditContext', () => {
    it('should run function with context', () => {
      const result = runWithAuditContext(
        { requestId: 'test-456' },
        () => {
          const context = getAuditContext();
          return context.requestId;
        }
      );

      expect(result).toBe('test-456');
    });
  });

  describe('withSystemActor', () => {
    it('should set system actor context', async () => {
      await withSystemActor(async () => {
        const context = getAuditContext();
        expect(context.isSystemContext).toBe(true);
        expect(context.actorEmail).toBe(SYSTEM_ACTOR.email);
        expect(context.actorType).toBe(SYSTEM_ACTOR.type);
      });
    });

    it('should return function result', async () => {
      const result = await withSystemActor(async () => {
        return 'test-result';
      });

      expect(result).toBe('test-result');
    });
  });

  describe('markSystemContext', () => {
    it('should mark context as system', () => {
      markSystemContext();
      const context = getAuditContext();
      expect(context.isSystemContext).toBe(true);
      expect(context.actorEmail).toBe(SYSTEM_ACTOR.email);
    });
  });

  describe('resolveActor', () => {
    it('should return system actor when no context', () => {
      const actor = resolveActor();
      expect(actor.actorEmail).toBe(SYSTEM_ACTOR.email);
      expect(actor.actorType).toBe(SYSTEM_ACTOR.type);
      expect(actor.actorId).toBeNull();
    });

    it('should return system actor when marked as system context', () => {
      setAuditContext({
        isSystemContext: true,
        actorEmail: 'user@test.com',
      });

      const actor = resolveActor();
      expect(actor.actorEmail).toBe(SYSTEM_ACTOR.email);
      expect(actor.actorType).toBe(SYSTEM_ACTOR.type);
    });

    it('should return human actor from context', () => {
      setAuditContext({
        actorEmail: 'user@test.com',
        actorId: 'user-123',
        actorType: 'human',
      });

      const actor = resolveActor();
      expect(actor.actorEmail).toBe('user@test.com');
      expect(actor.actorId).toBe('user-123');
      expect(actor.actorType).toBe('human');
    });

    it('should default to human type if actor but no type', () => {
      setAuditContext({
        actorEmail: 'user@test.com',
      });

      const actor = resolveActor();
      expect(actor.actorType).toBe('human');
    });
  });
});
