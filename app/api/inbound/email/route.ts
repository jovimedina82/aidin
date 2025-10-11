/**
 * N8N Inbound Email Webhook - New Tickets Only
 *
 * POST /api/inbound/email
 *
 * Receives new emails from N8N and creates tickets.
 * Replies are rejected with 409 and should use /api/inbound/email-reply
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/lib/generated/prisma';
import { validateSimpleSecret } from '@/lib/security/hmac';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { sanitizeHtml, stripAllHtml, getTextPreview } from '@/lib/security/html-sanitizer';
import { parseForwardedEmail, extractForwarderContext } from '@/lib/email/forward-parser';
import { classifyDepartmentAndTags, applyTagsToTicket } from '@/modules/classify/email';
import { reserveTicketId } from '@/modules/tickets/id';
import { formatTicketSubject, extractTicketId } from '@/modules/tickets/subject';
import { uploadEmailAttachment } from '@/modules/storage/spaces';
import { logEvent } from '@/lib/audit';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

const ENABLED = process.env.INBOUND_EMAIL_ENABLED === 'true';
const WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET || '';

export async function POST(request: NextRequest) {
  try {
    // EMERGENCY KILL SWITCH - Disable all email processing to stop email loop
    if (process.env.EMAIL_SENDING_DISABLED === 'true') {
      console.log('🛑 EMAIL INGESTION DISABLED - Email loop prevention active');
      return NextResponse.json(
        { error: 'Email ingestion temporarily disabled' },
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
      console.warn('Invalid webhook secret');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse payload
    const payload = await request.json();
    const {
      messageId,
      inReplyTo,
      references,
      conversationId,
      from,
      to,
      cc,
      subject,
      html,
      text,
      attachments = [],
      receivedAt
    } = payload;

    // Validate required fields (BEFORE rate limiting)
    if (!from || !messageId || !subject) {
      return NextResponse.json(
        { error: 'Missing required fields: from, messageId, subject' },
        { status: 400 }
      );
    }

    // 3. Rate limiting (now that 'from' is validated)
    const rateLimit = await checkRateLimit(from, '/api/inbound/email');
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

    // 4. Check if sender domain is blocked
    const emailDomain = from.includes('@') ? from.split('@')[1].toLowerCase() : '';
    if (emailDomain) {
      const blockedDomain = await prisma.blockedEmailDomain.findUnique({
        where: { domain: emailDomain }
      });

      if (blockedDomain) {
        console.log(`🚫 Blocked domain: ${emailDomain} (from: ${from})`);

        // Create classifier feedback to track blocked emails
        try {
          await prisma.classifierFeedback.create({
            data: {
              ticketId: 'BLOCKED',
              emailFrom: from,
              emailSubject: subject,
              emailBody: text || html || '',
              originalCategory: null,
              feedbackType: 'NOT_TICKET',
              reason: `Domain blocked: ${blockedDomain.reason || 'No reason provided'}`,
              userId: blockedDomain.blockedBy
            }
          });
        } catch (feedbackError) {
          console.error('Failed to log blocked email feedback:', feedbackError);
        }

        return NextResponse.json({
          status: 'blocked',
          domain: emailDomain,
          reason: blockedDomain.reason,
          message: 'This email domain has been blocked from creating tickets'
        }, { status: 403 });
      }
    }

    // 5. Idempotency check (Message-ID)
    const existing = await prisma.emailIngest.findUnique({
      where: { messageId }
    });

    if (existing) {
      console.log(`✓ Duplicate email (Message-ID: ${messageId})`);
      return NextResponse.json({
        status: 'duplicate',
        ticketId: existing.ticketId,
        messageId
      });
    }

    // 6. Thread detection (reject replies)
    // Check if this is a reply by looking for:
    // - inReplyTo header (standard email threading) - STRONG indicator of reply
    // - references header (email thread chain) - STRONG indicator
    // - ticket ID in subject line - STRONG indicator (Re: [IT000001])

    // For conversationId (Microsoft Graph), we DON'T auto-reject because:
    // - Email clients group conversations even for new topics
    // - Users may start new requests in same thread
    // Only reject if there's STRONG evidence it's a reply (inReplyTo/references/ticket ID)

    const ticketIdInSubject = extractTicketId(subject);
    const hasStrongReplyIndicators = !!(inReplyTo || references || ticketIdInSubject);

    if (hasStrongReplyIndicators) {
      console.log(`⚠️  Reply detected: ${subject}`);
      return NextResponse.json(
        {
          error: 'Reply detected, use /api/inbound/email-reply',
          inReplyTo,
          detectedTicketId: ticketIdInSubject,
          conversationId
        },
        { status: 409 }
      );
    }

    // 7. Sanitize HTML and extract clean plain text
    const sanitizedHtml = html ? sanitizeHtml(html, { strict: true }) : null;

    // Always prefer clean text extraction from HTML over raw text field
    // (raw text from N8N often contains HTML)
    let plainText: string;
    if (sanitizedHtml && sanitizedHtml.trim()) {
      plainText = stripAllHtml(sanitizedHtml);
    } else if (text && text.trim()) {
      plainText = stripAllHtml(text); // Also strip HTML from text field just in case
    } else {
      plainText = subject; // Fallback to subject if no content
    }

    // 8. Parse forwarded emails to extract original content
    const forwardedParsed = parseForwardedEmail(plainText, sanitizedHtml || '');
    let ticketBody = plainText;
    let forwarderNotes = '';

    if (forwardedParsed.isForwarded && forwardedParsed.originalBody) {
      console.log(`📧 Forwarded email detected - Original from: ${forwardedParsed.originalFrom}`);

      // Use the original forwarded content as the ticket body
      ticketBody = forwardedParsed.originalBody;

      // Store forwarder's notes separately
      if (forwardedParsed.forwarderNotes) {
        forwarderNotes = extractForwarderContext(forwardedParsed.forwarderNotes);
      }

      // If we extracted original sender, add it as context
      if (forwardedParsed.originalFrom) {
        let contextNote = `\n\n---\nOriginal sender: ${forwardedParsed.originalFrom}`;
        if (forwarderNotes) {
          contextNote = contextNote + `\nForwarder's note: ${forwarderNotes}`;
        }
        ticketBody = ticketBody + contextNote;
      }
    }

    const snippet = getTextPreview(ticketBody, 200);

    // 9. Upload attachments to DigitalOcean Spaces
    const uploadedAttachments: any[] = [];

    for (const att of attachments.slice(0, 10)) { // Max 10 attachments
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

    // 10. Classify department & tags
    const classification = await classifyDepartmentAndTags({
      subject,
      text: plainText,
      html: sanitizedHtml || '',
      from,
      to
    });

    // 11. Reserve ticket ID
    const ticketNumber = await reserveTicketId(classification.departmentCode);

    // 12. Find or create user
    let requester = await prisma.user.findFirst({
      where: { email: from.toLowerCase() }
    });

    if (!requester) {
      // Extract name from email
      const [firstName, ...rest] = from.split('@')[0].split('.');
      const lastName = rest.join(' ') || 'User';

      requester = await prisma.user.create({
        data: {
          email: from.toLowerCase(),
          firstName: firstName.charAt(0).toUpperCase() + firstName.slice(1),
          lastName: lastName.charAt(0).toUpperCase() + lastName.slice(1),
          userType: 'Client'
        }
      });
    }

    // 13. Create EmailIngest record
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
        cc: cc ? JSON.stringify(cc) : null,
        subject,
        html: sanitizedHtml,
        text: plainText,
        snippet,
        rawHeaders: JSON.stringify(request.headers),
        dedupeHash,
        processedAt: new Date()
      }
    });

    // 14. Create Ticket
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        title: subject,
        description: ticketBody,
        status: 'NEW',
        priority: 'NORMAL',
        category: classification.tags[0] || 'General',
        requesterId: requester.id,
        emailConversationId: conversationId
      }
    });

    // Link EmailIngest to Ticket
    await prisma.emailIngest.update({
      where: { id: emailIngest.id },
      data: { ticketId: ticket.id }
    });

    // 15. Resolve CID references in HTML (inline images)
    const { resolveCidReferences } = await import('@/lib/email/cid-resolver');
    const htmlWithResolvedCids = resolveCidReferences(sanitizedHtml || '', uploadedAttachments);

    // 16. Create TicketMessage
    await prisma.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        kind: 'email',
        authorEmail: from,
        authorName: `${requester.firstName} ${requester.lastName}`,
        html: htmlWithResolvedCids,
        text: plainText,
        subject,
        metadata: JSON.stringify({
          emailIngestId: emailIngest.id,
          attachmentCount: uploadedAttachments.length
        })
      }
    });

    // 17. Save attachments
    for (const att of uploadedAttachments) {
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
    }

    // 18. Apply tags
    await applyTagsToTicket(ticket.id, classification.tags);

    // 19. Audit log
    await logEvent({
      action: 'email.received',
      actorType: 'system',
      actorEmail: from,
      entityType: 'email',
      entityId: emailIngest.id,
      targetId: ticket.id,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      metadata: {
        ticketNumber,
        messageId,
        from,
        subject,
        classification: classification.departmentCode,
        confidence: classification.confidence,
        method: classification.method
      }
    });

    console.log(`✅ Email ingested → Ticket ${ticketNumber} (${classification.departmentCode}, confidence: ${classification.confidence.toFixed(2)})`);

    // 20. Send ticket created notification email to requester
    try {
      const { getEmailService } = await import('@/lib/services/EmailService.js');
      const emailService = getEmailService();
      await emailService.sendTicketCreatedEmail(ticket, from);
      console.log(`📧 Ticket created notification sent to ${from}`);
    } catch (emailError: any) {
      console.error('Failed to send ticket created email:', emailError.message);
      // Don't fail the whole request if email notification fails
    }

    return NextResponse.json({
      success: true,
      ticketId: ticket.id,
      ticketNumber,
      messageId,
      classification: {
        department: classification.departmentCode,
        tags: classification.tags,
        confidence: classification.confidence,
        method: classification.method
      },
      attachments: uploadedAttachments.length
    });

  } catch (error: any) {
    console.error('Email ingestion error:', error);

    // Log to DLQ (note: request body already consumed, so we can't log raw payload)
    try {
      await prisma.emailDLQ.create({
        data: {
          error: error.message,
          stackTrace: error.stack,
          messageId: null,
          from: null,
          subject: null,
          rawPayload: JSON.stringify({ error: 'Request body already consumed', message: error.message })
        }
      });
    } catch (dlqError) {
      console.error('Failed to log to DLQ:', dlqError);
    }

    return NextResponse.json(
      {
        error: 'Email processing failed',
        message: error.message
      },
      { status: 500 }
    );
  }
}
