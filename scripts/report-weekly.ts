#!/usr/bin/env tsx
/**
 * Phase 9: Analytics & Weekly Reporting
 * CLI script to manually trigger weekly KPI snapshot
 *
 * Usage:
 *   node scripts/report-weekly.ts
 *   npx tsx scripts/report-weekly.ts
 */

import * as reports from '../modules/reports'

async function main() {
  console.log('[report-weekly] Starting weekly snapshot job...')

  try {
    // Run weekly snapshot (uses current UTC time)
    await reports.scheduler.runWeeklySnapshot()

    console.log('[report-weekly] Weekly snapshot completed successfully')

    // Fetch and display latest snapshots
    const latest = await reports.repo.latest(3)
    console.log('\n[report-weekly] Latest 3 weekly snapshots:')
    latest.forEach((snapshot) => {
      console.log(`  - Week ${snapshot.weekStartUTC.toISOString()}: ${snapshot.ticketsOpen} open, ${snapshot.ticketsPending} pending, ${snapshot.ticketsSolved7d} solved (7d), avg response ${snapshot.avgFirstResponseMinutes}min`)
    })

    process.exit(0)
  } catch (error) {
    console.error('[report-weekly] Error:', error)
    process.exit(1)
  }
}

main()
