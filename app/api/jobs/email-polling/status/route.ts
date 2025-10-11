/**
 * Get Polling Status
 *
 * GET /api/jobs/email-polling/status
 *
 * Get current status and stats of email polling service.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getPollingStats, isPollingRunning } from '@/modules/email-polling';

export async function GET(request: NextRequest) {
  try {
    // Authentication required
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stats = getPollingStats();
    const isRunning = isPollingRunning();
    const interval = parseInt(process.env.EMAIL_POLLING_INTERVAL_MS || '60000', 10);

    return NextResponse.json({
      isRunning,
      interval,
      stats: {
        total: stats.total,
        success: stats.success,
        failed: stats.failed,
        support: stats.support,
        vendor: stats.vendor,
        unclear: stats.unclear,
        lastPoll: stats.lastPoll,
        lastSuccess: stats.lastSuccess,
      },
    });
  } catch (error: any) {
    console.error('Failed to get polling status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get status' },
      { status: 500 }
    );
  }
}
