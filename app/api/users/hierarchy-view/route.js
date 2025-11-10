import { NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"
import { extractRoleNames } from "@/lib/role-utils"


export async function GET(request) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const roleNames = extractRoleNames(user?.roles)
    const isAdmin = roleNames.includes('Admin')
    const isManager = roleNames.includes('Manager')

    let users = []

    if (isAdmin) {
      // Admins can see everyone
      users = await prisma.user.findMany({
        include: {
          manager: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          directReports: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          departments: {
            include: {
              department: true
            }
          },
          roles: {
            include: {
              role: true
            }
          }
        },
        orderBy: [
          { firstName: 'asc' },
          { lastName: 'asc' }
        ]
      })
    } else {
      // Get current user with their hierarchy
      const currentUserWithHierarchy = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
          manager: true,
          directReports: true,
          departments: {
            include: {
              department: true
            }
          }
        }
      })

      if (!currentUserWithHierarchy) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      // Get all users in the reporting hierarchy
      const accessibleUserIds = new Set([user.id])

      // Collect all manager IDs and department IDs for batch queries
      const reportIds = currentUserWithHierarchy.directReports.map(r => r.id)
      const departmentIds = currentUserWithHierarchy.departments.map(d => d.departmentId)

      // Add direct reports to accessible set
      reportIds.forEach(id => accessibleUserIds.add(id))

      // Batch query: Get all sub-reports, peers, and department users in parallel
      const [subReports, peers, deptUsers] = await Promise.all([
        // Get all sub-reports (2 levels down) in one query
        reportIds.length > 0
          ? prisma.user.findMany({
              where: { managerId: { in: reportIds } },
              select: { id: true }
            })
          : Promise.resolve([]),

        // Get peers (manager's other direct reports) if user has a manager
        currentUserWithHierarchy.manager
          ? prisma.user.findMany({
              where: { managerId: currentUserWithHierarchy.manager.id },
              select: { id: true }
            })
          : Promise.resolve([]),

        // Get all department users in one query
        departmentIds.length > 0
          ? prisma.userDepartment.findMany({
              where: { departmentId: { in: departmentIds } },
              select: { userId: true }
            })
          : Promise.resolve([])
      ])

      // Add manager to accessible set
      if (currentUserWithHierarchy.manager) {
        accessibleUserIds.add(currentUserWithHierarchy.manager.id)
      }

      // Add all collected IDs to the accessible set
      subReports.forEach(subReport => accessibleUserIds.add(subReport.id))
      peers.forEach(peer => accessibleUserIds.add(peer.id))
      deptUsers.forEach(deptUser => accessibleUserIds.add(deptUser.userId))

      // Fetch the accessible users with full details
      users = await prisma.user.findMany({
        where: {
          id: { in: Array.from(accessibleUserIds) }
        },
        include: {
          manager: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          directReports: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          departments: {
            include: {
              department: true
            }
          },
          roles: {
            include: {
              role: true
            }
          }
        },
        orderBy: [
          { firstName: 'asc' },
          { lastName: 'asc' }
        ]
      })
    }

    // Build hierarchy tree for response
    const userMap = new Map(users.map(u => [u.id, { ...u, children: [] }]))
    const rootUsers = []

    users.forEach(user => {
      if (user.managerId && userMap.has(user.managerId)) {
        userMap.get(user.managerId).children.push(userMap.get(user.id))
      } else {
        rootUsers.push(userMap.get(user.id))
      }
    })

    return NextResponse.json({
      users: users,
      hierarchy: rootUsers,
      currentUser: user,
      viewLevel: isAdmin ? 'admin' : isManager ? 'manager' : 'staff'
    })

  } catch (error) {
    console.error('Error fetching hierarchy view:', error)
    return NextResponse.json({ error: 'Failed to fetch hierarchy view' }, { status: 500 })
  }
}