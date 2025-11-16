import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { markNotificationAsRead } from '@/lib/notifications/service';
import logger from '@/lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const notificationId = params.id;
    const success = await markNotificationAsRead(notificationId, user.id);

    if (!success) {
      return NextResponse.json(
        { error: 'Notification not found or not owned by user' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      notificationId,
      readAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to mark notification as read', error as Error, {
      notificationId: params.id,
    });
    return NextResponse.json(
      { error: 'Failed to mark notification as read' },
      { status: 500 }
    );
  }
}
