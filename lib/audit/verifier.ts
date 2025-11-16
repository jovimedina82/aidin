/**
 * Hash chain verification job
 * Runs periodically to verify audit log integrity
 */

import { prisma } from '@/lib/prisma';
import { verifyChain } from './hash';
import type { AuditLogEntry, ChainVerificationResult } from './types';
import { logEvent } from './logger';
import { withSystemActor } from './context';

/**
 * Verify hash chain for a date range
 */
export async function verifyChainRange(
  startDate: Date,
  endDate: Date
): Promise<ChainVerificationResult> {
  // Fetch entries in chronological order
  const entries = await prisma.auditLog.findMany({
    where: {
      ts: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { ts: 'asc' },
  });

  if (entries.length === 0) {
    return {
      status: 'valid',
      totalEntries: 0,
      verifiedEntries: 0,
    };
  }

  // Verify chain
  const result = verifyChain(entries as AuditLogEntry[]);

  const verificationResult: ChainVerificationResult = {
    status: result.valid ? 'valid' : 'invalid',
    totalEntries: entries.length,
    verifiedEntries: result.valid ? entries.length : entries.length - 1,
  };

  if (!result.valid && result.firstFailure) {
    verificationResult.firstFailureId = result.firstFailure.entry.id;
    verificationResult.firstFailureTs = result.firstFailure.entry.ts;
    verificationResult.details = {
      expectedHash: result.firstFailure.expectedHash,
      actualHash: result.firstFailure.actualHash,
      brokenAt: result.firstFailure.entry.id,
    };
  }

  // Store verification result
  await prisma.auditChainVerification.create({
    data: {
      rangeStart: startDate,
      rangeEnd: endDate,
      totalEntries: verificationResult.totalEntries,
      verifiedEntries: verificationResult.verifiedEntries,
      firstFailureId: verificationResult.firstFailureId || null,
      firstFailureTs: verificationResult.firstFailureTs || null,
      status: verificationResult.status,
      details: verificationResult.details
        ? JSON.stringify(verificationResult.details)
        : null,
    },
  });

  return verificationResult;
}

/**
 * Hourly verification job
 * Verifies the last hour of audit logs
 */
export async function verifyChainJob(): Promise<void> {
  await withSystemActor(async () => {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 60 * 60 * 1000); // Last hour

    try {
      const result = await verifyChainRange(startDate, endDate);

      if (result.status === 'invalid') {
        // Log chain integrity warning
        await logEvent({
          action: 'audit.chain.warning',
          entityType: 'setting',
          entityId: 'audit_verification',
          metadata: {
            rangeStart: startDate.toISOString(),
            rangeEnd: endDate.toISOString(),
            firstFailureId: result.firstFailureId,
            firstFailureTs: result.firstFailureTs?.toISOString(),
            details: result.details,
          },
          redactionLevel: 0, // Don't redact verification failures
        });

        console.error('Audit chain verification FAILED:', result);
      } else {
        // Log successful verification
        await logEvent({
          action: 'audit.chain.verified',
          entityType: 'setting',
          entityId: 'audit_verification',
          metadata: {
            rangeStart: startDate.toISOString(),
            rangeEnd: endDate.toISOString(),
            totalEntries: result.totalEntries,
            status: 'valid',
          },
          redactionLevel: 0,
        });
      }
    } catch (error) {
      console.error('Error running chain verification:', error);

      // Log verification error
      await logEvent({
        action: 'audit.chain.warning',
        entityType: 'setting',
        entityId: 'audit_verification',
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          rangeStart: startDate.toISOString(),
          rangeEnd: endDate.toISOString(),
        },
        redactionLevel: 0,
      });
    }
  });
}

/**
 * Verify entire audit log
 * Use sparingly - can be slow for large datasets
 */
export async function verifyEntireChain(): Promise<ChainVerificationResult> {
  const firstEntry = await prisma.auditLog.findFirst({
    orderBy: { ts: 'asc' },
    select: { ts: true },
  });

  const lastEntry = await prisma.auditLog.findFirst({
    orderBy: { ts: 'desc' },
    select: { ts: true },
  });

  if (!firstEntry || !lastEntry) {
    return {
      status: 'valid',
      totalEntries: 0,
      verifiedEntries: 0,
    };
  }

  return verifyChainRange(firstEntry.ts, lastEntry.ts);
}

/**
 * Retry failed audit events from DLQ
 */
export async function retryDLQEvents(maxRetries = 3): Promise<void> {
  await withSystemActor(async () => {
    const failedEvents = await prisma.auditLogDLQ.findMany({
      where: {
        resolved: false,
        retryCount: { lt: maxRetries },
      },
      take: 100,
      orderBy: { failedAt: 'asc' },
    });

    // Batch process - collect resolved and failed IDs
    const resolvedIds: string[] = [];
    const failedUpdates: Array<{ id: string; error: string; retryCount: number }> = [];

    for (const dlqEntry of failedEvents) {
      try {
        const event = JSON.parse(dlqEntry.eventData);
        await logEvent(event);
        resolvedIds.push(dlqEntry.id);
      } catch (error) {
        failedUpdates.push({
          id: dlqEntry.id,
          error: error instanceof Error ? error.message : String(error),
          retryCount: dlqEntry.retryCount + 1,
        });
      }
    }

    // Batch update resolved entries
    if (resolvedIds.length > 0) {
      await prisma.auditLogDLQ.updateMany({
        where: { id: { in: resolvedIds } },
        data: {
          resolved: true,
          resolvedAt: new Date(),
        },
      });
    }

    // Update failed entries individually (different data for each)
    // Use Promise.all for concurrent updates instead of sequential
    if (failedUpdates.length > 0) {
      await Promise.all(
        failedUpdates.map((update) =>
          prisma.auditLogDLQ.update({
            where: { id: update.id },
            data: {
              retryCount: update.retryCount,
              lastRetryAt: new Date(),
              error: update.error,
            },
          })
        )
      );
    }
  });
}
