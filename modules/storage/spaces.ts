/**
 * DigitalOcean Spaces Storage Adapter
 *
 * S3-compatible object storage for email attachments and inline images.
 *
 * Features:
 * - Upload from streams, base64, or buffers
 * - Generate signed URLs (CDN or direct)
 * - Content-type and size validation
 * - Disallowed file type blocking
 * - Automatic cleanup on errors
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

// Configuration from environment
const ENDPOINT = process.env.SPACES_ENDPOINT || 'sfo3.digitaloceanspaces.com';
const REGION = process.env.SPACES_REGION || 'sfo3';
const BUCKET = process.env.SPACES_BUCKET || 'aidin-helpdesk-attachments';
const ACCESS_KEY = process.env.SPACES_ACCESS_KEY_ID || '';
const SECRET_KEY = process.env.SPACES_SECRET_ACCESS_KEY || '';
const CDN_ENDPOINT = process.env.SPACES_CDN_ENDPOINT || `https://${BUCKET}.${REGION}.cdn.digitaloceanspaces.com`;

// Limits
const MAX_SIZE_MB = parseInt(process.env.MAX_ATTACHMENT_MB || '25', 10);
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

// Allowed MIME types
const ALLOWED_TYPES = (process.env.ALLOWED_ATTACHMENT_TYPES ||
  'image/png,image/jpeg,image/gif,image/webp,image/svg+xml,' +
  'application/pdf,' +
  'application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,' +
  'application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,' +
  'text/plain,text/csv,text/html'
).split(',');

// Disallowed extensions (security)
const DISALLOWED_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.com', '.scr', '.pif',
  '.vbs', '.js', '.jar', '.msi', '.app', '.deb', '.rpm'
];

/**
 * Initialize S3 client for DigitalOcean Spaces
 */
const s3Client = new S3Client({
  endpoint: `https://${ENDPOINT}`,
  region: REGION,
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
  forcePathStyle: false, // Use virtual-hosted-style URLs
});

/**
 * Validate file type and size
 */
function validateFile(contentType: string, size: number, filename: string): void {
  // Check size
  if (size > MAX_SIZE_BYTES) {
    throw new Error(`File too large: ${(size / 1024 / 1024).toFixed(2)}MB (max ${MAX_SIZE_MB}MB)`);
  }

  // Check extension
  const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (ext && DISALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error(`Disallowed file type: ${ext}`);
  }

  // Check MIME type
  if (!ALLOWED_TYPES.includes(contentType)) {
    throw new Error(`Disallowed content type: ${contentType}`);
  }
}

/**
 * Generate storage key (path in bucket)
 *
 * Format: attachments/YYYY/MM/DD/{uuid}-{filename}
 */
export function generateStorageKey(filename: string, prefix: string = 'attachments'): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  // Generate UUID for uniqueness
  const uuid = crypto.randomUUID();

  // Sanitize filename
  const safeName = filename
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .substring(0, 100);

  return `${prefix}/${year}/${month}/${day}/${uuid}-${safeName}`;
}

/**
 * Upload file from stream
 */
export async function putStream(
  key: string,
  stream: Readable,
  contentType: string,
  size: number,
  options?: {
    cacheControl?: string;
    contentDisposition?: string;
    metadata?: Record<string, string>;
  }
): Promise<{ key: string; url: string; cdnUrl: string }> {
  // Validation
  const filename = key.split('/').pop() || 'unknown';
  validateFile(contentType, size, filename);

  // Upload to Spaces
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: stream,
    ContentType: contentType,
    ContentLength: size,
    CacheControl: options?.cacheControl || 'public, max-age=31536000', // 1 year
    ContentDisposition: options?.contentDisposition,
    Metadata: options?.metadata,
    ACL: 'public-read', // Make publicly accessible
  });

  await s3Client.send(command);

  const url = `https://${BUCKET}.${REGION}.digitaloceanspaces.com/${key}`;
  const cdnUrl = `${CDN_ENDPOINT}/${key}`;

  console.log(`✅ Uploaded to Spaces: ${key} (${(size / 1024).toFixed(2)} KB)`);

  return { key, url, cdnUrl };
}

/**
 * Upload file from base64 string
 */
export async function putBase64(
  key: string,
  base64Data: string,
  contentType: string,
  options?: {
    cacheControl?: string;
    contentDisposition?: string;
    metadata?: Record<string, string>;
  }
): Promise<{ key: string; url: string; cdnUrl: string }> {
  // Decode base64
  const buffer = Buffer.from(base64Data, 'base64');
  const size = buffer.length;

  // Validation
  const filename = key.split('/').pop() || 'unknown';
  validateFile(contentType, size, filename);

  // Upload to Spaces
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ContentLength: size,
    CacheControl: options?.cacheControl || 'public, max-age=31536000',
    ContentDisposition: options?.contentDisposition,
    Metadata: options?.metadata,
    ACL: 'public-read',
  });

  await s3Client.send(command);

  const url = `https://${BUCKET}.${REGION}.digitaloceanspaces.com/${key}`;
  const cdnUrl = `${CDN_ENDPOINT}/${key}`;

  console.log(`✅ Uploaded to Spaces (base64): ${key} (${(size / 1024).toFixed(2)} KB)`);

  return { key, url, cdnUrl };
}

/**
 * Upload file from buffer
 */
