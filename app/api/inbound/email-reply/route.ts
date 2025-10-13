/**
 * Direct Reply Endpoint - Existing Ticket Threading
 *
 * POST /api/inbound/email-reply
 *
 * Handles replies to existing tickets (appends as comments).
 * Uses In-Reply-To/References headers and subject token fallback.
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/lib/generated/prisma';
import { validateSimpleSecret } from '@/lib/security/hmac';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { sanitizeHtml, getTextPreview } from '@/lib/security/html-sanitizer';
import { extractTicketId } from '@/modules/tickets/subject';
import { uploadEmailAttachment } from '@/modules/storage/spaces';
import { logEvent } from '@/lib/audit';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

const ENABLED = process.env.INBOUND_EMAIL_ENABLED === 'true';
const WEBHOOK_SECRET = process.env.REPLY_WEBHOOK_SECRET || process.env.N8N_WEBHOOK_SECRET || '';

export async function POST(request: NextRequest) {
  try {
    // EMERGENCY KILL SWITCH - Disable reply processing to stop email loop
    if (process.env.EMAIL_SENDING_DISABLED === 'true') {
      console.log('🛑 REPLY PROCESSING DISABLED - Email loop prevention active');
      return NextResponse.json(
        { error: 'Reply processing temporarily disabled' },
        { status: 503 }
      );
    }

    // Feature flag check
    if (!ENABLED) {
      return NextResponse.json(
        { error: 'Email ingestion disabled' },
        { status: 503 }
      );
    }

    // 1. Validate webhook secret
    const providedSecret = request.headers.get('x-webhook-secret');
    if (!validateSimpleSecret(providedSecret, WEBHOOK_SECRET)) {
      console.warn('Invalid webhook secret for reply endpoint');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse payload
    const payload = await request.json();
    const {
      ticketNumber,
      messageId,
      inReplyTo,
      references,
      conversationId,
      from,
      to,
      subject,
      html,
      text,
      attachments = []
    } = payload;

    // 3. Rate limiting
    const rateLimit = await checkRateLimit(from, '/api/inbound/email-reply');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          retryAfter: rateLimit.retryAfter
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfter || 60)
          }
        }
      );
    }

    // 4. Idempotency check
    const existing = await prisma.emailIngest.findUnique({
      where: { messageId }
    });

    if (existing) {
      console.log(`✓ Duplicate reply (Message-ID: ${messageId})`);
      return NextResponse.json({
        status: 'duplicate',
        ticketId: existing.ticketId,
        messageId
      });
    }

    // 5. Find original ticket
    let ticket = null;

    // Strategy 0: Direct ticketNumber from payload (email polling service)
    if (ticketNumber) {
      ticket = await prisma.ticket.findFirst({
        where: { ticketNumber }
      });
    }

    // Strategy 1: In-Reply-To header
    if (inReplyTo) {
      const originalEmail = await prisma.emailIngest.findUnique({
        where: { messageId: inReplyTo }
      });

      if (originalEmail?.ticketId) {
        ticket = await prisma.ticket.findUnique({
          where: { id: originalEmail.ticketId }
        });
      }
    }

    // Strategy 2: References header (last message in chain)
    if (!ticket && references && Array.isArray(references) && references.length > 0) {
      const lastRef = references[references.length - 1];
      const refEmail = await prisma.emailIngest.findUnique({
        where: { messageId: lastRef }
      });

      if (refEmail?.ticketId) {
        ticket = await prisma.ticket.findUnique({
          where: { id: refEmail.ticketId }
        });
      }
    }

    // Strategy 3: Conversation ID (Microsoft Graph)
    if (!ticket && conversationId) {
      ticket = await prisma.ticket.findFirst({
        where: { emailConversationId: conversationId }
      });
    }

    // Strategy 4: Extract ticket ID from subject
    if (!ticket) {
      const ticketId = extractTicketId(subject);
      if (ticketId) {
        ticket = await prisma.ticket.findFirst({
          where: { ticketNumber: ticketId }
        });
      }
    }

    // No ticket found
    if (!ticket) {
      console.error(`❌ Could not find ticket for reply: ${subject}`);
      return NextResponse.json(
        {
          error: 'Could not find original ticket',
          subject,
          inReplyTo,
          conversationId
        },
        { status: 404 }
      );
    }

    // 6. Sanitize HTML
    const sanitizedHtml = html ? sanitizeHtml(html, { strict: true }) : null;
    let plainText = text || getTextPreview(sanitizedHtml || '', 10000);

    // Strip quoted email replies to extract only the new message
    const replyIndicators = [
      /^From:.*$/m,
      /^Sent:.*$/m,
      /^To:.*$/m,
      /^Subject:.*$/m,
      /^On .* wrote:$/m,
      /^[-_]{3,}.*Original Message.*[-_]{3,}/im,
      /^>+.*$/gm,
      /^Get Outlook for (iOS|Android)/m,
      /^Sent from my (iPhone|iPad|Android)/m,
    ];

    // Find the earliest match of any reply indicator
    let cutoffIndex = -1;
    for (const indicator of replyIndicators) {
      const match = plainText.match(indicator);
      if (match && match.index !== undefined) {
        if (cutoffIndex === -1 || match.index < cutoffIndex) {
          cutoffIndex = match.index;
        }
      }
    }

    // If we found a reply indicator, cut the text there
    if (cutoffIndex > 0) {
      plainText = plainText.substring(0, cutoffIndex).trim();
    }

    // Remove common email signatures
    plainText = plainText
      .replace(/\n*--+\s*\n.*$/s, '')
      .trim();

    const snippet = getTextPreview(plainText, 200);

    // 7. Upload attachments
    const uploadedAttachments: any[] = [];

    for (const att of attachments.slice(0, 10)) {
      try {
        const result = await uploadEmailAttachment({
          filename: att.filename,
          contentType: att.contentType,
          base64: att.base64,
          size: att.size,
          inline: att.inline,
          cid: att.cid
        });

        uploadedAttachments.push({
          ...result,
          filename: att.filename,
          contentType: att.contentType,
          inline: att.inline,
          cid: att.cid
        });
      } catch (error: any) {
        console.error(`Failed to upload attachment ${att.filename}:`, error.message);
      }
    }

    // 8. Find or create user
    let author = await prisma.user.findFirst({
      where: { email: from.toLowerCase() }
    });

    if (!author) {
      const [firstName, ...rest] = from.split('@')[0].split('.');
      const lastName = rest.join(' ') || 'User';

      author = await prisma.user.create({
        data: {
          email: from.toLowerCase(),
          firstName: firstName.charAt(0).toUpperCase() + firstName.slice(1),
          lastName: lastName.charAt(0).toUpperCase() + lastName.slice(1),
          userType: 'Client'
        }
      });
    }

    // 9. Create EmailIngest record
    const dedupeHash = createHash('sha256')
      .update(`${messageId}|${from}|${subject}`)
      .digest('hex');

    const emailIngest = await prisma.emailIngest.create({
      data: {
        messageId,
        inReplyTo,
        references: references ? JSON.stringify(references) : null,
        conversationId,
        from,
        to,
        subject,
        html: sanitizedHtml,
        text: plainText,
        snippet,
        dedupeHash,
        ticketId: ticket.id,
        processedAt: new Date()
      }
    });

    // 10. Resolve CID references in HTML (inline images) and strip HTML quoted content
    const { resolveCidReferences } = await import('@/lib/email/cid-resolver');
    let processedHtml = resolveCidReferences(sanitizedHtml || '', uploadedAttachments);

    // Also strip quoted content from HTML if present
    // Look for common HTML quote patterns like <div class="gmail_quote"> or email headers in HTML
    const htmlQuotePatterns = [
      /<div class="gmail_quote">.*?<\/div>/is,
      /<blockquote.*?>.*?<\/blockquote>/is,
      /<div.*?class=".*?OutlookMessageHeader.*?".*?>.*?<\/div>/is,
      /(<br>|<div>)\s*From:.*$/is,
      /(<br>|<div>)\s*Sent:.*$/is,
    ];

    for (const pattern of htmlQuotePatterns) {
      const match = processedHtml.match(pattern);
      if (match && match.index !== undefined) {
        processedHtml = processedHtml.substring(0, match.index).trim();
        break; // Stop at first match
      }
    }

    const htmlWithResolvedCids = processedHtml;

    // 11. Create TicketMessage (kind='email')
    const ticketMessage = await prisma.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        kind: 'email',
        authorEmail: from,
        authorName: `${author.firstName} ${author.lastName}`,
        html: htmlWithResolvedCids,
        text: plainText,
        subject,
        metadata: JSON.stringify({
          emailIngestId: emailIngest.id,
          attachmentCount: uploadedAttachments.length,
          isReply: true
        })
      }
    });

    // 12. Save attachments
    for (const att of uploadedAttachments) {
      // Create EmailAttachment record (for tracking)
      await prisma.emailAttachment.create({
        data: {
          emailIngestId: emailIngest.id,
          filename: att.filename,
          contentType: att.contentType,
          size: att.size,
          storageKey: att.storageKey,
          storageUrl: att.cdnUrl,
          isInline: att.inline || false,
          cid: att.cid,
          virusScanStatus: 'pending'
        }
      });

      // Also create Attachment record so it appears in the ticket's Attachments section
      await prisma.attachment.create({
        data: {
          ticketId: ticket.id,
          userId: author.id,
          fileName: att.filename,
          fileSize: att.size,
          mimeType: att.contentType,
          filePath: att.cdnUrl, // Use CDN URL as the file path
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year expiry
          sentInEmail: true // Email attachments came FROM an email, don't send them back
        }
      });
    }

    // 13. Update ticket status (reopen if needed)
    if (ticket.status === 'SOLVED' || ticket.status === 'ON_HOLD') {
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: 'OPEN' }
      });
    }

    // 14. Audit log
    await logEvent({
      action: 'comment.created',
      actorType: 'system',
      actorEmail: from,
      entityType: 'comment',
      entityId: ticketMessage.id,
      targetId: ticket.id,
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      metadata: {
        kind: 'email',
        ticketNumber: ticket.ticketNumber,
        messageId,
        isReply: true
      }
    });

    console.log(`✅ Reply appended to ticket ${ticket.ticketNumber} (from: ${from})`);

    return NextResponse.json({
      success: true,
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      messageId,
      action: 'reply_added',
      attachments: uploadedAttachments.length
    });

  } catch (error: any) {
    console.error('Email reply processing error:', error);

    // Log to DLQ
    try {
      const body = await request.text();
      await prisma.emailDLQ.create({
        data: {
          error: error.message,
          stackTrace: error.stack,
          rawPayload: body.substring(0, 10000)
        }
      });
    } catch (dlqError) {
      console.error('Failed to log to DLQ:', dlqError);
    }

    return NextResponse.json(
      {
        error: 'Reply processing failed',
        message: error.message
      },
      { status: 500 }
    );
  }
}
