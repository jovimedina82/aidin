/**
 * Phase 9: Analytics & Weekly Reporting
 * Service layer for in-memory KPI computation
 */

import { KPISet } from './domain'
import { prisma } from '@/lib/prisma'

/**
 * Compute KPIs in-memory from Tickets data
 * No DB write - returns real-time KPI values
 *
 * @param now - Optional reference time (defaults to current UTC time)
 */
export async function computeKPIs(now?: Date): Promise<KPISet> {
  const referenceTime = now || new Date()

  // 1. tickets_open: status = OPEN
  const ticketsOpen = await prisma.ticket.count({
    where: { status: 'OPEN' },
  })

  // 2. tickets_pending: status = PENDING
  const ticketsPending = await prisma.ticket.count({
    where: { status: 'PENDING' },
  })

  // 3. tickets_solved_7d: status = SOLVED AND resolvedAt within last 7 days
  const sevenDaysAgo = new Date(referenceTime)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const ticketsSolved7d = await prisma.ticket.count({
    where: {
      status: 'SOLVED',
      resolvedAt: {
        gte: sevenDaysAgo,
        lte: referenceTime,
      },
    },
  })

  // 4. avg_first_response_minutes:
  // Average time between ticket createdAt and first comment createdAt
  // Only for tickets with at least one comment
  const ticketsWithComments = await prisma.ticket.findMany({
    where: {
      comments: {
        some: {},
      },
    },
    include: {
      comments: {
        orderBy: { createdAt: 'asc' },
        take: 1,
      },
    },
  })

  let totalResponseMinutes = 0
  let countWithComments = 0

  for (const ticket of ticketsWithComments) {
    if (ticket.comments.length > 0) {
      const firstComment = ticket.comments[0]
      const responseTime =
        firstComment.createdAt.getTime() - ticket.createdAt.getTime()
      const responseMinutes = Math.floor(responseTime / 60000)
      totalResponseMinutes += responseMinutes
      countWithComments++
    }
  }

  const avgFirstResponseMinutes =
    countWithComments > 0
      ? Math.round(totalResponseMinutes / countWithComments)
      : 0

  return {
    tickets_open: ticketsOpen,
    tickets_pending: ticketsPending,
    tickets_solved_7d: ticketsSolved7d,
    avg_first_response_minutes: avgFirstResponseMinutes,
    computed_at: referenceTime.toISOString(),
  }
}
