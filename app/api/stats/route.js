import { NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"
import { buildTicketAccessWhere } from "@/lib/access-control"
import { PerformanceMonitor } from '../../../lib/performance.js'

export async function GET(request) {
  try {
    PerformanceMonitor.start('stats-fetch')

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

    // Use Promise.all for batch operations to improve performance
    const [
      total,
      unassigned,
      unsolved,
      pending,
      solved,
      solvedHistory,
      open,
      onHold,
      newTickets,
      unassignedNew,
      assigned,
      companyOpen,
      companyPending,
      companyOnHold,
      companySolved,
      companySolvedHistory,
      personalNew,
      personalOpen,
      personalPending,
      personalOnHold,
      personalSolved,
      personalSolvedHistory
    ] = await Promise.all([
      // Total tickets
      prisma.ticket.count({ where: accessWhere }),

      // Unassigned tickets (no assignee) - count all statuses except SOLVED
      prisma.ticket.count({
        where: {
          ...accessWhere,
          assigneeId: null,
          status: { notIn: ['SOLVED'] }
        }
      }),

      // Unsolved tickets (NEW, OPEN, PENDING, ON_HOLD)
      prisma.ticket.count({
        where: {
          ...accessWhere,
          status: { in: ['NEW', 'OPEN', 'PENDING', 'ON_HOLD'] }
        }
      }),

      // Status-specific counts
      prisma.ticket.count({ where: { ...accessWhere, status: 'PENDING' } }),
      prisma.ticket.count({ where: { ...accessWhere, status: 'SOLVED' } }),
      prisma.ticket.count({
        where: {
          ...accessWhere,
          status: 'SOLVED',
          updatedAt: { lt: oneMonthAgo }
        }
      }),
      prisma.ticket.count({ where: { ...accessWhere, status: 'OPEN' } }),
      prisma.ticket.count({ where: { ...accessWhere, status: 'ON_HOLD' } }),
      prisma.ticket.count({ where: { ...accessWhere, status: 'NEW' } }),

      // Unassigned new tickets
      prisma.ticket.count({
        where: { ...accessWhere, status: 'NEW', assigneeId: null }
      }),

      // Tickets assigned to current user
      prisma.ticket.count({
        where: {
          ...accessWhere,
          assigneeId: user.id,
          status: { in: ['NEW', 'OPEN', 'PENDING'] }
        }
      }),

      // Company view counts (with assignee requirement)
      prisma.ticket.count({
        where: { ...accessWhere, status: 'OPEN', assigneeId: { not: null } }
      }),
      prisma.ticket.count({
        where: { ...accessWhere, status: 'PENDING', assigneeId: { not: null } }
      }),
      prisma.ticket.count({
        where: { ...accessWhere, status: 'ON_HOLD', assigneeId: { not: null } }
      }),
      prisma.ticket.count({
        where: {
          ...accessWhere,
          status: 'SOLVED',
          assigneeId: { not: null },
          updatedAt: { gte: oneMonthAgo }
        }
      }),
      prisma.ticket.count({
        where: {
          ...accessWhere,
          status: 'SOLVED',
          assigneeId: { not: null },
          updatedAt: { lt: oneMonthAgo }
        }
      }),

      // Personal stats (tickets user created OR is assigned to)
      prisma.ticket.count({
        where: {
          ...accessWhere,
          OR: [{ requesterId: user.id }, { assigneeId: user.id }],
          status: 'NEW'
        }
      }),
      prisma.ticket.count({
        where: {
          ...accessWhere,
          OR: [{ requesterId: user.id }, { assigneeId: user.id }],
          status: 'OPEN'
        }
      }),
      prisma.ticket.count({
        where: {
          ...accessWhere,
          OR: [{ requesterId: user.id }, { assigneeId: user.id }],
          status: 'PENDING'
        }
      }),
      prisma.ticket.count({
        where: {
          ...accessWhere,
          OR: [{ requesterId: user.id }, { assigneeId: user.id }],
          status: 'ON_HOLD'
        }
      }),
      prisma.ticket.count({
        where: {
          ...accessWhere,
          OR: [{ requesterId: user.id }, { assigneeId: user.id }],
          status: 'SOLVED',
          updatedAt: { gte: oneMonthAgo }
        }
      }),
      prisma.ticket.count({
        where: {
          ...accessWhere,
          OR: [{ requesterId: user.id }, { assigneeId: user.id }],
          status: 'SOLVED',
          updatedAt: { lt: oneMonthAgo }
        }
      })
    ])

    const stats = {
      total,
      assigned,
      unsolved,
      unassigned,
      pending,
      solved,
      solvedHistory,
      open,
      onHold,
      newTickets,
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

    PerformanceMonitor.end('stats-fetch')
    return NextResponse.json(stats)
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error fetching stats:', error)
    }
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}