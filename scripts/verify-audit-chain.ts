#!/usr/bin/env ts-node

/**
 * Audit Chain Verification Cron Job
 * Run this hourly to verify audit log integrity
 *
 * Usage:
 *   npx ts-node scripts/verify-audit-chain.ts
 *
 * Or add to crontab:
 *   0 * * * * cd /path/to/aidin && npx ts-node scripts/verify-audit-chain.ts
 */

import { verifyChainJob, retryDLQEvents } from '@/lib/audit/verifier';

async function main() {
  console.log('🔍 Starting audit chain verification...');
  console.log(`Timestamp: ${new Date().toISOString()}`);

  try {
    // Verify last hour of audit logs
    await verifyChainJob();
    console.log('✅ Chain verification completed successfully');

    // Retry any failed events in DLQ
    console.log('🔄 Retrying failed audit events from DLQ...');
    await retryDLQEvents(3);
    console.log('✅ DLQ retry completed');

    process.exit(0);
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

main();
