/**
 * Notification Service
 *
 * Provides in-app notification system for users with:
 * - Role-based notification targeting
 * - Severity levels (INFO, WARNING, ERROR, CRITICAL)
 * - Optional action URLs
 * - Automatic expiration
 * - Mark as read functionality
 */

import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';

export type NotificationSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface CreateNotificationInput {
  type: string;
  title: string;
  message: string;
  severity?: NotificationSeverity;
  actionUrl?: string;
  metadata?: Record<string, any>;
  expiresInDays?: number;
}

export interface NotificationResult {
  success: boolean;
  notificationIds: string[];
  recipientCount: number;
  errors?: string[];
}

/**
 * Create notifications for specific users
 */
export async function createNotificationsForUsers(
  userIds: string[],
  input: CreateNotificationInput
): Promise<NotificationResult> {
  const { type, title, message, severity = 'INFO', actionUrl, metadata, expiresInDays } = input;

  if (userIds.length === 0) {
    return {
      success: true,
      notificationIds: [],
      recipientCount: 0,
    };
  }

  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  try {
    // Batch create notifications for all users
    const notifications = await prisma.$transaction(
      userIds.map((userId) =>
        prisma.notification.create({
          data: {
            userId,
            type,
            title,
            message,
            severity: severity as any,
            actionUrl,
            metadata: metadata || {},
            expiresAt,
          },
        })
      )
    );

    logger.info('Created notifications for users', {
      type,
      title,
      recipientCount: notifications.length,
      severity,
    });

    return {
      success: true,
      notificationIds: notifications.map((n) => n.id),
      recipientCount: notifications.length,
    };
  } catch (error) {
    logger.error('Failed to create notifications', error as Error, {
      type,
      title,
      userCount: userIds.length,
    });
    return {
      success: false,
      notificationIds: [],
      recipientCount: 0,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

/**
 * Create notifications for users with specific roles
 */
export async function createNotificationsForRoles(
  roleNames: string[],
  input: CreateNotificationInput
): Promise<NotificationResult> {
  try {
    // Get all active users with the specified roles
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        roles: {
          some: {
            role: {
              name: { in: roleNames },
            },
          },
        },
      },
      select: { id: true },
    });

    if (users.length === 0) {
      logger.warn('No recipients found for notification', {
        roleNames,
        type: input.type,
        title: input.title,
      });
      return {
        success: true,
        notificationIds: [],
        recipientCount: 0,
      };
    }

    return createNotificationsForUsers(
      users.map((u) => u.id),
      input
    );
  } catch (error) {
    logger.error('Failed to fetch users for notification', error as Error, {
      roleNames,
      type: input.type,
    });
    return {
      success: false,
      notificationIds: [],
      recipientCount: 0,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

/**
 * Get unread notifications for a user
 */
export async function getUnreadNotifications(
  userId: string,
  limit: number = 50
): Promise<any[]> {
  return prisma.notification.findMany({
    where: {
      userId,
      isRead: false,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * Get all notifications for a user (with pagination)
 */
export async function getUserNotifications(
  userId: string,
  options: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
  } = {}
): Promise<{ notifications: any[]; total: number; unreadCount: number }> {
  const { limit = 50, offset = 0, unreadOnly = false } = options;

  const where: any = {
    userId,
    OR: [
      { expiresAt: null },
      { expiresAt: { gt: new Date() } },
    ],
  };

  if (unreadOnly) {
    where.isRead = false;
  }

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({
      where: {
        userId,
        isRead: false,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    }),
  ]);

  return { notifications, total, unreadCount };
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(
  notificationId: string,
  userId: string
): Promise<boolean> {
  try {
    await prisma.notification.update({
      where: {
        id: notificationId,
        userId, // Ensure user owns the notification
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
    return true;
  } catch (error) {
    logger.warn('Failed to mark notification as read', {
      notificationId,
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  logger.info('Marked all notifications as read', {
    userId,
    count: result.count,
  });

  return result.count;
}

/**
 * Delete expired notifications (cleanup job)
 */
export async function deleteExpiredNotifications(): Promise<number> {
  const result = await prisma.notification.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });

  if (result.count > 0) {
    logger.info('Deleted expired notifications', { count: result.count });
  }

  return result.count;
}

/**
 * Create admin alert notification
 * Helper for common admin notifications
 */
export async function notifyAdmins(
  title: string,
  message: string,
  options: {
    severity?: NotificationSeverity;
    actionUrl?: string;
    metadata?: Record<string, any>;
    type?: string;
  } = {}
): Promise<NotificationResult> {
  return createNotificationsForRoles(['Admin'], {
    type: options.type || 'admin_alert',
    title,
    message,
    severity: options.severity || 'WARNING',
    actionUrl: options.actionUrl,
    metadata: options.metadata,
    expiresInDays: 30, // Admin notifications expire after 30 days
  });
}

/**
 * Create ticket-related notification
 */
export async function notifyTicketUpdate(
  userId: string,
  ticketNumber: string,
  title: string,
  message: string,
  options: {
    severity?: NotificationSeverity;
    metadata?: Record<string, any>;
  } = {}
): Promise<NotificationResult> {
  return createNotificationsForUsers([userId], {
    type: 'ticket_update',
    title,
    message,
    severity: options.severity || 'INFO',
    actionUrl: `/tickets/${ticketNumber}`,
    metadata: {
      ticketNumber,
      ...options.metadata,
    },
    expiresInDays: 14, // Ticket notifications expire after 14 days
  });
}
