/**
 * Trigger Manual Poll
 *
 * POST /api/jobs/email-polling/trigger
 *
 * Immediately poll inbox for new emails.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { triggerManualPoll } from '@/modules/email-polling';

export async function POST(request: NextRequest) {
  try {
    // Authentication required
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`🔄 Manual poll triggered by ${user.email}`);

    // Trigger immediate poll
    const result = await triggerManualPoll();

    return NextResponse.json({
      success: true,
      message: 'Manual poll completed',
      processed: result.processed,
      failed: result.failed,
    });
  } catch (error: any) {
    console.error('Failed to trigger manual poll:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to trigger poll' },
      { status: 500 }
    );
  }
}
