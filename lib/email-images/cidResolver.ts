/**
 * CID (Content-ID) resolver for inline email images
 * Maps content IDs to signed asset URLs
 */

import { PrismaClient } from '@/lib/generated/prisma';
import { createAssetToken } from './hash';

const prisma = new PrismaClient();

/**
 * Build CID map for a message (contentId -> signed URL)
 */
export async function buildCidMap(
  messageId: string,
  variant: 'web' | 'original' = 'web',
  ttl: number = 900
): Promise<Map<string, string>> {
  const assets = await prisma.messageAsset.findMany({
    where: {
      messageId,
      kind: 'inline',
      contentId: { not: null },
      variant,
    },
  });

  const cidMap = new Map<string, string>();

  for (const asset of assets) {
    if (asset.contentId) {
      // Normalize CID (remove angle brackets if present)
      const normalizedCid = asset.contentId.replace(/^<|>$/g, '');

      // Create signed URL
      const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
      const token = createAssetToken({
        assetId: asset.id,
        variant: asset.variant,
        audience: asset.ticketId,
        exp: Math.floor(Date.now() / 1000) + ttl,
      });

      const signedUrl = `${appBaseUrl}/api/assets/${asset.id}?token=${token}`;
      cidMap.set(normalizedCid, signedUrl);
    }
  }

  return cidMap;
}

/**
 * Resolve a single CID to its asset
 */
export async function resolveCid(
  messageId: string,
  contentId: string
): Promise<string | null> {
  const normalizedCid = contentId.replace(/^<|>$/g, '');

  const asset = await prisma.messageAsset.findFirst({
    where: {
      messageId,
      contentId: normalizedCid,
      kind: 'inline',
      variant: 'web',
    },
  });

  if (!asset) {
    return null;
  }

  const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
  const token = createAssetToken({
    assetId: asset.id,
    variant: asset.variant,
    audience: asset.ticketId,
    exp: Math.floor(Date.now() / 1000) + 900,
  });

  return `${appBaseUrl}/api/assets/${asset.id}?token=${token}`;
}

/**
 * Create signed URL for an asset
 */
export function createSignedAssetUrl(
  assetId: string,
  ticketId: string,
  variant: 'original' | 'web' | 'thumb' = 'web',
  ttl: number = 900
): string {
  const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
  const token = createAssetToken({
    assetId,
    variant,
    audience: ticketId,
    exp: Math.floor(Date.now() / 1000) + ttl,
  });

  return `${appBaseUrl}/api/assets/${assetId}?token=${token}`;
}
