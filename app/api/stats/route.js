import { NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"
import { buildTicketAccessWhere } from "@/lib/access-control"
import { PerformanceMonitor } from '../../../lib/performance.js'
import { cache, CacheKeys, CacheTTL } from '@/lib/cache'

export async function GET(request) {
  try {
    PerformanceMonitor.start('stats-fetch')

    // Get authenticated user
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Try to get stats from cache first
    const cacheKey = CacheKeys.STATS_DASHBOARD(user.id)
    const cachedStats = cache.get(cacheKey)
    if (cachedStats) {
      PerformanceMonitor.end('stats-fetch')
      return NextResponse.json(cachedStats)
    }

    // Get access control where clause for this user
    const accessWhere = await buildTicketAccessWhere(user)

    // Calculate date for 1 month ago
    const oneMonthAgo = new Date()
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)

    // Optimized: Use a single aggregation query instead of 22 separate counts
    const allTickets = await prisma.ticket.findMany({
      where: accessWhere,
      select: {
        status: true,
        assigneeId: true,
        requesterId: true,
        updatedAt: true
      }
    })

    // Calculate all stats in memory (much faster than 22 DB queries)
    const total = allTickets.length
    const unassigned = allTickets.filter(t => !t.assigneeId && t.status !== 'SOLVED').length
    const unsolved = allTickets.filter(t => ['NEW', 'OPEN', 'PENDING', 'ON_HOLD'].includes(t.status)).length
    const pending = allTickets.filter(t => t.status === 'PENDING').length
    const solved = allTickets.filter(t => t.status === 'SOLVED').length
    const solvedHistory = allTickets.filter(t => t.status === 'SOLVED' && t.updatedAt < oneMonthAgo).length
    const open = allTickets.filter(t => t.status === 'OPEN').length
    const onHold = allTickets.filter(t => t.status === 'ON_HOLD').length
    const newTickets = allTickets.filter(t => t.status === 'NEW').length
    const unassignedNew = allTickets.filter(t => t.status === 'NEW' && !t.assigneeId).length
    const assigned = allTickets.filter(t => t.assigneeId === user.id && ['NEW', 'OPEN', 'PENDING'].includes(t.status)).length

    // Company view counts (with assignee requirement)
    const companyOpen = allTickets.filter(t => t.status === 'OPEN' && t.assigneeId).length
    const companyPending = allTickets.filter(t => t.status === 'PENDING' && t.assigneeId).length
    const companyOnHold = allTickets.filter(t => t.status === 'ON_HOLD' && t.assigneeId).length
    const companySolved = allTickets.filter(t => t.status === 'SOLVED' && t.assigneeId && t.updatedAt >= oneMonthAgo).length
    const companySolvedHistory = allTickets.filter(t => t.status === 'SOLVED' && t.assigneeId && t.updatedAt < oneMonthAgo).length

    // Personal stats (tickets user created OR is assigned to)
    const personalNew = allTickets.filter(t => (t.requesterId === user.id || t.assigneeId === user.id) && t.status === 'NEW').length
    const personalOpen = allTickets.filter(t => (t.requesterId === user.id || t.assigneeId === user.id) && t.status === 'OPEN').length
    const personalPending = allTickets.filter(t => (t.requesterId === user.id || t.assigneeId === user.id) && t.status === 'PENDING').length
    const personalOnHold = allTickets.filter(t => (t.requesterId === user.id || t.assigneeId === user.id) && t.status === 'ON_HOLD').length
    const personalSolved = allTickets.filter(t => (t.requesterId === user.id || t.assigneeId === user.id) && t.status === 'SOLVED' && t.updatedAt >= oneMonthAgo).length
    const personalSolvedHistory = allTickets.filter(t => (t.requesterId === user.id || t.assigneeId === user.id) && t.status === 'SOLVED' && t.updatedAt < oneMonthAgo).length

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

    // Cache the stats for 30 seconds
    cache.set(cacheKey, stats, CacheTTL.STATS)

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