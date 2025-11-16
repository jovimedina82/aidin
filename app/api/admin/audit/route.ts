/**
 * Admin-only audit log API
 * GET /api/admin/audit - List audit logs with filters
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logEvent } from '@/lib/audit';
import { boundNumber } from '@/lib/utils/html-escape';

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

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin role
    const hasAccess = isAdmin(user);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const action = searchParams.get('action');
    const actorEmail = searchParams.get('actorEmail');
    const actorType = searchParams.get('actorType');
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');
    const correlationId = searchParams.get('correlationId');
    const requestId = searchParams.get('requestId');
    const searchTerm = searchParams.get('searchTerm');

    // Validate and bound numeric parameters
    const rawLimit = parseInt(searchParams.get('limit') || '100', 10);
    const rawOffset = parseInt(searchParams.get('offset') || '0', 10);
    const limit = boundNumber(rawLimit, 1, 1000, 100); // Max 1000 results
    const offset = boundNumber(rawOffset, 0, 100000, 0); // Max offset 100k

    // Build where clause
    const where: any = {};

    // Validate date parameters
    if (startDateStr || endDateStr) {
      where.ts = {};
      if (startDateStr) {
        const startDate = new Date(startDateStr);
        if (isNaN(startDate.getTime())) {
          return NextResponse.json({ error: 'Invalid startDate format' }, { status: 400 });
        }
        where.ts.gte = startDate;
      }
      if (endDateStr) {
        const endDate = new Date(endDateStr);
        if (isNaN(endDate.getTime())) {
          return NextResponse.json({ error: 'Invalid endDate format' }, { status: 400 });
        }
        where.ts.lte = endDate;
      }
    }

    if (action) {
      where.action = action;
    }

    if (actorEmail) {
      where.actorEmail = { contains: actorEmail };
    }

    if (actorType) {
      where.actorType = actorType;
    }

    if (entityType) {
      where.entityType = entityType;
    }

    if (entityId) {
      where.entityId = entityId;
    }

    if (correlationId) {
      where.correlationId = correlationId;
    }

    if (requestId) {
      where.requestId = requestId;
    }

    // Fetch audit logs
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { ts: 'desc' },
        take: Math.min(limit, 1000),
        skip: offset,
      }),
      prisma.auditLog.count({ where }),
    ]);

    // Parse JSON fields
    const parsedLogs = logs.map((log) => ({
      ...log,
      prevValues: log.prevValues ? JSON.parse(log.prevValues) : null,
      newValues: log.newValues ? JSON.parse(log.newValues) : null,
      metadata: log.metadata ? JSON.parse(log.metadata) : null,
    }));

    return NextResponse.json({
      data: parsedLogs,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Audit log fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
