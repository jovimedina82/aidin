/**
 * HMAC Webhook Security
 *
 * Timing-safe HMAC validation for webhook authentication.
 *
 * Prevents:
 * - Unauthorized webhook calls
 * - Timing attacks
 * - Replay attacks (when combined with timestamp validation)
 */

import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Generate HMAC signature for payload
 *
 * @param payload - Request body (JSON string or object)
 * @param secret - Webhook secret key
 * @param algorithm - Hash algorithm (default: sha256)
 * @returns Hex-encoded HMAC signature
 */
export function generateHmacSignature(
  payload: string | object,
  secret: string,
  algorithm: 'sha256' | 'sha512' = 'sha256'
): string {
  const data = typeof payload === 'string' ? payload : JSON.stringify(payload);

  const hmac = createHmac(algorithm, secret);
  hmac.update(data);

  return hmac.digest('hex');
}

/**
 * Validate HMAC signature (timing-safe comparison)
 *
 * @param payload - Request body (JSON string or object)
 * @param signature - Provided signature (hex string)
 * @param secret - Webhook secret key
 * @param algorithm - Hash algorithm (default: sha256)
 * @returns True if signature is valid
 */
export function validateHmacSignature(
  payload: string | object,
  signature: string,
  secret: string,
  algorithm: 'sha256' | 'sha512' = 'sha256'
): boolean {
  if (!signature || !secret) {
    return false;
  }

  try {
    const expectedSignature = generateHmacSignature(payload, secret, algorithm);

    // Convert both signatures to buffers for timing-safe comparison
    const sigBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    // Length must match
    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }

    // Timing-safe comparison (prevents timing attacks)
    return timingSafeEqual(sigBuffer, expectedBuffer);
  } catch (error) {
    console.error('HMAC validation error:', error);
    return false;
  }
}

/**
 * Validate webhook request with HMAC
 *
 * Supports multiple header formats:
 * - X-Webhook-Signature: <hex-signature>
 * - X-Hub-Signature-256: sha256=<hex-signature> (GitHub style)
 * - X-Signature: <hex-signature>
 *
 * @param payload - Request body
 * @param headers - Request headers (Record or Headers object)
 * @param secret - Webhook secret key
 * @returns True if valid
 */
export function validateWebhookRequest(
  payload: string | object,
  headers: Record<string, string | null | undefined> | Headers,
  secret: string
): boolean {
  // Extract signature from headers
  let signature: string | null = null;

  if (headers instanceof Headers) {
    signature =
      headers.get('x-webhook-signature') ||
      headers.get('x-hub-signature-256') ||
      headers.get('x-signature');
  } else {
    signature =
      headers['x-webhook-signature'] ||
      headers['x-hub-signature-256'] ||
      headers['x-signature'] ||
      null;
  }

  if (!signature) {
    console.warn('No webhook signature found in headers');
    return false;
  }

  // Handle GitHub-style format: "sha256=<signature>"
  if (signature.startsWith('sha256=')) {
    signature = signature.substring(7);
  } else if (signature.startsWith('sha512=')) {
    signature = signature.substring(7);
    return validateHmacSignature(payload, signature, secret, 'sha512');
  }

  return validateHmacSignature(payload, signature, secret, 'sha256');
}

/**
 * Validate webhook with simple secret comparison (less secure, but simpler)
 *
 * Use this for basic authentication when HMAC is overkill.
 * Still uses timing-safe comparison.
 *
 * @param providedSecret - Secret from request header
 * @param expectedSecret - Expected secret
 * @returns True if secrets match
 */
export function validateSimpleSecret(
  providedSecret: string | null | undefined,
  expectedSecret: string
): boolean {
  if (!providedSecret || !expectedSecret) {
    return false;
  }

  try {
    const providedBuffer = Buffer.from(providedSecret, 'utf8');
    const expectedBuffer = Buffer.from(expectedSecret, 'utf8');

    if (providedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(providedBuffer, expectedBuffer);
  } catch (error) {
    console.error('Secret validation error:', error);
    return false;
  }
}

/**
 * Validate timestamp to prevent replay attacks
 *
 * @param timestamp - Timestamp from request (ISO string or Unix timestamp)
 * @param maxAgeSeconds - Maximum age of request (default: 300 = 5 minutes)
 * @returns True if timestamp is within acceptable range
 */
export function validateTimestamp(
  timestamp: string | number,
  maxAgeSeconds: number = 300
): boolean {
  try {
    const requestTime = typeof timestamp === 'string'
      ? new Date(timestamp).getTime()
      : timestamp * 1000; // Convert Unix timestamp to milliseconds

    const now = Date.now();
    const age = now - requestTime;

    // Check if timestamp is too old
    if (age > maxAgeSeconds * 1000) {
      console.warn(`Timestamp too old: ${age}ms (max: ${maxAgeSeconds * 1000}ms)`);
      return false;
    }

    // Check if timestamp is in the future (clock skew tolerance: 60s)
    if (age < -60000) {
      console.warn(`Timestamp in future: ${age}ms`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Timestamp validation error:', error);
    return false;
  }
}

/**
 * Combined validation: HMAC + Timestamp
 *
 * @param payload - Request body
 * @param headers - Request headers
 * @param secret - Webhook secret
 * @param options - Validation options
 * @returns True if both HMAC and timestamp are valid
 */
export function validateWebhookSecure(
  payload: string | object,
  headers: Record<string, string | null | undefined> | Headers,
  secret: string,
  options?: {
    validateTimestamp?: boolean;
    maxAgeSeconds?: number;
    timestampHeader?: string;
  }
): boolean {
  // Validate HMAC
  const hmacValid = validateWebhookRequest(payload, headers, secret);
  if (!hmacValid) {
    return false;
  }

  // Optional: validate timestamp
  if (options?.validateTimestamp) {
    const timestampHeader = options.timestampHeader || 'x-timestamp';
    let timestamp: string | null = null;

    if (headers instanceof Headers) {
      timestamp = headers.get(timestampHeader);
    } else {
      timestamp = headers[timestampHeader] || null;
    }

    if (!timestamp) {
      console.warn('Timestamp validation enabled but no timestamp header found');
      return false;
    }

    const timestampValid = validateTimestamp(timestamp, options.maxAgeSeconds);
    if (!timestampValid) {
      return false;
    }
  }

  return true;
}
