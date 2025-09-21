import { NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"


// Helper function to get week boundaries (Monday to Sunday)
function getWeekBoundaries(date = new Date()) {
  const inputDate = new Date(date)

  // Get the Monday of the week
  const monday = new Date(inputDate)
  const dayOfWeek = monday.getDay()
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  monday.setDate(monday.getDate() + daysToMonday)
  monday.setHours(0, 0, 0, 0)

  // Get the Sunday of the week
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  return { monday, sunday }
}

// Helper function to get week number (ISO week number)
function getWeekNumber(date) {
  const tempDate = new Date(date)
  tempDate.setHours(0, 0, 0, 0)
  tempDate.setDate(tempDate.getDate() + 3 - (tempDate.getDay() + 6) % 7)
  const week1 = new Date(tempDate.getFullYear(), 0, 4)
  return 1 + Math.round(((tempDate - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7)
}

export async function POST(request) {
  try {
    // Check if user is authenticated and has admin privileges
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRoles = user?.roles || []
    const roleNames = userRoles.map(role =>
      typeof role === 'string' ? role : (role.role?.name || role.name)
    )
    const isAdmin = roleNames.includes('Admin')

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    const { date } = await request.json()
    const targetDate = date ? new Date(date) : new Date()

    const { monday, sunday } = getWeekBoundaries(targetDate)
    const weekNumber = getWeekNumber(targetDate)
    const year = targetDate.getFullYear()

    // Calculate statistics for the week
    const [
      totalTickets,
      newTickets,
      openTickets,
      pendingTickets,
      onHoldTickets,
      solvedTickets,
      closedTickets,
      unassignedTickets
    ] = await Promise.all([
      // Total tickets created in this week
      prisma.ticket.count({
        where: {
          createdAt: {
            gte: monday,
            lte: sunday
          }
        }
      }),
      // New tickets
      prisma.ticket.count({
        where: {
          createdAt: {
            gte: monday,
            lte: sunday
          },
          status: 'NEW'
        }
      }),
      // Open tickets
      prisma.ticket.count({
        where: {
          createdAt: {
            gte: monday,
            lte: sunday
          },
          status: 'OPEN'
        }
      }),
      // Pending tickets
      prisma.ticket.count({
        where: {
          createdAt: {
            gte: monday,
            lte: sunday
          },
          status: 'PENDING'
        }
      }),
      // On-hold tickets
      prisma.ticket.count({
        where: {
          createdAt: {
            gte: monday,
            lte: sunday
          },
          status: 'ON_HOLD'
        }
      }),
      // Solved tickets (resolved in this week)
      prisma.ticket.count({
        where: {
          resolvedAt: {
            gte: monday,
            lte: sunday
          },
          status: 'SOLVED'
        }
      }),
      // Closed tickets
      prisma.ticket.count({
        where: {
          closedAt: {
            gte: monday,
            lte: sunday
          },
          status: 'CLOSED'
        }
      }),
      // Unassigned tickets created in this week
      prisma.ticket.count({
        where: {
          createdAt: {
            gte: monday,
            lte: sunday
          },
          assigneeId: null
        }
      })
    ])

    // Calculate effectiveness percentage
    const effectiveness = totalTickets > 0 ? (solvedTickets / totalTickets) * 100 : 0

    // Create or update weekly stats
    const weeklyStats = await prisma.weeklyTicketStats.upsert({
      where: {
        year_weekNumber: {
          year,
          weekNumber
        }
      },
      update: {
        weekStartDate: monday,
        weekEndDate: sunday,
        totalTickets,
        newTickets,
        openTickets,
        pendingTickets,
        onHoldTickets,
        solvedTickets,
        closedTickets,
        unassignedTickets,
        effectiveness
      },
      create: {
        weekStartDate: monday,
        weekEndDate: sunday,
        year,
        weekNumber,
        totalTickets,
        newTickets,
        openTickets,
        pendingTickets,
        onHoldTickets,
        solvedTickets,
        closedTickets,
        unassignedTickets,
        effectiveness
      }
    })

    return NextResponse.json({
      success: true,
      weeklyStats,
      message: `Weekly statistics calculated for week ${weekNumber} of ${year}`
    })

  } catch (error) {
    console.error('Error calculating weekly stats:', error)
    return NextResponse.json(
      { error: 'Failed to calculate weekly statistics' },
      { status: 500 }
    )
  }
}

export async function GET(request) {
  try {
    // Check if user is authenticated
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')) : new Date().getFullYear()
    const weekNumber = searchParams.get('week') ? parseInt(searchParams.get('week')) : null
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')) : 52

    let whereClause = { year }
    if (weekNumber) {
      whereClause.weekNumber = weekNumber
    }

    const weeklyStats = await prisma.weeklyTicketStats.findMany({
      where: whereClause,
      orderBy: [
        { year: 'desc' },
        { weekNumber: 'desc' }
      ],
      take: limit
    })

    return NextResponse.json({
      success: true,
      data: weeklyStats,
      count: weeklyStats.length
    })

  } catch (error) {
    console.error('Error fetching weekly stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch weekly statistics' },
      { status: 500 }
    )
  }
}