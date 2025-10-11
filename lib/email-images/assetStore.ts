/**
 * Asset storage service for email images
 * Supports local disk (dev) and S3-compatible storage (prod)
 */

import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { sha256 } from './hash';

const STORAGE_DRIVER = process.env.ASSETS_DRIVER || 'disk';
const ASSETS_DIR = process.env.ASSETS_DIR || path.join(process.cwd(), 'storage', 'assets');
const S3_BUCKET = process.env.S3_BUCKET || '';
const S3_REGION = process.env.S3_REGION || 'us-east-1';
const S3_ENDPOINT = process.env.S3_ENDPOINT;
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY;
const S3_SECRET_KEY = process.env.S3_SECRET_KEY;

// S3 client (lazy init)
let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: S3_REGION,
      endpoint: S3_ENDPOINT,
      credentials: S3_ACCESS_KEY && S3_SECRET_KEY
        ? {
            accessKeyId: S3_ACCESS_KEY,
            secretAccessKey: S3_SECRET_KEY,
          }
        : undefined,
    });
  }
  return s3Client;
}

export interface AssetMetadata {
  storageKey: string;
  url?: string;
  width?: number;
  height?: number;
  size: number;
}

/**
 * Store asset buffer to disk or S3
 */
export async function putAsset(
  buffer: Buffer,
  storageKey: string,
  contentType: string
): Promise<AssetMetadata> {
  if (STORAGE_DRIVER === 's3') {
    const client = getS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: storageKey,
        Body: buffer,
        ContentType: contentType,
      })
    );

    return {
      storageKey,
      size: buffer.length,
    };
  } else {
    // Disk storage
    const fullPath = path.join(ASSETS_DIR, storageKey);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);

    return {
      storageKey,
      size: buffer.length,
    };
  }
}

/**
 * Get asset from disk or S3
 */
export async function getAsset(storageKey: string): Promise<Buffer> {
  if (STORAGE_DRIVER === 's3') {
    const client = getS3Client();
    const response = await client.send(
      new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: storageKey,
      })
    );

    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } else {
    const fullPath = path.join(ASSETS_DIR, storageKey);
    return await fs.readFile(fullPath);
  }
}

/**
 * Generate signed URL for S3 asset (or local path for disk)
 */
export async function getAssetUrl(storageKey: string, ttl: number = 900): Promise<string> {
  if (STORAGE_DRIVER === 's3') {
    const client = getS3Client();
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: storageKey,
    });
    return await getSignedUrl(client, command, { expiresIn: ttl });
  } else {
    // For disk storage, we'll return a relative path that will be served through our API
    const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
    return `${appBaseUrl}/api/assets/serve?key=${encodeURIComponent(storageKey)}`;
  }
}

/**
 * Derive web-optimized image (WEBP, max 1600px)
 */
export async function deriveWebImage(buffer: Buffer): Promise<{ buffer: Buffer; width: number; height: number }> {
  const image = sharp(buffer).rotate(); // Auto-rotate based on EXIF
  const metadata = await image.metadata();

  let processedImage = image.webp({ quality: 85 });

  // Resize if too large
  if (metadata.width && metadata.width > 1600) {
    processedImage = processedImage.resize(1600, null, {
      withoutEnlargement: true,
      fit: 'inside',
    });
  }

  const outputBuffer = await processedImage.toBuffer();
  const outputMetadata = await sharp(outputBuffer).metadata();

  return {
    buffer: outputBuffer,
    width: outputMetadata.width || 0,
    height: outputMetadata.height || 0,
  };
}

/**
 * Derive thumbnail (320px, WEBP)
 */
export async function deriveThumbImage(buffer: Buffer): Promise<{ buffer: Buffer; width: number; height: number }> {
  const image = sharp(buffer).rotate(); // Auto-rotate based on EXIF

  const outputBuffer = await image
    .resize(320, 320, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 75 })
    .toBuffer();

  const metadata = await sharp(outputBuffer).metadata();

  return {
    buffer: outputBuffer,
    width: metadata.width || 0,
    height: metadata.height || 0,
  };
}

/**
 * Process and store an image asset (original + web + thumb)
 */
export async function processImageAsset(
  buffer: Buffer,
  ticketId: string,
  contentType: string,
  extension: string
): Promise<{
  hash: string;
  original: AssetMetadata;
  web: AssetMetadata;
  thumb: AssetMetadata;
}> {
  const hash = sha256(buffer);

  // Store original
  const originalKey = `tickets/${ticketId}/${hash}/original${extension}`;
  const original = await putAsset(buffer, originalKey, contentType);

  // Derive and store web variant
  const webDerived = await deriveWebImage(buffer);
  const webKey = `tickets/${ticketId}/${hash}/web.webp`;
  const web = await putAsset(webDerived.buffer, webKey, 'image/webp');
  web.width = webDerived.width;
  web.height = webDerived.height;

  // Derive and store thumbnail
  const thumbDerived = await deriveThumbImage(buffer);
  const thumbKey = `tickets/${ticketId}/${hash}/thumb.webp`;
  const thumb = await putAsset(thumbDerived.buffer, thumbKey, 'image/webp');
  thumb.width = thumbDerived.width;
  thumb.height = thumbDerived.height;

  return { hash, original, web, thumb };
}

/**
 * Check if a file is an image based on MIME type
 */
export function isImageMime(mime: string): boolean {
  return mime.startsWith('image/') && !mime.includes('svg');
}

/**
 * Get file extension from MIME type
 */
export function getExtensionFromMime(mime: string, fallback: string = '.bin'): string {
  const mimeMap: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/bmp': '.bmp',
    'image/tiff': '.tiff',
  };
  return mimeMap[mime.toLowerCase()] || fallback;
}
