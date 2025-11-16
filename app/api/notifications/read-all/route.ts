import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { markAllNotificationsAsRead } from '@/lib/notifications/service';
import logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const count = await markAllNotificationsAsRead(user.id);

    return NextResponse.json({
      success: true,
      markedAsRead: count,
    });
  } catch (error) {
    logger.error('Failed to mark all notifications as read', error as Error);
    return NextResponse.json(
      { error: 'Failed to mark all notifications as read' },
      { status: 500 }
    );
  }
}
