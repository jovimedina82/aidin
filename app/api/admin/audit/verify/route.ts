/**
 * Admin-only hash chain verification endpoint
 * POST /api/admin/audit/verify
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { PrismaClient } from '@/lib/generated/prisma';
import { verifyChainRange } from '@/lib/audit/verifier';

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

export async function POST(request: NextRequest) {
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

    // Parse request body
    const body = await request.json();
    const { startDate, endDate } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    // Run verification
    const result = await verifyChainRange(
      new Date(startDate),
      new Date(endDate)
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Chain verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
