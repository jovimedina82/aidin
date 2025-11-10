import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

/**
 * POST /api/tickets/[id]/mark-seen
 * Mark a ticket as seen by the current user
 */
export async function POST(request, { params }) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    // Upsert - create if doesn't exist, do nothing if exists
    await prisma.ticketView.upsert({
      where: {
        ticketId_userId: {
          ticketId: id,
          userId: user.id
        }
      },
      create: {
        ticketId: id,
        userId: user.id
      },
      update: {
        // Update viewedAt to now
        viewedAt: new Date()
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error marking ticket as seen:', error)
    return NextResponse.json(
      { error: 'Failed to mark ticket as seen' },
      { status: 500 }
    )
  }
}
