/**
 * Audit Log Cleanup Scheduler
 * Runs daily at 3:00 AM to delete audit logs older than 2 years
 */

import cron from 'node-cron';
import { cleanupOldAuditLogs, getAuditLogStats } from '../jobs/audit-log-cleanup.js';

class AuditLogCleanupScheduler {
  constructor() {
    this.task = null;
  }

  start() {
    if (this.task) {
      console.log('[Audit Cleanup Scheduler] Already running');
      return;
    }

    // Run daily at 3:00 AM
    this.task = cron.schedule('0 3 * * *', async () => {
      console.log('[Audit Cleanup Scheduler] Starting scheduled cleanup...');
      try {
        const result = await cleanupOldAuditLogs();
        console.log(`[Audit Cleanup Scheduler] ${result.message}`);

        // Log stats after cleanup
        const stats = await getAuditLogStats();
        console.log('[Audit Cleanup Scheduler] Current stats:', {
          total: stats.total,
          withinRetention: stats.withinRetention,
          beyondRetention: stats.beyondRetention,
          oldestEntry: stats.oldestEntry,
          newestEntry: stats.newestEntry
        });
      } catch (error) {
        console.error('[Audit Cleanup Scheduler] Cleanup failed:', error);
      }
    });

    console.log('[Audit Cleanup Scheduler] Scheduler started (runs daily at 3:00 AM)');
  }

  stop() {
    if (this.task) {
      this.task.stop();
      this.task = null;
      console.log('[Audit Cleanup Scheduler] Scheduler stopped');
    }
  }

  // Manual trigger for testing
  async runNow() {
    console.log('[Audit Cleanup Scheduler] Manual cleanup triggered');
    return await cleanupOldAuditLogs();
  }
}

// Export singleton instance
const auditLogCleanupScheduler = new AuditLogCleanupScheduler();
export default auditLogCleanupScheduler;
