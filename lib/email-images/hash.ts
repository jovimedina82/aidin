/**
 * Hash utilities for email image processing
 * SHA-256 hashing for content deduplication and integrity
 */

import { createHash, createHmac } from 'crypto';

/**
 * Compute SHA-256 hash of a buffer
 */
export function sha256(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Compute SHA-256 hash of a string
 */
export function sha256String(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

/**
 * Generate HMAC signature for asset URL tokens
 * Payload: {assetId, variant, audience, exp}
 */
export function signAssetToken(payload: {
  assetId: string;
  variant?: string;
  audience?: string;
  exp: number;
}): string {
  const secret = process.env.ASSET_SIGNING_SECRET || process.env.APP_SECRET || 'default-secret';
  const data = JSON.stringify(payload);
  return createHmac('sha256', secret).update(data).digest('base64url');
}

/**
 * Verify HMAC signature for asset URL tokens
 */
export function verifyAssetToken(
  payload: {
    assetId: string;
    variant?: string;
    audience?: string;
    exp: number;
  },
  signature: string
): boolean {
  const expected = signAssetToken(payload);
  return expected === signature;
}

/**
 * Parse and verify signed asset token
 * Returns payload if valid, null if invalid or expired
 */
export function parseAssetToken(token: string): {
  assetId: string;
  variant?: string;
  audience?: string;
  exp: number;
} | null {
  try {
    // Token format: base64url(payload).signature
    const [payloadB64, signature] = token.split('.');
    if (!payloadB64 || !signature) return null;

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));

    // Check expiration
    if (payload.exp < Date.now() / 1000) {
      return null;
    }

    // Verify signature
    if (!verifyAssetToken(payload, signature)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Create signed asset token
 * Returns token string in format: base64url(payload).signature
 */
export function createAssetToken(payload: {
  assetId: string;
  variant?: string;
  audience?: string;
  exp: number;
}): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = signAssetToken(payload);
  return `${payloadB64}.${signature}`;
}
