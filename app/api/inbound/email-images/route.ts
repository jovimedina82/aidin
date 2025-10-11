/**
 * Email ingestion endpoint with image processing
 * POST /api/inbound/email-images
 *
 * Processes inbound emails with inline images and attachments
 */

import { NextRequest, NextResponse } from 'next/server';
import { processInboundEmail } from '@/lib/email-images/emailProcessor';
import { PrismaClient } from '@/lib/generated/prisma';

const prisma = new PrismaClient();

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || process.env.N8N_WEBHOOK_SECRET || '';

export async function POST(request: NextRequest) {
  try {
    // 1. Validate webhook secret
    const providedSecret = request.headers.get('x-webhook-secret');
    if (providedSecret !== WEBHOOK_SECRET) {
      console.warn('Invalid webhook secret for email-images endpoint');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse payload
    const payload = await request.json();
    const { ticketKey, ticketId, ...emailPayload } = payload;

    // 3. Resolve ticketId if only ticketKey provided
    let resolvedTicketId = ticketId;

    if (!resolvedTicketId && ticketKey) {
      const ticket = await prisma.ticket.findFirst({
        where: {
          OR: [
            { ticketNumber: ticketKey },
            { id: ticketKey },
          ],
        },
      });

      if (!ticket) {
        return NextResponse.json(
          { error: `Ticket not found: ${ticketKey}` },
          { status: 404 }
        );
      }

      resolvedTicketId = ticket.id;
    }

    if (!resolvedTicketId) {
      return NextResponse.json(
        { error: 'ticketId or ticketKey required' },
        { status: 400 }
      );
    }

    // 4. Process email with image extraction
    const result = await processInboundEmail({
      ticketId: resolvedTicketId,
      emailPayload,
      maxFileSize: 25 * 1024 * 1024, // 25MB per file
      maxTotalSize: 50 * 1024 * 1024, // 50MB total
    });

    console.log(`✅ Email processed successfully: ${result.messageId}`);

    return NextResponse.json({
      ok: true,
      messageId: result.messageId,
      assetsCount: result.assetsCount,
      inlineImagesCount: result.inlineImagesCount,
      attachmentsCount: result.attachmentsCount,
    });
  } catch (error: any) {
    console.error('Email image processing error:', error);

    return NextResponse.json(
      {
        error: 'Email processing failed',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
