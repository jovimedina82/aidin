import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { extractRoleNames } from '@/lib/role-utils'

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

    // Get all tickets with satisfaction ratings in the period
    const tickets = await prisma.ticket.findMany({
      where: {
        satisfactionRating: {
          not: null
        },
        resolvedAt: {
          gte: startDate
        }
      },
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
      orderBy: {
        resolvedAt: 'desc'
      }
    })

    // Calculate overall metrics
    const totalRatings = tickets.length
    const averageRating = totalRatings > 0
      ? tickets.reduce((sum, t) => sum + t.satisfactionRating, 0) / totalRatings
      : 0

    // Distribution by rating (1-5)
    const ratingDistribution = {
      1: tickets.filter(t => t.satisfactionRating === 1).length,
      2: tickets.filter(t => t.satisfactionRating === 2).length,
      3: tickets.filter(t => t.satisfactionRating === 3).length,
      4: tickets.filter(t => t.satisfactionRating === 4).length,
      5: tickets.filter(t => t.satisfactionRating === 5).length
    }

    // Calculate per-staff metrics
    const staffMetrics = {}
    tickets.forEach(ticket => {
      if (!ticket.assignee) return

      const staffId = ticket.assignee.id
      if (!staffMetrics[staffId]) {
        staffMetrics[staffId] = {
          staffId,
          staffName: `${ticket.assignee.firstName} ${ticket.assignee.lastName}`,
          staffEmail: ticket.assignee.email,
          totalRatings: 0,
          totalScore: 0,
          averageRating: 0,
          distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
        }
      }

      staffMetrics[staffId].totalRatings++
      staffMetrics[staffId].totalScore += ticket.satisfactionRating
      staffMetrics[staffId].distribution[ticket.satisfactionRating]++
    })

    // Calculate average for each staff member
    Object.values(staffMetrics).forEach(staff => {
      staff.averageRating = staff.totalScore / staff.totalRatings
    })

    // Sort staff by average rating (descending)
    const staffArray = Object.values(staffMetrics).sort(
      (a, b) => b.averageRating - a.averageRating
    )

    // Calculate daily time series for the period (for graphing)
    const dailyMetrics = []
    const dayMillis = 24 * 60 * 60 * 1000
    const daysInPeriod = period === 'all' ? 90 : parseInt(period) // Default to 90 for 'all'

    for (let i = daysInPeriod - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - (i * dayMillis))
      date.setHours(0, 0, 0, 0)
      const nextDate = new Date(date.getTime() + dayMillis)

      const dayTickets = tickets.filter(t => {
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

    // Calculate satisfaction percentage (4-5 stars = satisfied)
    const satisfiedCount = tickets.filter(t => t.satisfactionRating >= 4).length
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
      recentFeedback: tickets
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
    console.error('Error fetching satisfaction metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch satisfaction metrics' },
      { status: 500 }
    )
  }
}
