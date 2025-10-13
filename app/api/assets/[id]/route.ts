/**
 * Asset serving endpoint with signed URL authentication
 * GET /api/assets/[id]?token=xxx
 *
 * Serves email images with access control
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/lib/generated/prisma';
import { parseAssetToken } from '@/lib/email-images/hash';
import { getAsset, getAssetUrl } from '@/lib/email-images/assetStore';
import { getCurrentUser } from '@/lib/auth';
import { hasTicketAccess } from '@/lib/access-control';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 401 });
    }

    // 1. Parse and verify token
    const payload = parseAssetToken(token);

    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    // 2. Verify asset ID matches
    if (payload.assetId !== params.id) {
      return NextResponse.json({ error: 'Token mismatch' }, { status: 401 });
    }

    // 3. Fetch asset
    const asset = await prisma.messageAsset.findUnique({
      where: { id: params.id },
      include: {
        ticket: {
          select: {
            id: true,
            requesterId: true,
            assigneeId: true,
          },
        },
      },
    });

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    // 4. Verify audience (ticketId)
    if (payload.audience && payload.audience !== asset.ticketId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // 5. Check user access to ticket
    const currentUser = await getCurrentUser(request);

    if (currentUser) {
      // If user is authenticated, verify they have access to the ticket
      const hasAccess = await hasTicketAccess(currentUser, asset.ticket);

      if (!hasAccess) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // 6. Serve asset
    const storageDriver = process.env.ASSETS_DRIVER || 'disk';

    if (storageDriver === 's3') {
      // Redirect to S3 pre-signed URL
      const url = await getAssetUrl(asset.storageKey);
      return NextResponse.redirect(url);
    } else {
      // Stream from disk
      try {
        const buffer = await getAsset(asset.storageKey);

        return new NextResponse(buffer as any, {
          headers: {
            'Content-Type': asset.mime,
            'Content-Length': String(asset.size),
            'Cache-Control': 'private, max-age=3600',
            'Content-Disposition': `inline; filename="${asset.filename}"`,
          },
        });
      } catch (error) {
        console.error('Failed to serve asset:', error);
        return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
      }
    }
  } catch (error: any) {
    console.error('Asset serving error:', error);
    return NextResponse.json(
      {
        error: 'Failed to serve asset',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
