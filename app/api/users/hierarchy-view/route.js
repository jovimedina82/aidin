import { NextResponse } from 'next/server'
import { PrismaClient } from '../../../../lib/generated/prisma/index.js'
import { getCurrentUser } from '../../../../lib/auth.js'

const prisma = new PrismaClient()

export async function GET(request) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRoles = user?.roles || []
    const roleNames = userRoles.map(role =>
      typeof role === 'string' ? role : (role.role?.name || role.name)
    )
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

      // Add direct reports
      for (const report of currentUserWithHierarchy.directReports) {
        accessibleUserIds.add(report.id)

        // Add their direct reports (2 levels down)
        const subReports = await prisma.user.findMany({
          where: { managerId: report.id },
          select: { id: true }
        })
        subReports.forEach(subReport => accessibleUserIds.add(subReport.id))
      }

      // Add manager and manager's other direct reports (peers)
      if (currentUserWithHierarchy.manager) {
        accessibleUserIds.add(currentUserWithHierarchy.manager.id)

        const peers = await prisma.user.findMany({
          where: { managerId: currentUserWithHierarchy.manager.id },
          select: { id: true }
        })
        peers.forEach(peer => accessibleUserIds.add(peer.id))
      }

      // Add users from same departments
      for (const userDept of currentUserWithHierarchy.departments) {
        const deptUsers = await prisma.userDepartment.findMany({
          where: { departmentId: userDept.departmentId },
          select: { userId: true }
        })
        deptUsers.forEach(deptUser => accessibleUserIds.add(deptUser.userId))
      }

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