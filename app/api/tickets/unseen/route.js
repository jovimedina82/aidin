import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

/**
 * GET /api/tickets/unseen
 * Get count of unseen tickets for current user
 */
export async function GET(request) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Count NEW tickets that user hasn't viewed
    const unseenCount = await prisma.ticket.count({
      where: {
        status: 'NEW',
        NOT: {
          seenBy: {
            some: {
              userId: user.id
            }
          }
        }
      }
    })

    // Get list of unseen ticket IDs and basic info (for notifications)
    const unseenTickets = await prisma.ticket.findMany({
      where: {
        status: 'NEW',
        NOT: {
          seenBy: {
            some: {
              userId: user.id
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10, // Last 10 unseen
      select: {
        id: true,
        ticketNumber: true,
        title: true,
        createdAt: true
      }
    })

    return NextResponse.json({
      count: unseenCount,
      tickets: unseenTickets
    })
  } catch (error) {
    console.error('Error getting unseen tickets:', error)
    return NextResponse.json(
      { error: 'Failed to get unseen tickets' },
      { status: 500 }
    )
  }
}
