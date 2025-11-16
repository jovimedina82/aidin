/**
 * TNEF (winmail.dat) handler for Outlook emails
 * Extracts inline images and attachments from TNEF format
 */

import { EmailPart } from './emailParser';
import logger from '@/lib/logger';

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
 *
 * TNEF (Transport Neutral Encapsulation Format) is used by Microsoft Outlook
 * to package email formatting and attachments in winmail.dat files.
 *
 * Current implementation: Logs warning and returns empty array with metadata.
 * Future: Install 'node-tnef' or 'tnef' package for full extraction.
 */
export async function extractTnefParts(tnefBuffer: Buffer): Promise<EmailPart[]> {
  try {
    // Log that we received a TNEF attachment
    logger.warn('TNEF attachment detected - extraction not fully implemented', {
      bufferSize: tnefBuffer.length,
      note: 'Install node-tnef package for full support',
    });

    // Try to detect if it contains any extractable data
    // TNEF files start with signature 0x223E9F78 (little-endian)
    if (tnefBuffer.length >= 4) {
      const signature = tnefBuffer.readUInt32LE(0);
      const isTnefSignature = signature === 0x223e9f78;

      if (!isTnefSignature) {
        logger.warn('Invalid TNEF signature', {
          expected: '0x223e9f78',
          received: `0x${signature.toString(16)}`,
        });
        return [];
      }

      // Valid TNEF file detected
      logger.info('Valid TNEF file detected', {
        size: tnefBuffer.length,
        signature: `0x${signature.toString(16)}`,
      });

      // Return a placeholder part to indicate TNEF was present
      // This allows the system to track that attachments were attempted
      return [
        {
          filename: 'tnef_attachment_placeholder.txt',
          contentType: 'text/plain',
          disposition: 'attachment',
          buffer: Buffer.from(
            'This email contained a winmail.dat (TNEF) attachment from Microsoft Outlook.\n' +
              'The system detected the attachment but could not extract its contents.\n' +
              'Please ask the sender to resend the email using a different format or attach files directly.\n\n' +
              `Original TNEF size: ${tnefBuffer.length} bytes`
          ),
          size: 0,
          contentId: undefined,
        },
      ];
    }

    return [];
  } catch (error) {
    logger.error('Failed to process TNEF attachment', error as Error, {
      bufferSize: tnefBuffer?.length || 0,
    });
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
