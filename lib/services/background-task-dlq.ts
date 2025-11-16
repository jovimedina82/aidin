/**
 * Dead Letter Queue for Background Tasks
 *
 * Tracks failed background operations and provides retry mechanisms.
 * Prevents silent failures in setImmediate/async operations.
 */

import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';

export type TaskType =
  | 'email_attachment'
  | 'confirmation_email'
  | 'webhook_trigger'
  | 'ai_response'
  | 'notification'
  | 'audit_log';

interface FailedTask {
  taskType: TaskType;
  payload: Record<string, any>;
  error: string;
  stackTrace?: string;
  retryCount?: number;
}

/**
 * Log a failed background task to DLQ
 */
export async function logFailedTask(task: FailedTask): Promise<void> {
  try {
    // Store in a general-purpose DLQ table
    // Using EmailDLQ for now as it has the right structure
    await prisma.emailDLQ.create({
      data: {
        messageId: `task_${task.taskType}_${Date.now()}`,
        from: 'system',
        subject: `Failed: ${task.taskType}`,
        error: task.error,
        stackTrace: task.stackTrace,
        rawPayload: JSON.stringify(task.payload),
      },
    });

    logger.error(`Background task failed: ${task.taskType}`, null, {
      taskType: task.taskType,
      error: task.error,
      payload: task.payload,
    });
  } catch (dlqError) {
    // If we can't even log to DLQ, log to structured logger
    logger.error('Failed to log to DLQ', dlqError as Error, {
      originalTask: task,
    });
  }
}

/**
 * Wrapper for background tasks with DLQ support
 * Use this instead of raw setImmediate
 */
export function executeBackgroundTask(
  taskType: TaskType,
  taskFn: () => Promise<void>,
  payload: Record<string, any>
): void {
  setImmediate(async () => {
    try {
      await taskFn();
    } catch (error: any) {
      await logFailedTask({
        taskType,
        payload,
        error: error.message || String(error),
        stackTrace: error.stack,
      });
    }
  });
}

/**
 * Execute background task with retry
 */
export async function executeWithRetry(
  taskType: TaskType,
  taskFn: () => Promise<void>,
  payload: Record<string, any>,
  maxRetries: number = 3
): Promise<void> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await taskFn();
      return; // Success
    } catch (error: any) {
      lastError = error;
      logger.warn(`Task ${taskType} failed, attempt ${attempt}/${maxRetries}`, {
        error: error.message,
      });

      if (attempt < maxRetries) {
        // Exponential backoff
        const delay = 1000 * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // All retries exhausted
  await logFailedTask({
    taskType,
    payload,
    error: lastError?.message || 'Unknown error',
    stackTrace: lastError?.stack,
    retryCount: maxRetries,
  });
}

/**
 * Helper for email confirmation tasks
 */
export function scheduleEmailConfirmation(
  ticketId: string,
  recipientEmail: string,
  emailFn: () => Promise<void>
): void {
  executeBackgroundTask('confirmation_email', emailFn, {
    ticketId,
    recipientEmail,
    scheduledAt: new Date().toISOString(),
  });
}

/**
 * Helper for webhook tasks
 */
export function scheduleWebhookTrigger(
  webhookUrl: string,
  payload: Record<string, any>,
  webhookFn: () => Promise<void>
): void {
  executeBackgroundTask('webhook_trigger', webhookFn, {
    webhookUrl,
    payload,
    scheduledAt: new Date().toISOString(),
  });
}

/**
 * Helper for attachment processing
 */
export function scheduleAttachmentProcessing(
  ticketId: string,
  attachmentCount: number,
  processFn: () => Promise<void>
): void {
  executeBackgroundTask('email_attachment', processFn, {
    ticketId,
    attachmentCount,
    scheduledAt: new Date().toISOString(),
  });
}

/**
 * Get failed tasks for admin review
 */
export async function getFailedTasks(
  taskType?: TaskType,
  limit: number = 50
): Promise<any[]> {
  const where: any = {
    // Identify tasks by messageId pattern
    messageId: { startsWith: 'task_' },
  };

  if (taskType) {
    where.messageId = { contains: taskType };
  }

  const tasks = await prisma.emailDLQ.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return tasks.map((task) => ({
    id: task.id,
    taskType: task.subject.replace('Failed: ', ''),
    error: task.error,
    payload: task.rawPayload ? JSON.parse(task.rawPayload) : null,
    createdAt: task.createdAt,
  }));
}
