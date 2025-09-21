import { NextResponse } from 'next/server'
import { PrismaClient } from '../../../lib/generated/prisma/index.js'
import { getCurrentUser } from '../../../lib/auth.js'

const prisma = new PrismaClient()

export async function GET(request) {
  try {
    // Get authenticated user
    const user = await getCurrentUser(request)

    // Get total tickets
    const total = await prisma.ticket.count()

    // Get unassigned tickets (no assignee) - count all statuses except SOLVED and CLOSED
    const unassigned = await prisma.ticket.count({
      where: {
        assigneeId: null,
        status: {
          not: {
            in: ['SOLVED', 'CLOSED']
          }
        }
      }
    })

    // Get unsolved tickets (NEW, OPEN, PENDING)
    const unsolved = await prisma.ticket.count({
      where: {
        status: {
          in: ['NEW', 'OPEN', 'PENDING']
        }
      }
    })

    // Get tickets by specific status
    const pending = await prisma.ticket.count({
      where: { status: 'PENDING' }
    })

    // Calculate date for 1 month ago
    const oneMonthAgo = new Date()
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)

    // Get recently solved tickets (within last month)
    const solved = await prisma.ticket.count({
      where: {
        status: 'SOLVED',
        updatedAt: {
          gte: oneMonthAgo
        }
      }
    })

    // Get solved history tickets (older than 1 month)
    const solvedHistory = await prisma.ticket.count({
      where: {
        status: 'SOLVED',
        updatedAt: {
          lt: oneMonthAgo
        }
      }
    })

    const open = await prisma.ticket.count({
      where: { status: 'OPEN' }
    })

    const onHold = await prisma.ticket.count({
      where: { status: 'ON_HOLD' }
    })

    const newTickets = await prisma.ticket.count({
      where: { status: 'NEW' }
    })

    const closed = await prisma.ticket.count({
      where: { status: 'CLOSED' }
    })

    // Get tickets assigned to current user (your work)
    const assigned = user ? await prisma.ticket.count({
      where: {
        assigneeId: user.id,
        status: {
          in: ['NEW', 'OPEN', 'PENDING']
        }
      }
    }) : 0

    // Get personal stats for current user
    const personalOpen = user ? await prisma.ticket.count({
      where: {
        assigneeId: user.id,
        status: 'OPEN'
      }
    }) : 0

    const personalPending = user ? await prisma.ticket.count({
      where: {
        assigneeId: user.id,
        status: 'PENDING'
      }
    }) : 0

    const personalOnHold = user ? await prisma.ticket.count({
      where: {
        assigneeId: user.id,
        status: 'ON_HOLD'
      }
    }) : 0

    const personalSolved = user ? await prisma.ticket.count({
      where: {
        assigneeId: user.id,
        status: 'SOLVED',
        updatedAt: {
          gte: oneMonthAgo
        }
      }
    }) : 0

    // Update unsolved to include NEW and ON_HOLD status
    const unsolvedUpdated = await prisma.ticket.count({
      where: {
        status: {
          in: ['NEW', 'OPEN', 'PENDING', 'ON_HOLD']
        }
      }
    })

    const stats = {
      total,
      assigned,
      unsolved: unsolvedUpdated,
      unassigned,
      pending,
      solved,
      solvedHistory,
      open,
      onHold,
      newTickets,
      closed,
      personal: {
        open: personalOpen,
        pending: personalPending,
        onHold: personalOnHold,
        solved: personalSolved
      }
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}