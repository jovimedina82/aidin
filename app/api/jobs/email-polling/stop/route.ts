/**
 * Stop Email Polling
 *
 * POST /api/jobs/email-polling/stop
 *
 * Manually stop the email polling service.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { stopEmailPolling, isPollingRunning } from '@/modules/email-polling';

export async function POST(request: NextRequest) {
  try {
    // Authentication required
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if running
    if (!isPollingRunning()) {
      return NextResponse.json(
        { error: 'Email polling is not running' },
        { status: 400 }
      );
    }

    // Stop polling
    stopEmailPolling();

    return NextResponse.json({
      success: true,
      message: 'Email polling stopped',
    });
  } catch (error: any) {
    console.error('Failed to stop email polling:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to stop polling' },
      { status: 500 }
    );
  }
}
