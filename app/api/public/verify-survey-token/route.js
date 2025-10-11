import { NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"
import { verifyEmailActionToken } from '@/lib/email-token'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      )
    }

    // Verify the token
    const verified = verifyEmailActionToken(token)

    if (!verified) {
      return NextResponse.json(
        { error: 'Invalid or expired link' },
        { status: 401 }
      )
    }

    // Get ticket information
    const ticket = await prisma.ticket.findUnique({
      where: { id: verified.ticketId },
      select: {
        id: true,
        ticketNumber: true,
        title: true,
        status: true,
        satisfactionRating: true
      }
    })

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    // Check if survey was already submitted
    if (ticket.satisfactionRating !== null) {
      return NextResponse.json(
        { error: 'This survey has already been submitted. Thank you for your feedback!' },
        { status: 400 }
      )
    }

    return NextResponse.json(ticket)
  } catch (error) {
    console.error('Error verifying survey token:', error)
    return NextResponse.json(
      { error: 'Failed to verify token' },
      { status: 500 }
    )
  }
}