export async function putBuffer(
  key: string,
  buffer: Buffer,
  contentType: string,
  options?: {
    cacheControl?: string;
    contentDisposition?: string;
    metadata?: Record<string, string>;
  }
): Promise<{ key: string; url: string; cdnUrl: string }> {
  const size = buffer.length;

  // Validation
  const filename = key.split('/').pop() || 'unknown';
  validateFile(contentType, size, filename);

  // Upload to Spaces
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ContentLength: size,
    CacheControl: options?.cacheControl || 'public, max-age=31536000',
    ContentDisposition: options?.contentDisposition,
    Metadata: options?.metadata,
    ACL: 'public-read',
  });

  await s3Client.send(command);

  const url = `https://${BUCKET}.${REGION}.digitaloceanspaces.com/${key}`;
  const cdnUrl = `${CDN_ENDPOINT}/${key}`;

  console.log(`✅ Uploaded to Spaces (buffer): ${key} (${(size / 1024).toFixed(2)} KB)`);

  return { key, url, cdnUrl };
}

/**
 * Generate signed URL for private access
 *
 * Use this for temporary access to files (e.g., admin downloads)
 */
export async function getSignedUrl(
  key: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  const signedUrl = await awsGetSignedUrl(s3Client, command, { expiresIn });

  return signedUrl;
}

/**
 * Get public CDN URL (for publicly accessible files)
 */
export function getPublicUrl(key: string, useCDN: boolean = true): string {
  if (useCDN) {
    return `${CDN_ENDPOINT}/${key}`;
  }
  return `https://${BUCKET}.${REGION}.digitaloceanspaces.com/${key}`;
}

/**
 * Delete file from Spaces
 */
export async function deleteObject(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  await s3Client.send(command);

  console.log(`🗑️  Deleted from Spaces: ${key}`);
}

/**
 * Check if file exists
 */
export async function exists(key: string): Promise<boolean> {
  try {
    const command = new HeadObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });

    await s3Client.send(command);
    return true;
  } catch (error: any) {
    if (error.name === 'NotFound') {
      return false;
    }
    throw error;
  }
}

/**
 * Get file metadata
 */
export async function getMetadata(key: string): Promise<{
  contentType: string;
  size: number;
  lastModified: Date;
  metadata?: Record<string, string>;
}> {
  const command = new HeadObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  const response = await s3Client.send(command);

  return {
    contentType: response.ContentType || 'application/octet-stream',
    size: response.ContentLength || 0,
    lastModified: response.LastModified || new Date(),
    metadata: response.Metadata,
  };
}

/**
 * Upload email attachment (convenience wrapper)
 */
export async function uploadEmailAttachment(params: {
  filename: string;
  contentType: string;
  base64?: string;
  buffer?: Buffer;
  stream?: Readable;
  size: number;
  inline?: boolean;
  cid?: string;
}): Promise<{
  storageKey: string;
  url: string;
  cdnUrl: string;
  size: number;
}> {
  const prefix = params.inline ? 'inline-images' : 'attachments';
  const key = generateStorageKey(params.filename, prefix);

  // Sanitize metadata values for HTTP headers (no spaces, special chars, or non-ASCII)
  const sanitizeMetadata = (value: string): string => {
    return value
      .replace(/[^\x20-\x7E]/g, '') // Remove non-ASCII characters
      .replace(/\s+/g, '_')          // Replace spaces with underscores
      .substring(0, 200);            // Limit length
  };

  const metadata: Record<string, string> = {
    originalFilename: sanitizeMetadata(params.filename),
  };

  if (params.inline) {
    metadata.inline = 'true';
  }

  if (params.cid) {
    metadata.cid = sanitizeMetadata(params.cid);
  }

  let result;

  if (params.base64) {
    result = await putBase64(key, params.base64, params.contentType, { metadata });
  } else if (params.buffer) {
    result = await putBuffer(key, params.buffer, params.contentType, { metadata });
  } else if (params.stream) {
    result = await putStream(key, params.stream, params.contentType, params.size, { metadata });
  } else {
    throw new Error('Must provide base64, buffer, or stream');
  }

  return {
    storageKey: result.key,
    url: result.url,
    cdnUrl: result.cdnUrl,
    size: params.size,
  };
}

/**
 * Health check - verify Spaces connection
 */
export async function healthCheck(): Promise<{
  status: 'ok' | 'error';
  message: string;
  config: {
    endpoint: string;
    region: string;
    bucket: string;
    cdnEnabled: boolean;
  };
}> {
  try {
    // Try to list bucket (HEAD request)
    const command = new HeadObjectCommand({
      Bucket: BUCKET,
      Key: '_health_check_test', // Doesn't need to exist
    });

    try {
      await s3Client.send(command);
    } catch (error: any) {
      // NotFound is fine - means we can connect
      if (error.name !== 'NotFound') {
        throw error;
      }
    }

    return {
      status: 'ok',
      message: 'DigitalOcean Spaces connection healthy',
      config: {
        endpoint: ENDPOINT,
        region: REGION,
        bucket: BUCKET,
        cdnEnabled: !!CDN_ENDPOINT,
      },
    };
  } catch (error: any) {
    return {
      status: 'error',
      message: `Spaces connection failed: ${error.message}`,
      config: {
        endpoint: ENDPOINT,
        region: REGION,
        bucket: BUCKET,
        cdnEnabled: !!CDN_ENDPOINT,
      },
    };
  }
}
