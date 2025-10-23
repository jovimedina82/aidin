/**
 * Email image processor - main orchestration
 * Handles complete email processing pipeline with image extraction and CID resolution
 */

import { PrismaClient } from '@/lib/generated/prisma';
import { parseEmail, extractInlineImages, extractImageAttachments } from './emailParser';
import { processImageAsset, isImageMime, getExtensionFromMime } from './assetStore';
import {
  sanitizeHtml,
  extractCidReferences,
  extractDataUriImages,
  rewriteCidReferences,
  rewriteDataUriImages,
} from './htmlSanitizer';
import { buildCidMap, createSignedAssetUrl } from './cidResolver';
import { processTnefParts } from './tnef';

const prisma = new PrismaClient();

export interface ProcessEmailOptions {
  ticketId: string;
  emailPayload: any; // Can be Graph, MIME, or pre-parsed
  maxFileSize?: number;
  maxTotalSize?: number;
}

export interface ProcessEmailResult {
  messageId: string;
  assetsCount: number;
  inlineImagesCount: number;
  attachmentsCount: number;
}

/**
 * Process inbound email with image extraction and CID resolution
 */
export async function processInboundEmail(
  options: ProcessEmailOptions
): Promise<ProcessEmailResult> {
  const { ticketId, emailPayload, maxFileSize = 25 * 1024 * 1024, maxTotalSize = 50 * 1024 * 1024 } = options;

  // 1. Parse email
  const parsed = await parseEmail(emailPayload);
  console.log(`📧 Processing email: ${parsed.messageId} (${parsed.subject})`);

  // 2. Check for existing message (idempotency)
  const existing = await prisma.inboundMessage.findUnique({
    where: { messageId: parsed.messageId },
  });

  if (existing) {
    console.log(`✓ Email already processed: ${parsed.messageId}`);
    const assetsCount = await prisma.messageAsset.count({
      where: { messageId: parsed.messageId },
    });
    return {
      messageId: parsed.messageId,
      assetsCount,
      inlineImagesCount: 0,
      attachmentsCount: 0,
    };
  }

  // 3. Process TNEF if present
  let parts = await processTnefParts(parsed.parts);

  // 4. Validate file sizes
  let totalSize = 0;
  for (const part of parts) {
    if (part.size > maxFileSize) {
      throw new Error(`File ${part.filename} exceeds max size of ${maxFileSize} bytes`);
    }
    totalSize += part.size;
  }
  if (totalSize > maxTotalSize) {
    throw new Error(`Total email size ${totalSize} exceeds max size of ${maxTotalSize} bytes`);
  }

  // 5. Create InboundMessage record
  const inboundMessage = await prisma.inboundMessage.create({
    data: {
      ticketId,
      messageId: parsed.messageId,
      from: parsed.from,
      subject: parsed.subject,
      receivedAt: new Date(),
      htmlRaw: parsed.html || null,
      textPlain: parsed.text || null,
    },
  });

  console.log(`✅ Created InboundMessage: ${inboundMessage.id}`);

  // 6. Extract and process inline images (CID references)
  const inlineImages = extractInlineImages(parts);
  const cidMap = new Map<string, string>();

  for (const part of inlineImages) {
    if (!isImageMime(part.contentType)) continue;

    try {
      // Process image (generate web + thumb variants)
      const ext = getExtensionFromMime(part.contentType, '.img');
      const processed = await processImageAsset(part.buffer, ticketId, part.contentType, ext);

      // Create MessageAsset records for all variants
      const variants = [
        { variant: 'original', metadata: processed.original },
        { variant: 'web', metadata: processed.web },
        { variant: 'thumb', metadata: processed.thumb },
      ];

      for (const { variant, metadata } of variants) {
        const asset = await prisma.messageAsset.create({
          data: {
            messageId: inboundMessage.id,
            ticketId,
            kind: 'inline',
            contentId: part.contentId || null,
            filename: part.filename,
            mime: variant === 'original' ? part.contentType : 'image/webp',
            size: metadata.size,
            sha256: processed.hash,
            width: metadata.width || null,
            height: metadata.height || null,
            storageKey: metadata.storageKey,
            variant: variant as any,
          },
        });

        // Build CID map with web variant
        if (variant === 'web' && part.contentId) {
          const normalizedCid = part.contentId.replace(/^<|>$/g, '');
          const signedUrl = createSignedAssetUrl(asset.id, ticketId, 'web');
          cidMap.set(normalizedCid, signedUrl);
        }
      }

      console.log(`✅ Processed inline image: ${part.filename} (CID: ${part.contentId})`);
    } catch (error) {
      console.error(`❌ Failed to process inline image ${part.filename}:`, error);
    }
  }

  // 7. Extract and process data URI images from HTML
  const dataUriMap = new Map<string, string>();

  if (parsed.html) {
    const dataUris = extractDataUriImages(parsed.html);

    for (const { dataUri, mime, base64 } of dataUris) {
      try {
        const buffer = Buffer.from(base64, 'base64');
        const ext = getExtensionFromMime(mime, '.img');
        const processed = await processImageAsset(buffer, ticketId, mime, ext);

        // Create MessageAsset records
        const variants = [
          { variant: 'original', metadata: processed.original },
          { variant: 'web', metadata: processed.web },
          { variant: 'thumb', metadata: processed.thumb },
        ];

        for (const { variant, metadata } of variants) {
          const asset = await prisma.messageAsset.create({
            data: {
              messageId: inboundMessage.id,
              ticketId,
              kind: 'inline',
              contentId: null,
              filename: `data-uri-${processed.hash}${ext}`,
              mime: variant === 'original' ? mime : 'image/webp',
              size: metadata.size,
              sha256: processed.hash,
              width: metadata.width || null,
              height: metadata.height || null,
              storageKey: metadata.storageKey,
              variant: variant as any,
            },
          });

          if (variant === 'web') {
            const signedUrl = createSignedAssetUrl(asset.id, ticketId, 'web');
            dataUriMap.set(dataUri, signedUrl);
          }
        }

        console.log(`✅ Processed data URI image: ${processed.hash}`);
      } catch (error) {
        console.error(`❌ Failed to process data URI image:`, error);
      }
    }
  }

  // 8. Process non-inline image attachments
  const attachments = parts.filter((p) => !inlineImages.includes(p));
  let attachmentCount = 0;

  for (const part of attachments) {
    if (!isImageMime(part.contentType)) {
      // Non-image attachments - store as-is (optional)
      continue;
    }

    try {
      const ext = getExtensionFromMime(part.contentType, '.img');
      const processed = await processImageAsset(part.buffer, ticketId, part.contentType, ext);

      const variants = [
        { variant: 'original', metadata: processed.original },
        { variant: 'web', metadata: processed.web },
        { variant: 'thumb', metadata: processed.thumb },
      ];

      for (const { variant, metadata } of variants) {
        await prisma.messageAsset.create({
          data: {
            messageId: inboundMessage.id,
            ticketId,
            kind: 'attachment',
            contentId: null,
            filename: part.filename,
            mime: variant === 'original' ? part.contentType : 'image/webp',
            size: metadata.size,
            sha256: processed.hash,
            width: metadata.width || null,
            height: metadata.height || null,
            storageKey: metadata.storageKey,
            variant: variant as any,
          },
        });
      }

      attachmentCount++;
      console.log(`✅ Processed image attachment: ${part.filename}`);
    } catch (error) {
      console.error(`❌ Failed to process attachment ${part.filename}:`, error);
    }
  }

  // 9. Rewrite HTML with resolved CIDs and data URIs
  let htmlSanitized = parsed.html || '';

  if (htmlSanitized) {
    // Rewrite CID references
    htmlSanitized = rewriteCidReferences(htmlSanitized, cidMap);

    // Rewrite data URIs
    htmlSanitized = rewriteDataUriImages(htmlSanitized, dataUriMap);

    // Sanitize HTML
    htmlSanitized = await sanitizeHtml(htmlSanitized);
  }

  // 10. Update InboundMessage with sanitized HTML
  await prisma.inboundMessage.update({
    where: { id: inboundMessage.id },
    data: {
      htmlSanitized,
    },
  });

  console.log(`✅ Email processing complete: ${parsed.messageId}`);
  console.log(`   - Inline images: ${inlineImages.length}`);
  console.log(`   - Data URI images: ${dataUriMap.size}`);
  console.log(`   - Image attachments: ${attachmentCount}`);

  return {
    messageId: parsed.messageId,
    assetsCount: (inlineImages.length + dataUriMap.size + attachmentCount) * 3, // 3 variants each
    inlineImagesCount: inlineImages.length + dataUriMap.size,
    attachmentsCount: attachmentCount,
  };
}
