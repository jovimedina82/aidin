import { NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"
import { buildTicketAccessWhere } from "@/lib/access-control"


export async function GET(request) {
  try {
    // Get authenticated user
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get access control where clause for this user
    const accessWhere = await buildTicketAccessWhere(user)

    // Calculate date for 1 month ago
    const oneMonthAgo = new Date()
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)

    // Get total tickets (with access control)
    const total = await prisma.ticket.count({
      where: accessWhere
    })

    // Get unassigned tickets (no assignee) - count all statuses except SOLVED and CLOSED
    const unassigned = await prisma.ticket.count({
      where: {
        ...accessWhere,
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
        ...accessWhere,
        status: {
          in: ['NEW', 'OPEN', 'PENDING']
        }
      }
    })

    // Get tickets by specific status
    const pending = await prisma.ticket.count({
      where: {
        ...accessWhere,
        status: 'PENDING'
      }
    })

    // Get recently solved tickets (within last month)
    const solved = await prisma.ticket.count({
      where: {
        ...accessWhere,
        status: 'SOLVED',
        updatedAt: {
          gte: oneMonthAgo
        }
      }
    })

    // Get solved history tickets (older than 1 month)
    const solvedHistory = await prisma.ticket.count({
      where: {
        ...accessWhere,
        status: 'SOLVED',
        updatedAt: {
          lt: oneMonthAgo
        }
      }
    })

    const open = await prisma.ticket.count({
      where: {
        ...accessWhere,
        status: 'OPEN'
      }
    })

    const onHold = await prisma.ticket.count({
      where: {
        ...accessWhere,
        status: 'ON_HOLD'
      }
    })

    const newTickets = await prisma.ticket.count({
      where: {
        ...accessWhere,
        status: 'NEW'
      }
    })

    // Company view counts (with assignee requirement for grouped views)
    const companyOpen = await prisma.ticket.count({
      where: {
        ...accessWhere,
        status: 'OPEN',
        assigneeId: { not: null }
      }
    })

    const companyPending = await prisma.ticket.count({
      where: {
        ...accessWhere,
        status: 'PENDING',
        assigneeId: { not: null }
      }
    })

    const companyOnHold = await prisma.ticket.count({
      where: {
        ...accessWhere,
        status: 'ON_HOLD',
        assigneeId: { not: null }
      }
    })

    const companySolved = await prisma.ticket.count({
      where: {
        ...accessWhere,
        status: 'SOLVED',
        assigneeId: { not: null },
        updatedAt: {
          gte: oneMonthAgo
        }
      }
    })

    const companySolvedHistory = await prisma.ticket.count({
      where: {
        ...accessWhere,
        status: 'SOLVED',
        assigneeId: { not: null },
        updatedAt: {
          lt: oneMonthAgo
        }
      }
    })

    // Unassigned New tickets (all new tickets without assignee)
    const unassignedNew = await prisma.ticket.count({
      where: {
        ...accessWhere,
        status: 'NEW',
        assigneeId: null
      }
    })

    const closed = await prisma.ticket.count({
      where: {
        ...accessWhere,
        status: 'CLOSED'
      }
    })

    // Get tickets assigned to current user (your work)
    const assigned = await prisma.ticket.count({
      where: {
        ...accessWhere,
        assigneeId: user.id,
        status: {
          in: ['NEW', 'OPEN', 'PENDING']
        }
      }
    })

    // Get personal stats for current user (tickets they created OR are assigned to)
    const personalNew = await prisma.ticket.count({
      where: {
        ...accessWhere,
        OR: [
          { requesterId: user.id },
          { assigneeId: user.id }
        ],
        status: 'NEW'
      }
    })

    const personalOpen = await prisma.ticket.count({
      where: {
        ...accessWhere,
        OR: [
          { requesterId: user.id },
          { assigneeId: user.id }
        ],
        status: 'OPEN'
      }
    })

    const personalPending = await prisma.ticket.count({
      where: {
        ...accessWhere,
        OR: [
          { requesterId: user.id },
          { assigneeId: user.id }
        ],
        status: 'PENDING'
      }
    })

    const personalOnHold = await prisma.ticket.count({
      where: {
        ...accessWhere,
        OR: [
          { requesterId: user.id },
          { assigneeId: user.id }
        ],
        status: 'ON_HOLD'
      }
    })

    const personalSolved = await prisma.ticket.count({
      where: {
        ...accessWhere,
        OR: [
          { requesterId: user.id },
          { assigneeId: user.id }
        ],
        status: 'SOLVED',
        updatedAt: {
          gte: oneMonthAgo
        }
      }
    })

    const personalSolvedHistory = await prisma.ticket.count({
      where: {
        ...accessWhere,
        OR: [
          { requesterId: user.id },
          { assigneeId: user.id }
        ],
        status: 'SOLVED',
        updatedAt: {
          lt: oneMonthAgo
        }
      }
    })

    // Update unsolved to include NEW and ON_HOLD status
    const unsolvedUpdated = await prisma.ticket.count({
      where: {
        ...accessWhere,
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
      unassignedNew,
      personal: {
        newTickets: personalNew,
        open: personalOpen,
        pending: personalPending,
        onHold: personalOnHold,
        solved: personalSolved,
        solvedHistory: personalSolvedHistory
      },
      company: {
        open: companyOpen,
        pending: companyPending,
        onHold: companyOnHold,
        solved: companySolved,
        solvedHistory: companySolvedHistory
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