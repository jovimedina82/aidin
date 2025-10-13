import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/lib/generated/prisma';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { ticketNumber: string } }
) {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { ticketNumber: params.ticketNumber },
      include: {
        ticketMessages: {
          select: {
            id: true,
            html: true,
            text: true,
            subject: true,
            kind: true,
            createdAt: true
          }
        }
      }
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    return NextResponse.json({
      ticketNumber: ticket.ticketNumber,
      title: ticket.title,
      description: ticket.description,
      ticketMessages: ticket.ticketMessages.map(msg => ({
        ...msg,
        htmlPreview: msg.html ? msg.html.substring(0, 500) + '...' : null,
        textPreview: msg.text ? msg.text.substring(0, 200) + '...' : null
      }))
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message
    }, { status: 500 });
  }
}
