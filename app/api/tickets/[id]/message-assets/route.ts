/**
 * Fetch message assets for a ticket
 * GET /api/tickets/[id]/message-assets?kind=attachment&onlyImages=true
 *
 * Returns list of assets with signed URLs
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, AssetKind } from '@/lib/generated/prisma';
import { getCurrentUser } from '@/lib/auth';
import { hasTicketAccess } from '@/lib/access-control';
import { createSignedAssetUrl } from '@/lib/email-images/cidResolver';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Auth check
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch ticket
    const ticket = await prisma.ticket.findUnique({
      where: { id: params.id },
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // 3. Access control
    const hasAccess = await hasTicketAccess(currentUser, ticket);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // 4. Parse query params
    const { searchParams } = new URL(request.url);
    const kind = searchParams.get('kind') as AssetKind | null;
    const onlyImages = searchParams.get('onlyImages') === 'true';
    const variant = (searchParams.get('variant') || 'web') as 'original' | 'web' | 'thumb';

    // 5. Build query
    const where: any = {
      ticketId: params.id,
      variant,
    };

    if (kind) {
      where.kind = kind;
    }

    if (onlyImages) {
      where.mime = {
        startsWith: 'image/',
      };
    }

    // 6. Fetch assets
    const assets = await prisma.messageAsset.findMany({
      where,
      orderBy: {
        createdAt: 'asc',
      },
    });

    // 7. Add signed URLs
    const assetsWithUrls = assets.map((asset) => ({
      id: asset.id,
      filename: asset.filename,
      mime: asset.mime,
      size: asset.size,
      width: asset.width,
      height: asset.height,
      kind: asset.kind,
      variant: asset.variant,
      url: createSignedAssetUrl(asset.id, ticket.id, asset.variant),
      createdAt: asset.createdAt,
    }));

    return NextResponse.json({
      assets: assetsWithUrls,
      count: assetsWithUrls.length,
    });
  } catch (error: any) {
    console.error('Error fetching message assets:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch assets',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
