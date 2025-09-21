import { NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"


export async function DELETE(request) {
  try {
    // Get authenticated user
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
    const isManager = roleNames.includes('Manager')
    const isStaff = roleNames.includes('Staff') || isManager || isAdmin

    if (!isStaff) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { userIds } = await request.json()

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: 'No user IDs provided' }, { status: 400 })
    }

    // Get users to be deleted and check permissions
    const usersToDelete = await prisma.user.findMany({
      where: { id: { in: userIds } },
      include: {
        roles: {
          include: {
            role: true
          }
        }
      }
    })

    // Check permissions for each user to be deleted
    for (const targetUser of usersToDelete) {
      const targetRoles = targetUser.roles.map(ur => ur.role.name)

      if (isAdmin) {
        // Admins can delete anyone
        continue
      } else if (isManager) {
        // Managers can delete everyone except Admins
        if (targetRoles.includes('Admin')) {
          return NextResponse.json({
            error: `Cannot delete admin user: ${targetUser.email}`
          }, { status: 403 })
        }
      } else {
        // Staff cannot delete admin, manager, or other staff users
        if (targetRoles.includes('Admin') || targetRoles.includes('Manager') || targetRoles.includes('Staff')) {
          return NextResponse.json({
            error: `Cannot delete user with elevated permissions: ${targetUser.email}`
          }, { status: 403 })
        }
      }
    }

    // Prevent self-deletion
    if (userIds.includes(user.id)) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
    }

    // Start transaction to handle user deletion and ticket unassignment
    const result = await prisma.$transaction(async (tx) => {
      // Step 1: Update tickets assigned to users being deleted
      // Unassign tickets that are NOT solved (keep solved tickets as-is)
      const updatedTickets = await tx.ticket.updateMany({
        where: {
          assigneeId: { in: userIds },
          status: { not: 'SOLVED' }
        },
        data: {
          assigneeId: null
        }
      })

      // Step 2: Delete user role assignments
      await tx.userRole.deleteMany({
        where: {
          userId: { in: userIds }
        }
      })

      // Step 3: Delete ticket comments by these users
      await tx.ticketComment.deleteMany({
        where: {
          userId: { in: userIds }
        }
      })

      // Step 4: Update tickets where these users are requesters to keep tickets but set requester to null
      await tx.ticket.updateMany({
        where: {
          requesterId: { in: userIds }
        },
        data: {
          requesterId: null
        }
      })

      // Step 5: Delete the users
      const deletedUsers = await tx.user.deleteMany({
        where: {
          id: { in: userIds }
        }
      })

      return {
        deletedUsersCount: deletedUsers.count,
        unassignedTicketsCount: updatedTickets.count
      }
    })

    return NextResponse.json({
      message: `Successfully deleted ${result.deletedUsersCount} users and unassigned ${result.unassignedTicketsCount} tickets`,
      deletedCount: result.deletedUsersCount,
      unassignedTickets: result.unassignedTicketsCount
    })

  } catch (error) {
    console.error('Error in bulk delete users:', error)
    return NextResponse.json(
      { error: 'Failed to delete users' },
      { status: 500 }
    )
  }
}