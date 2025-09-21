import { NextResponse } from 'next/server'
import { PrismaClient } from '../../../../../lib/generated/prisma/index.js'
import { getCurrentUser } from '../../../../../lib/auth.js'

const prisma = new PrismaClient()

export async function GET(request, { params }) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to delete users
    const userRoles = user?.roles || []
    const roleNames = userRoles.map(role =>
      typeof role === 'string' ? role : (role.role?.name || role.name)
    )
    const isAdmin = roleNames.includes('Admin')

    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get user with their direct reports and manager
    const targetUser = await prisma.user.findUnique({
      where: { id: params.id },
      include: {
        directReports: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            userType: true
          }
        },
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Prevent self-deletion
    if (params.id === user.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
    }

    // Get potential new managers (all users who could be managers)
    const potentialManagers = await prisma.user.findMany({
      where: {
        id: { not: params.id }, // Exclude the user being deleted
        isActive: true
      },
      include: {
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

    // Filter to show only managers and admins as potential new managers
    const eligibleManagers = potentialManagers.filter(mgr => {
      const mgrRoleNames = mgr.roles.map(ur => ur.role.name)
      return mgrRoleNames.includes('Manager') || mgrRoleNames.includes('Admin')
    })

    return NextResponse.json({
      user: {
        id: targetUser.id,
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
        email: targetUser.email
      },
      directReports: targetUser.directReports,
      currentManager: targetUser.manager,
      potentialManagers: eligibleManagers.map(mgr => ({
        id: mgr.id,
        firstName: mgr.firstName,
        lastName: mgr.lastName,
        email: mgr.email,
        roles: mgr.roles.map(ur => ur.role.name)
      })),
      canDelete: true,
      requiresManagerReassignment: targetUser.directReports.length > 0
    })

  } catch (error) {
    console.error('Error checking user deletion:', error)
    return NextResponse.json({ error: 'Failed to check user deletion requirements' }, { status: 500 })
  }
}