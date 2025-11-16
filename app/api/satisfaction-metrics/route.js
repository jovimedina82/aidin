import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { extractRoleNames } from '@/lib/role-utils'
import logger from '@/lib/logger'

/**
 * Get satisfaction metrics (overall + per staff member)
 * GET /api/satisfaction-metrics?period=7d
 */
export async function GET(request) {
  try {
    const currentUser = await getCurrentUser(request)
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has access (Staff, Manager, or Admin)
    const roleNames = extractRoleNames(currentUser.roles)
    const hasAccess = roleNames.some(role => ['Admin', 'Manager', 'Staff'].includes(role))

    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '7d' // 7d, 30d, 90d, all

    // Calculate date range
    const now = new Date()
    let startDate = new Date()

    switch (period) {
      case '7d':
        startDate.setDate(now.getDate() - 7)
        break
      case '30d':
        startDate.setDate(now.getDate() - 30)
        break
      case '90d':
        startDate.setDate(now.getDate() - 90)
        break
      case 'all':
        startDate = new Date(0) // Beginning of time
        break
      default:
        startDate.setDate(now.getDate() - 7)
    }

    // Use database aggregation instead of loading all tickets into memory
    // This is much more efficient for large datasets
    const whereClause = {
      satisfactionRating: { not: null },
      resolvedAt: { gte: startDate }
    }

    // Get aggregated metrics directly from database
    const [
      aggregateStats,
      ratingCounts,
      staffStats,
      recentTickets
    ] = await Promise.all([
      // Overall statistics
      prisma.ticket.aggregate({
        where: whereClause,
        _avg: { satisfactionRating: true },
        _count: { satisfactionRating: true },
        _min: { satisfactionRating: true },
        _max: { satisfactionRating: true }
      }),

      // Rating distribution using groupBy
      prisma.ticket.groupBy({
        by: ['satisfactionRating'],
        where: whereClause,
        _count: { satisfactionRating: true }
      }),

      // Per-staff metrics using groupBy
      prisma.ticket.groupBy({
        by: ['assigneeId'],
        where: {
          ...whereClause,
          assigneeId: { not: null }
        },
        _avg: { satisfactionRating: true },
        _count: { satisfactionRating: true }
      }),

      // Only fetch recent tickets for feedback display (limit to 50)
      prisma.ticket.findMany({
        where: whereClause,
        select: {
          id: true,
          ticketNumber: true,
          satisfactionRating: true,
          satisfactionFeedback: true,
          resolvedAt: true,
          assigneeId: true,
          assignee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        },
        orderBy: { resolvedAt: 'desc' },
        take: 50 // Limit to most recent 50 for feedback display
      })
    ])

    // Calculate overall metrics from aggregation
    const totalRatings = aggregateStats._count.satisfactionRating || 0
    const averageRating = aggregateStats._avg.satisfactionRating || 0

    // Build rating distribution from groupBy results
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    ratingCounts.forEach(item => {
      if (item.satisfactionRating >= 1 && item.satisfactionRating <= 5) {
        ratingDistribution[item.satisfactionRating] = item._count.satisfactionRating
      }
    })

    // Fetch staff details for metrics
    const staffIds = staffStats.map(s => s.assigneeId).filter(Boolean)
    const staffUsers = staffIds.length > 0 ? await prisma.user.findMany({
      where: { id: { in: staffIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true
      }
    }) : []

    const staffUserMap = new Map(staffUsers.map(u => [u.id, u]))

    // Build per-staff metrics from aggregated data
    const staffArray = staffStats.map(stat => {
      const user = staffUserMap.get(stat.assigneeId)
      return {
        staffId: stat.assigneeId,
        staffName: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
        staffEmail: user?.email || 'unknown',
        totalRatings: stat._count.satisfactionRating,
        averageRating: stat._avg.satisfactionRating || 0
      }
    }).sort((a, b) => b.averageRating - a.averageRating)

    // Calculate daily time series using database aggregation
    const dayMillis = 24 * 60 * 60 * 1000
    const daysInPeriod = period === 'all' ? 90 : parseInt(period.replace('d', ''))

    // For daily metrics, use the recent tickets (limited to 50) for a quick estimate
    // In production, you might want a separate aggregation query
    const dailyMetrics = []
    for (let i = daysInPeriod - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - (i * dayMillis))
      date.setHours(0, 0, 0, 0)
      const nextDate = new Date(date.getTime() + dayMillis)

      const dayTickets = recentTickets.filter(t => {
        const resolvedDate = new Date(t.resolvedAt)
        return resolvedDate >= date && resolvedDate < nextDate
      })

      const dayAverage = dayTickets.length > 0
        ? dayTickets.reduce((sum, t) => sum + t.satisfactionRating, 0) / dayTickets.length
        : null

      dailyMetrics.push({
        date: date.toISOString().split('T')[0],
        averageRating: dayAverage,
        totalRatings: dayTickets.length
      })
    }

    // Calculate satisfaction percentage from distribution
    const satisfiedCount = (ratingDistribution[4] || 0) + (ratingDistribution[5] || 0)
    const satisfactionPercentage = totalRatings > 0
      ? (satisfiedCount / totalRatings) * 100
      : 0

    return NextResponse.json({
      period,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      overall: {
        totalRatings,
        averageRating: Math.round(averageRating * 100) / 100,
        satisfactionPercentage: Math.round(satisfactionPercentage * 100) / 100,
        ratingDistribution
      },
      staff: staffArray,
      dailyMetrics,
      recentFeedback: recentTickets
        .filter(t => t.satisfactionFeedback)
        .slice(0, 10)
        .map(t => ({
          ticketNumber: t.ticketNumber,
          rating: t.satisfactionRating,
          feedback: t.satisfactionFeedback,
          resolvedAt: t.resolvedAt,
          assignee: t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : 'Unassigned'
        }))
    })
  } catch (error) {
    logger.error('Error fetching satisfaction metrics', error)
    return NextResponse.json(
      { error: 'Failed to fetch satisfaction metrics' },
      { status: 500 }
    )
  }
}
