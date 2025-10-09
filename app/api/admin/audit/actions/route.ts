/**
 * Get distinct audit log actions
 * GET /api/admin/audit/actions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { PrismaClient } from '@/lib/generated/prisma';

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

    // Get distinct actions
    const actions = await prisma.auditLog.findMany({
      select: {
        action: true,
      },
      distinct: ['action'],
      orderBy: {
        action: 'asc',
      },
    });

    return NextResponse.json({
      actions: actions.map(a => a.action),
    });
  } catch (error) {
    console.error('Error fetching audit actions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
