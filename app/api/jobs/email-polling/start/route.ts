/**
 * Start Email Polling
 *
 * POST /api/jobs/email-polling/start
 *
 * Manually start the email polling service.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { startEmailPolling, isPollingRunning } from '@/modules/email-polling';

export async function POST(request: NextRequest) {
  try {
    // Authentication required
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if already running
    if (isPollingRunning()) {
      return NextResponse.json(
        { error: 'Email polling is already running' },
        { status: 400 }
      );
    }

    // Start polling
    startEmailPolling();

    const interval = parseInt(process.env.EMAIL_POLLING_INTERVAL_MS || '60000', 10);

    return NextResponse.json({
      success: true,
      message: 'Email polling started',
      interval,
    });
  } catch (error: any) {
    console.error('Failed to start email polling:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to start polling' },
      { status: 500 }
    );
  }
}
