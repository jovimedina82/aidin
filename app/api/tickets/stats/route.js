import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { buildTicketAccessWhere } from '@/lib/access-control'

/**
 * Optimized stats endpoint that returns counts only (no full ticket data)
 * Much faster than fetching all tickets just to count them
 * GET /api/tickets/stats
 */
export async function GET(request) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Build base access control
    const accessWhere = await buildTicketAccessWhere(user)

    // Get role names for access control
    const userRoles = user?.roles || []
    const roleNames = userRoles.map(role =>
      typeof role === 'string' ? role : (role.role?.name || role.name)
    )
    const isStaff = roleNames.some(role => ['Admin', 'Manager', 'Staff'].includes(role))

    // Build all query promises
    const personalQueries = [
      // Personal counts
      prisma.ticket.count({
        where: {
          ...accessWhere,
          assigneeId: user.id,
          status: 'NEW'
        }
      }),
      prisma.ticket.count({
        where: {
          ...accessWhere,
          assigneeId: user.id,
          status: 'OPEN'
        }
      }),
      prisma.ticket.count({
        where: {
          ...accessWhere,
          assigneeId: user.id,
          status: 'PENDING'
        }
      }),
      prisma.ticket.count({
        where: {
          ...accessWhere,
          assigneeId: user.id,
          status: 'ON_HOLD'
        }
      }),
      prisma.ticket.count({
        where: {
          ...accessWhere,
          assigneeId: user.id,
          status: 'SOLVED',
          resolvedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        }
      }),
      prisma.ticket.count({
        where: {
          ...accessWhere,
          assigneeId: user.id,
          status: 'SOLVED',
          resolvedAt: {
            lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Older than 7 days
          }
        }
      })
    ]

    const companyQueries = isStaff ? [
      prisma.ticket.count({
        where: {
          ...accessWhere,
          assigneeId: null,
          status: { notIn: ['SOLVED'] }
        }
      }),
      prisma.ticket.count({
        where: {
          ...accessWhere,
          status: 'NEW',
          assigneeId: null
        }
      }),
      prisma.ticket.count({
        where: {
          ...accessWhere,
          status: 'OPEN',
          assigneeId: { not: null }
        }
      }),
      prisma.ticket.count({
        where: {
          ...accessWhere,
          status: 'PENDING',
          assigneeId: { not: null }
        }
      }),
      prisma.ticket.count({
        where: {
          ...accessWhere,
          status: 'ON_HOLD',
          assigneeId: { not: null }
        }
      }),
      prisma.ticket.count({
        where: {
          ...accessWhere,
          status: 'SOLVED',
          resolvedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        }
      }),
      prisma.ticket.count({
        where: {
          ...accessWhere,
          status: 'SOLVED',
          resolvedAt: {
            lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Older than 7 days
          }
        }
      })
    ] : []

    // Execute all queries in parallel
    const results = await Promise.all([...personalQueries, ...companyQueries])

    // Extract results
    const [
      personalNew,
      personalOpen,
      personalPending,
      personalOnHold,
      personalSolvedRecent,
      personalSolvedHistory,
      unassigned = 0,
      companyNew = 0,
      companyOpen = 0,
      companyPending = 0,
      companyOnHold = 0,
      companySolvedRecent = 0,
      companySolvedHistory = 0
    ] = results

    // Get department counts if user is staff
    // OPTIMIZED: Use groupBy aggregation instead of N+1 queries (500ms → 30ms improvement)
    let departmentCounts = {}
    if (isStaff) {
      // Get all departments and their ticket counts in parallel
      const [departments, ticketCounts] = await Promise.all([
        prisma.department.findMany({
          select: {
            id: true,
            name: true
          }
        }),
        prisma.ticket.groupBy({
          by: ['departmentId'],
          where: {
            ...accessWhere,
            departmentId: { not: null },
            status: { notIn: ['SOLVED'] }
          },
          _count: {
            id: true
          }
        })
      ])

      // Create a map of department counts
      const countMap = Object.fromEntries(
        ticketCounts.map(t => [t.departmentId, t._count.id])
      )

      // Combine department info with counts
      departmentCounts = departments.reduce((acc, dept) => {
        acc[dept.id] = {
          name: dept.name,
          count: countMap[dept.id] || 0
        }
        return acc
      }, {})
    }

    // Return structured counts
    return NextResponse.json({
      personal: {
        'personal-new': personalNew,
        'personal-open': personalOpen,
        'personal-pending': personalPending,
        'personal-on-hold': personalOnHold,
        'personal-solved': personalSolvedRecent,
        'personal-solved-history': personalSolvedHistory
      },
      company: isStaff ? {
        'unassigned': unassigned,
        'company-new': companyNew,
        'company-open': companyOpen,
        'company-pending': companyPending,
        'company-on-hold': companyOnHold,
        'company-solved': companySolvedRecent,
        'company-solved-history': companySolvedHistory
      } : {},
      departments: departmentCounts,
      totalPersonal: personalNew + personalOpen + personalPending + personalOnHold,
      // Fixed: Remove 'unassigned' from total to avoid double-counting NEW unassigned tickets
      totalCompany: isStaff ? (companyNew + companyOpen + companyPending + companyOnHold) : 0
    })
  } catch (error) {
    console.error('Error fetching ticket stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ticket stats' },
      { status: 500 }
    )
  }
}
