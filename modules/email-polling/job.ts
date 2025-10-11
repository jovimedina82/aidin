/**
 * Email Polling Background Job
 *
 * Runs email polling service on a cron schedule.
 * Starts automatically when server starts (via instrumentation.ts).
 *
 * @module modules/email-polling/job
 */

import cron from 'node-cron';
import { getEmailPollingService } from './service';

let pollingTask: cron.ScheduledTask | null = null;
let isPolling = false;

/**
 * Start email polling on schedule
 */
export function startEmailPolling(): void {
  if (process.env.EMAIL_POLLING_ENABLED !== 'true') {
    console.log('⏸️  Email polling disabled (EMAIL_POLLING_ENABLED not set to true)');
    return;
  }

  if (pollingTask) {
    console.log('⚠️  Email polling already running');
    return;
  }

  const intervalMs = parseInt(process.env.EMAIL_POLLING_INTERVAL_MS || '60000', 10);
  const intervalSeconds = Math.floor(intervalMs / 1000);

  // Convert milliseconds to cron expression
  // Every X seconds: */X * * * * *
  const cronExpression = `*/${intervalSeconds} * * * * *`;

  console.log(`📬 Starting email polling service (every ${intervalSeconds} seconds)...`);

  const service = getEmailPollingService();
  service.setRunning(true);

  pollingTask = cron.schedule(cronExpression, async () => {
    // Skip if already polling (prevent overlap)
    if (isPolling) {
      console.log('⏭️  Skipping poll - previous poll still running');
      return;
    }

    isPolling = true;

    try {
      await service.poll();
    } catch (error: any) {
      console.error('❌ Polling error:', error.message);
    } finally {
      isPolling = false;
    }
  });

  pollingTask.start();
  console.log('✅ Email polling started');
}

/**
 * Stop email polling
 */
export function stopEmailPolling(): void {
  if (!pollingTask) {
    console.log('⚠️  Email polling not running');
    return;
  }

  pollingTask.stop();
  pollingTask = null;
  isPolling = false;

  const service = getEmailPollingService();
  service.setRunning(false);

  console.log('✅ Email polling stopped');
}

/**
 * Check if polling is running
 */
export function isPollingRunning(): boolean {
  return pollingTask !== null;
}

/**
 * Trigger immediate poll (manual)
 */
export async function triggerManualPoll(): Promise<{ processed: number; failed: number }> {
  console.log('🔄 Triggering manual poll...');

  const service = getEmailPollingService();
  const result = await service.poll();

  return result;
}

/**
 * Get polling stats
 */
export function getPollingStats() {
  const service = getEmailPollingService();
  return service.getStats();
}
