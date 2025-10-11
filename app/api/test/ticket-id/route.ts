/**
 * Ticket ID Generation Test Endpoint
 *
 * POST /api/test/ticket-id
 *
 * Tests ticket ID reservation and formatting for all departments.
 */

import { NextRequest, NextResponse } from 'next/server';
import { reserveTicketId } from '@/modules/tickets/id';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { department, count = 1 } = body;

    // Test single department
    if (department) {
      const ids: string[] = [];

      for (let i = 0; i < count; i++) {
        const ticketId = await reserveTicketId(department);
        ids.push(ticketId);
      }

      return NextResponse.json({
        success: true,
        department,
        count,
        ticketIds: ids,
        sample: ids[0]
      });
    }

    // Test all departments
    const departments = ['IT', 'HR', 'FIN', 'MKT', 'BRK', 'OPS', 'LEG', 'GN'];
    const results: Record<string, string> = {};

    for (const dept of departments) {
      try {
        const ticketId = await reserveTicketId(dept);
        results[dept] = ticketId;
      } catch (error: any) {
        results[dept] = `ERROR: ${error.message}`;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Generated ticket IDs for all departments',
      results
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
    usage: 'POST /api/test/ticket-id',
    examples: [
      {
        description: 'Generate ID for specific department',
        body: { department: 'IT' }
      },
      {
        description: 'Generate 5 IDs for IT department',
        body: { department: 'IT', count: 5 }
      },
      {
        description: 'Generate IDs for all departments',
        body: {}
      }
    ],
    supportedDepartments: ['IT', 'HR', 'FIN', 'MKT', 'BRK', 'OPS', 'LEG', 'GN']
  });
}
