/**
 * Redaction utilities for AIDIN Audit Log
 * Implements multi-level data sanitization policies
 */

import crypto from 'crypto';
import type { RedactionLevel } from './types';

/**
 * Redact sensitive data based on redaction level
 */
export function redactData(
  data: unknown,
  level: RedactionLevel
): unknown {
  if (level === 0) {
    return data;
  }

  if (data === null || data === undefined) {
    return data;
  }

  // Handle different data types
  if (typeof data === 'string') {
    return redactString(data, level);
  }

  if (Array.isArray(data)) {
    return data.map((item) => redactData(item, level));
  }

  if (typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      // Check if key suggests sensitive data
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('password') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('token') ||
        lowerKey.includes('apikey') ||
        lowerKey.includes('api_key')
      ) {
        result[key] = level === 2 ? '[REDACTED]' : maskToken(String(value));
      } else if (lowerKey.includes('email')) {
        result[key] = redactEmail(String(value), level);
      } else if (lowerKey.includes('phone') || lowerKey.includes('mobile')) {
        result[key] = redactPhone(String(value), level);
      } else if (lowerKey.includes('ssn') || lowerKey.includes('social')) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = redactData(value, level);
      }
    }
    return result;
  }

  return data;
}

/**
 * Redact string data
 */
function redactString(str: string, level: RedactionLevel): string {
  // Check if it looks like an email
  if (str.includes('@')) {
    return redactEmail(str, level);
  }

  // Check if it looks like a phone number
  if (/\+?\d[\d\s\-()]{7,}/.test(str)) {
    return redactPhone(str, level);
  }

  // Truncate long strings in moderate mode
  if (level === 1 && str.length > 500) {
    return str.substring(0, 500) + '... [truncated]';
  }

  // Aggressively truncate in level 2
  if (level === 2 && str.length > 200) {
    return str.substring(0, 200) + '... [truncated]';
  }

  return str;
}

/**
 * Redact email addresses
 * Level 1: Hash local part (user@example.com -> a3f8d9...@example.com)
 * Level 2: Domain only (user@example.com -> ***@example.com)
 */
export function redactEmail(email: string, level: RedactionLevel): string {
  if (level === 0) {
    return email;
  }

  const parts = email.split('@');
  if (parts.length !== 2) {
    return email; // Invalid email, return as-is
  }

  const [localPart, domain] = parts;

  if (level === 1) {
    // Hash the local part with first 8 chars of SHA-256
    const hash = crypto
      .createHash('sha256')
      .update(localPart)
      .digest('hex')
      .substring(0, 8);
    return `${hash}@${domain}`;
  }

  // Level 2: Replace local part with asterisks
  return `***@${domain}`;
}

/**
 * Redact phone numbers
 * Level 1: Mask middle digits (555-1234 -> 555-**34)
 * Level 2: Full mask (555-1234 -> ***-****)
 */
export function redactPhone(phone: string, level: RedactionLevel): string {
  if (level === 0) {
    return phone;
  }

  // Extract digits only
  const digits = phone.replace(/\D/g, '');

  if (level === 1) {
    // Keep first 3 and last 2 digits, mask the rest
    if (digits.length >= 5) {
      const prefix = digits.substring(0, 3);
      const suffix = digits.substring(digits.length - 2);
      const masked = '*'.repeat(digits.length - 5);
      return `${prefix}-${masked}${suffix}`;
    }
  }

  // Level 2: Full mask
  return '*'.repeat(Math.min(digits.length, 10));
}

/**
 * Mask API tokens/secrets
 * Shows only first and last 4 characters
 */
export function maskToken(token: string): string {
  if (!token || token.length <= 8) {
    return '****';
  }

  const start = token.substring(0, 4);
  const end = token.substring(token.length - 4);
  const masked = '*'.repeat(Math.min(token.length - 8, 20));

  return `${start}${masked}${end}`;
}

/**
 * Redact IP addresses
 * Level 1: Mask last octet (192.168.1.100 -> 192.168.1.***)
 * Level 2: Mask last two octets (192.168.1.100 -> 192.168.**.***)
 */
export function redactIP(ip: string, level: RedactionLevel): string {
  if (level === 0) {
    return ip;
  }

  // IPv4
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
    const parts = ip.split('.');
    if (level === 1) {
      parts[3] = '***';
      return parts.join('.');
    } else {
      parts[2] = '***';
      parts[3] = '***';
      return parts.join('.');
    }
  }

  // IPv6 - mask last segment(s)
  if (ip.includes(':')) {
    const parts = ip.split(':');
    if (level === 1) {
      parts[parts.length - 1] = '****';
      return parts.join(':');
    } else {
      parts[parts.length - 1] = '****';
      parts[parts.length - 2] = '****';
      return parts.join(':');
    }
  }

  return ip;
}

/**
 * Sanitize metadata before storing
 * Removes known sensitive fields entirely
 */
export function sanitizeMetadata(
  metadata: Record<string, unknown>,
  level: RedactionLevel
): Record<string, unknown> {
  const sanitized = { ...metadata };
  const sensitiveKeys = [
    'password',
    'pwd',
    'secret',
    'apiKey',
    'api_key',
    'privateKey',
    'private_key',
    'accessToken',
    'access_token',
    'refreshToken',
    'refresh_token',
    'ssn',
    'socialSecurity',
    'creditCard',
    'cvv',
  ];

  for (const key of sensitiveKeys) {
    if (key in sanitized) {
      delete sanitized[key];
    }
  }

  // Apply redaction to remaining fields
  return redactData(sanitized, level) as Record<string, unknown>;
}
