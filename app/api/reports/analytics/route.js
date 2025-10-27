import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request) {
  try {
    const currentUser = await getCurrentUser(request)
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has admin/staff access for reports
    const userRoles = currentUser?.roles || []
    const roleNames = userRoles.map(role =>
      typeof role === 'string' ? role : (role.role?.name || role.name)
    )
    const isStaff = roleNames.some(role => ['Admin', 'Manager', 'Staff'].includes(role))

    if (!isStaff) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'daily'
    const range = parseInt(searchParams.get('range')) || 30
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const priority = searchParams.get('priority')
    const status = searchParams.get('status')
    const agent = searchParams.get('agent')
    const category = searchParams.get('category')

    // Calculate date range
    const endDate = dateTo ? new Date(dateTo) : new Date()
    const startDate = dateFrom ? new Date(dateFrom) : new Date(Date.now() - range * 24 * 60 * 60 * 1000)

    // Build filters
    const filters = {
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    }

    if (priority) filters.priority = priority
    if (status) filters.status = status
    if (agent) filters.assigneeId = agent
    if (category) filters.category = category

    // Fetch all tickets within the date range with filters
    const tickets = await prisma.ticket.findMany({
      where: filters,
      include: {
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    // Generate ticket trends data
    const ticketTrends = []
    const daysInRange = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))

    for (let i = 0; i < daysInRange; i++) {
      const currentDate = new Date(startDate)
      currentDate.setDate(startDate.getDate() + i)
      const nextDate = new Date(currentDate)
      nextDate.setDate(currentDate.getDate() + 1)

      const created = tickets.filter(t => {
        const ticketDate = new Date(t.createdAt)
        return ticketDate >= currentDate && ticketDate < nextDate
      }).length

      const resolved = tickets.filter(t => {
        if (!t.resolvedAt) return false
        const resolvedDate = new Date(t.resolvedAt)
        return resolvedDate >= currentDate && resolvedDate < nextDate
      }).length

      ticketTrends.push({
        date: currentDate.toISOString().split('T')[0],
        displayLabel: currentDate.toLocaleDateString(),
        created,
        resolved
      })
    }

    // Generate agent performance data
    const agentMap = new Map()

    tickets.forEach(ticket => {
      if (ticket.assignee) {
        const agentId = ticket.assignee.id
        const agentName = `${ticket.assignee.firstName} ${ticket.assignee.lastName}`

        if (!agentMap.has(agentId)) {
          agentMap.set(agentId, {
            id: agentId,
            name: agentName,
            assigned: 0,
            resolved: 0
          })
        }

        const agent = agentMap.get(agentId)
        agent.assigned++

        if (ticket.status === 'SOLVED') {
          agent.resolved++
        }
      }
    })

    const agentPerformance = Array.from(agentMap.values())

    // Generate priority breakdown
    const priorityMap = new Map()
    tickets.forEach(ticket => {
      const priority = ticket.priority || 'NORMAL'
      priorityMap.set(priority, (priorityMap.get(priority) || 0) + 1)
    })

    const priorityBreakdown = Array.from(priorityMap.entries()).map(([priority, count]) => ({
      priority,
      count
    }))

    // Generate category breakdown
    const categoryMap = new Map()
    tickets.forEach(ticket => {
      const category = ticket.category || 'General'
      categoryMap.set(category, (categoryMap.get(category) || 0) + 1)
    })

    const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, count]) => ({
      category,
      count
    }))

    // Define SLA targets (in hours) for each priority level
    const SLA_TARGETS = {
      URGENT: 4,    // 4 hours to resolve
      HIGH: 8,      // 8 hours to resolve
      NORMAL: 24,   // 24 hours to resolve
      LOW: 72       // 72 hours to resolve
    }

    // Calculate real SLA compliance per day (last 7 days)
    const slaCompliance = []
    const last7Days = Math.min(7, daysInRange)

    for (let i = 0; i < last7Days; i++) {
      const currentDate = new Date(endDate)
      currentDate.setDate(endDate.getDate() - (last7Days - 1 - i))
      const nextDate = new Date(currentDate)
      nextDate.setDate(currentDate.getDate() + 1)

      // Get tickets resolved on this day
      const resolvedOnDay = tickets.filter(t => {
        if (!t.resolvedAt) return false
        const resolvedDate = new Date(t.resolvedAt)
        return resolvedDate >= currentDate && resolvedDate < nextDate
      })

      if (resolvedOnDay.length > 0) {
        let metSLA = 0

        resolvedOnDay.forEach(ticket => {
          const resolutionTimeMs = new Date(ticket.resolvedAt) - new Date(ticket.createdAt)
          const resolutionTimeHours = resolutionTimeMs / (1000 * 60 * 60)
          const slaTarget = SLA_TARGETS[ticket.priority] || SLA_TARGETS.NORMAL

          if (resolutionTimeHours <= slaTarget) {
            metSLA++
          }
        })

        const compliance = Math.round((metSLA / resolvedOnDay.length) * 100)
        slaCompliance.push({
          date: currentDate.toISOString().split('T')[0],
          compliance
        })
      } else {
        // No tickets resolved on this day
        slaCompliance.push({
          date: currentDate.toISOString().split('T')[0],
          compliance: null
        })
      }
    }

    // Calculate real response times (MTTR - Mean Time To Resolution) per day (last 7 days)
    const responseTimes = []

    for (let i = 0; i < last7Days; i++) {
      const currentDate = new Date(endDate)
      currentDate.setDate(endDate.getDate() - (last7Days - 1 - i))
      const nextDate = new Date(currentDate)
      nextDate.setDate(currentDate.getDate() + 1)

      // Get tickets resolved on this day
      const resolvedOnDay = tickets.filter(t => {
        if (!t.resolvedAt) return false
        const resolvedDate = new Date(t.resolvedAt)
        return resolvedDate >= currentDate && resolvedDate < nextDate
      })

      if (resolvedOnDay.length > 0) {
        let totalHours = 0

        resolvedOnDay.forEach(ticket => {
          const resolutionTimeMs = new Date(ticket.resolvedAt) - new Date(ticket.createdAt)
          const resolutionTimeHours = resolutionTimeMs / (1000 * 60 * 60)
          totalHours += resolutionTimeHours
        })

        const avgHours = Math.round((totalHours / resolvedOnDay.length) * 10) / 10
        responseTimes.push({
          date: currentDate.toISOString().split('T')[0],
          avgHours,
          ticketCount: resolvedOnDay.length
        })
      }
    }

    const analytics = {
      ticketTrends,
      agentPerformance,
      priorityBreakdown,
      categoryBreakdown,
      slaCompliance,
      responseTimes,
      summary: {
        totalTickets: tickets.length,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        },
        filters: {
          period,
          range,
          priority,
          status,
          agent,
          category
        }
      }
    }

    return NextResponse.json(analytics)

  } catch (error) {
    console.error('Analytics API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    )
  }
}