/**
 * Audit Log Cleanup Job
 * Deletes audit log entries older than 2 years
 * Maintains hash chain integrity by only deleting from the beginning
 */

import { prisma } from '@/lib/prisma';

const RETENTION_DAYS = 730; // 2 years

export async function cleanupOldAuditLogs() {
  const retentionDate = new Date();
  retentionDate.setDate(retentionDate.getDate() - RETENTION_DAYS);

  console.log(`[Audit Cleanup] Starting cleanup of logs older than ${retentionDate.toISOString()}`);

  try {
    // Count logs to be deleted
    const countToDelete = await prisma.auditLog.count({
      where: {
        ts: {
          lt: retentionDate
        }
      }
    });

    if (countToDelete === 0) {
      console.log('[Audit Cleanup] No logs to delete');
      return { deleted: 0, message: 'No logs older than 2 years' };
    }

    console.log(`[Audit Cleanup] Found ${countToDelete} logs to delete`);

    // Delete logs older than retention period
    // Note: This maintains chain integrity because we only delete from the beginning
    // The oldest entries have no dependencies from newer entries
    const result = await prisma.auditLog.deleteMany({
      where: {
        ts: {
          lt: retentionDate
        }
      }
    });

    console.log(`[Audit Cleanup] Successfully deleted ${result.count} audit log entries`);

    // Log the cleanup action itself (meta-logging)
    await prisma.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        ts: new Date(),
        action: 'audit.cleanup.completed',
        actorEmail: 'system@surterreproperties.com',
        actorType: 'system',
        entityType: 'setting',
        entityId: 'audit_log_cleanup',
        metadata: JSON.stringify({
          deletedCount: result.count,
          retentionDays: RETENTION_DAYS,
          cutoffDate: retentionDate.toISOString(),
          timestamp: new Date().toISOString()
        }),
        hash: 'pending', // Will be computed by trigger or app logic
        redactionLevel: 0
      }
    });

    return {
      deleted: result.count,
      message: `Deleted ${result.count} audit logs older than 2 years`
    };
  } catch (error) {
    console.error('[Audit Cleanup] Error during cleanup:', error);

    // Log the cleanup error
    try {
      await prisma.auditLog.create({
        data: {
          id: crypto.randomUUID(),
          ts: new Date(),
          action: 'audit.cleanup.error',
          actorEmail: 'system@surterreproperties.com',
          actorType: 'system',
          entityType: 'setting',
          entityId: 'audit_log_cleanup',
          metadata: JSON.stringify({
            error: error.message,
            retentionDays: RETENTION_DAYS,
            timestamp: new Date().toISOString()
          }),
          hash: 'pending',
          redactionLevel: 0
        }
      });
    } catch (logError) {
      console.error('[Audit Cleanup] Failed to log cleanup error:', logError);
    }

    throw error;
  }
}

/**
 * Get audit log statistics
 */
export async function getAuditLogStats() {
  const retentionDate = new Date();
  retentionDate.setDate(retentionDate.getDate() - RETENTION_DAYS);

  const [total, withinRetention, beyondRetention, oldest, newest] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.count({
      where: {
        ts: {
          gte: retentionDate
        }
      }
    }),
    prisma.auditLog.count({
      where: {
        ts: {
          lt: retentionDate
        }
      }
    }),
    prisma.auditLog.findFirst({
      orderBy: { ts: 'asc' },
      select: { ts: true }
    }),
    prisma.auditLog.findFirst({
      orderBy: { ts: 'desc' },
      select: { ts: true }
    })
  ]);

  return {
    total,
    withinRetention,
    beyondRetention,
    oldestEntry: oldest?.ts || null,
    newestEntry: newest?.ts || null,
    retentionDays: RETENTION_DAYS
  };
}
