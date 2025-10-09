/**
 * Admin-only audit log API
 * GET /api/admin/audit - List audit logs with filters
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { PrismaClient } from '@/lib/generated/prisma';
import { logEvent } from '@/lib/audit';

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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const action = searchParams.get('action');
    const actorEmail = searchParams.get('actorEmail');
    const actorType = searchParams.get('actorType');
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');
    const correlationId = searchParams.get('correlationId');
    const requestId = searchParams.get('requestId');
    const searchTerm = searchParams.get('searchTerm');
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

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
