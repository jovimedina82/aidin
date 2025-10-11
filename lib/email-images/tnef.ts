/**
 * TNEF (winmail.dat) handler for Outlook emails
 * Extracts inline images and attachments from TNEF format
 */

import { EmailPart } from './emailParser';

/**
 * Detect if a part is a TNEF attachment
 */
export function isTnef(part: EmailPart): boolean {
  return (
    part.filename.toLowerCase() === 'winmail.dat' ||
    part.contentType === 'application/ms-tnef' ||
    part.contentType === 'application/vnd.ms-tnef'
  );
}

/**
 * Extract parts from TNEF attachment
 * Note: This is a stub implementation. In production, use a library like 'tnef' or 'node-tnef'
 * For now, we'll just return an empty array
 */
export async function extractTnefParts(tnefBuffer: Buffer): Promise<EmailPart[]> {
  try {
    // TODO: Implement TNEF extraction using a library
    // Example with 'tnef' package (not installed by default):
    // const tnef = require('tnef');
    // const parsed = tnef.parse(tnefBuffer);
    // return parsed.attachments.map(att => ({
    //   filename: att.name,
    //   contentType: att.mimeType,
    //   disposition: att.inline ? 'inline' : 'attachment',
    //   buffer: att.data,
    //   size: att.data.length,
    //   contentId: att.contentId
    // }));

    console.warn('⚠️  TNEF extraction not implemented - skipping winmail.dat');
    return [];
  } catch (error) {
    console.error('Failed to extract TNEF parts:', error);
    return [];
  }
}

/**
 * Process email parts and extract TNEF if present
 */
export async function processTnefParts(parts: EmailPart[]): Promise<EmailPart[]> {
  const result: EmailPart[] = [];

  for (const part of parts) {
    if (isTnef(part)) {
      // Extract TNEF parts and add them
      const extracted = await extractTnefParts(part.buffer);
      result.push(...extracted);
    } else {
      // Keep non-TNEF parts as-is
      result.push(part);
    }
  }

  return result;
}
