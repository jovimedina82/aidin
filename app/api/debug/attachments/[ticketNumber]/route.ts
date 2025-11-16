import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/lib/generated/prisma';
import { getCurrentUser } from '@/modules/auth/middleware';
import logger from '@/lib/logger';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { ticketNumber: string } }
) {
  try {
    // SECURITY: Block in production unless explicitly enabled
    if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEBUG_ENDPOINTS !== 'true') {
      return NextResponse.json({ error: 'Debug endpoints disabled in production' }, { status: 404 });
    }

    // SECURITY: Require admin authentication
    const user = await getCurrentUser(request);
    if (!user) {
      logger.warn('Unauthorized debug endpoint access attempt', {
        endpoint: `/api/debug/attachments/${params.ticketNumber}`,
        ip: request.headers.get('x-forwarded-for') || 'unknown'
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = user.roles.includes('Admin');
    if (!isAdmin) {
      logger.warn('Non-admin debug endpoint access attempt', {
        userId: user.id,
        email: user.email,
        endpoint: `/api/debug/attachments/${params.ticketNumber}`
      });
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { ticketNumber: params.ticketNumber },
      include: {
        attachments: true
      }
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    logger.info('Debug attachments endpoint accessed', {
      userId: user.id,
      ticketNumber: params.ticketNumber
    });

    return NextResponse.json({
      ticketNumber: ticket.ticketNumber,
      attachments: ticket.attachments || []
    });
  } catch (error: any) {
    logger.error('Debug attachments endpoint error', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}
