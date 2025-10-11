/**
 * Subject Formatting Test Endpoint
 *
 * POST /api/test/subject-format
 *
 * Tests ticket subject formatting and token extraction.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  formatTicketSubject,
  extractTicketId,
  extractTicketIds,
  stripTicketTokens
} from '@/modules/tickets/subject';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ticketId, subject, operation = 'format' } = body;

    if (!subject) {
      return NextResponse.json(
        { error: 'subject is required' },
        { status: 400 }
      );
    }

    const results: any = {
      input: { ticketId, subject, operation }
    };

    switch (operation) {
      case 'format':
        if (!ticketId) {
          return NextResponse.json(
            { error: 'ticketId is required for format operation' },
            { status: 400 }
          );
        }
        results.formatted = formatTicketSubject(ticketId, subject);
        break;

      case 'extract':
        results.extractedId = extractTicketId(subject);
        results.allIds = extractTicketIds(subject);
        break;

      case 'strip':
        results.stripped = stripTicketTokens(subject);
        break;

      case 'all':
        if (ticketId) {
          results.formatted = formatTicketSubject(ticketId, subject);
        }
        results.extractedId = extractTicketId(subject);
        results.allIds = extractTicketIds(subject);
        results.stripped = stripTicketTokens(subject);
        break;

      default:
        return NextResponse.json(
          { error: `Unknown operation: ${operation}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      ...results
    });

  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: error.stack
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    usage: 'POST /api/test/subject-format',
    operations: {
      format: 'Format subject with ticket ID',
      extract: 'Extract ticket ID from subject',
      strip: 'Strip all ticket tokens from subject',
      all: 'Run all operations'
    },
    examples: [
      {
        description: 'Format a new subject',
        body: {
          ticketId: 'IT000123',
          subject: 'Printer not working',
          operation: 'format'
        },
        expectedOutput: '[IT000123] Printer not working'
      },
      {
        description: 'Extract ticket ID from reply',
        body: {
          subject: 'Re: [IT000123] Printer not working',
          operation: 'extract'
        },
        expectedOutput: 'IT000123'
      },
      {
        description: 'Strip ticket tokens',
        body: {
          subject: '[IT000123] Re: [FIN000045] Question',
          operation: 'strip'
        },
        expectedOutput: 'Question'
      },
      {
        description: 'Run all operations',
        body: {
          ticketId: 'IT000123',
          subject: 'Re: [IT000123] Printer not working',
          operation: 'all'
        }
      }
    ]
  });
}
