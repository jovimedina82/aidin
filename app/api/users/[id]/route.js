import { NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"


export async function GET(request, { params }) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: params.id },
      include: {
        roles: {
          include: {
            role: true
          }
        },
        departments: {
          include: {
            department: true
          }
        }
      }
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(targetUser)
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 })
  }
}

export async function PUT(request, { params }) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to update users
    const userRoles = user?.roles || []
    const roleNames = userRoles.map(role =>
      typeof role === 'string' ? role : (role.role?.name || role.name)
    )
    const isAdmin = roleNames.includes('Admin')
    const isManager = roleNames.includes('Manager')

    if (!isAdmin && !isManager) {
      return NextResponse.json({ error: 'Admin or Manager access required' }, { status: 403 })
    }

    const data = await request.json()
    const { firstName, lastName, email, phone, userType, isActive, departmentIds } = data

    // Check if target user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: params.id }
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Update user basic information
    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: {
        firstName,
        lastName,
        email,
        phone,
        userType,
        isActive
      }
    })

    // Handle department assignments if provided
    if (departmentIds && Array.isArray(departmentIds)) {
      // Delete existing department assignments
      await prisma.userDepartment.deleteMany({
        where: { userId: params.id }
      })

      // Create new department assignments
      for (const departmentId of departmentIds) {
        await prisma.userDepartment.create({
          data: {
            userId: params.id,
            departmentId: departmentId
          }
        })
      }
    }

    // Fetch updated user with relationships
    const userWithRelations = await prisma.user.findUnique({
      where: { id: params.id },
      include: {
        roles: {
          include: {
            role: true
          }
        },
        departments: {
          include: {
            department: true
          }
        }
      }
    })

    return NextResponse.json(userWithRelations)
  } catch (error) {
    console.error('Error updating user:', error)

    // Check for unique constraint violation
    if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 })
    }

    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
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

    // Get request body for manager reassignment
    const body = await request.json().catch(() => ({}))
    const { newManagerId } = body

    // Check if user exists and get their direct reports
    const targetUser = await prisma.user.findUnique({
      where: { id: params.id },
      include: {
        directReports: true,
        manager: true
      }
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Prevent self-deletion
    if (params.id === user.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
    }

    // If user has direct reports, require manager reassignment
    if (targetUser.directReports.length > 0 && !newManagerId) {
      return NextResponse.json({
        error: 'Manager reassignment required',
        requiresManagerReassignment: true,
        directReports: targetUser.directReports
      }, { status: 400 })
    }

    // Delete user with proper cleanup of related records
    await prisma.$transaction(async (prisma) => {
      // 1. Delete user roles
      await prisma.userRole.deleteMany({
        where: { userId: params.id }
      })

      // 2. Delete user departments
      await prisma.userDepartment.deleteMany({
        where: { userId: params.id }
      })

      // 3. Update tickets to remove user references (set to null)
      // For requesterId: always set to null
      await prisma.ticket.updateMany({
        where: { requesterId: params.id },
        data: { requesterId: null }
      })

      // For assigneeId: preserve SOLVED tickets for historical purposes, set others to null
      await prisma.ticket.updateMany({
        where: {
          assigneeId: params.id,
          status: { not: 'SOLVED' }  // Only update non-solved tickets
        },
        data: { assigneeId: null }
      })

      // SOLVED tickets keep their assigneeId for historical attribution
      // (they remain assigned to the deleted user for audit trail)

      // 4. PRESERVE ticket comments for historical purposes
      // Comments remain in database but user reference becomes null or we keep it for history
      // We'll just leave them as-is since the user deletion will be noted in the system

      // 5. Handle manager hierarchy reassignment
      if (targetUser.directReports.length > 0) {
        if (newManagerId) {
          // Reassign all direct reports to the new manager
          await prisma.user.updateMany({
            where: { managerId: params.id },
            data: { managerId: newManagerId }
          })
        } else if (targetUser.manager) {
          // If no new manager specified but user has a manager, promote to immediate supervisor
          await prisma.user.updateMany({
            where: { managerId: params.id },
            data: { managerId: targetUser.manager.id }
          })
        } else {
          // No manager available, set to null (will need admin to reassign later)
          await prisma.user.updateMany({
            where: { managerId: params.id },
            data: { managerId: null }
          })
        }
      }

      // 6. Finally, delete the user
      await prisma.user.delete({
        where: { id: params.id }
      })
    })

    return NextResponse.json({
      message: 'User deleted successfully',
      reassignedReports: targetUser.directReports.length
    })
  } catch (error) {
    console.error('Error deleting user:', error)

    // Check if user not found
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}