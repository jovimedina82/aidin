/**
 * Admin-only streaming export endpoints
 * GET /api/admin/audit/export?format=jsonl|csv
 */

import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { PrismaClient } from '@/lib/generated/prisma';
import { logEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const prisma = new PrismaClient();

/**
 * Check if user has admin role
 */
function isAdmin(user: any): boolean {
  if (!user) {
    return false;
  }

  const userRoleNames = user?.roles?.map((role: any) =>
    typeof role === 'string' ? role : (role.role?.name || role.name)
  ) || [];

  return userRoleNames.some((role: string) => ['Admin', 'Manager'].includes(role));
}

/**
 * Convert audit log entry to CSV row
 */
function toCSV(log: any): string {
  const escape = (val: any) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  return [
    log.id,
    log.ts,
    log.action,
    log.actorEmail,
    log.actorType,
    log.entityType,
    log.entityId,
    log.targetId || '',
    log.requestId || '',
    log.correlationId || '',
    log.ip || '',
    escape(log.prevValues || ''),
    escape(log.newValues || ''),
    escape(log.metadata || ''),
  ].join(',');
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const user = await getCurrentUser(request);
    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Check admin role
    const hasAccess = isAdmin(user);
    if (!hasAccess) {
      return new Response('Forbidden', { status: 403 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'jsonl';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const action = searchParams.get('action');
    const actorEmail = searchParams.get('actorEmail');
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');

    // Build where clause
    const where: any = {};

    if (startDate || endDate) {
      where.ts = {};
      if (startDate) {
        where.ts.gte = new Date(startDate);
      }
      if (endDate) {
        where.ts.lte = new Date(endDate);
      }
    }

    if (action) where.action = action;
    if (actorEmail) where.actorEmail = { contains: actorEmail };
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;

    // Log export request
    await logEvent({
      action: 'export.requested',
      entityType: 'setting',
      entityId: 'audit_log',
      metadata: {
        format,
        filters: { startDate, endDate, action, actorEmail, entityType, entityId },
      },
    });

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // CSV header
          if (format === 'csv') {
            const header =
              'id,ts,action,actorEmail,actorType,entityType,entityId,targetId,requestId,correlationId,ip,prevValues,newValues,metadata\n';
            controller.enqueue(encoder.encode(header));
          }

          // Stream logs in batches
          let offset = 0;
          const batchSize = 100;
          let hasMore = true;

          while (hasMore) {
            const logs = await prisma.auditLog.findMany({
              where,
              orderBy: { ts: 'desc' },
              take: batchSize,
              skip: offset,
            });

            if (logs.length === 0) {
              hasMore = false;
              break;
            }

            for (const log of logs) {
              const parsed = {
                ...log,
                prevValues: log.prevValues ? JSON.parse(log.prevValues) : null,
                newValues: log.newValues ? JSON.parse(log.newValues) : null,
                metadata: log.metadata ? JSON.parse(log.metadata) : null,
              };

              if (format === 'jsonl') {
                const line = JSON.stringify(parsed) + '\n';
                controller.enqueue(encoder.encode(line));
              } else if (format === 'csv') {
                const line = toCSV(parsed) + '\n';
                controller.enqueue(encoder.encode(line));
              }
            }

            offset += batchSize;

            if (logs.length < batchSize) {
              hasMore = false;
            }
          }

          controller.close();
        } catch (error) {
          console.error('Export stream error:', error);
          controller.error(error);
        }
      },
    });

    const filename = `audit-log-${new Date().toISOString()}.${format === 'csv' ? 'csv' : 'jsonl'}`;

    return new Response(stream, {
      headers: {
        'Content-Type':
          format === 'csv' ? 'text/csv' : 'application/x-ndjson',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error) {
    console.error('Audit export error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
