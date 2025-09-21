import { NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"


export async function PUT(request, { params }) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to update user roles
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
    const { roles } = data

    if (!Array.isArray(roles)) {
      return NextResponse.json({ error: 'Roles must be an array' }, { status: 400 })
    }

    // Check if target user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: params.id },
      include: {
        roles: {
          include: {
            role: true
          }
        }
      }
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get all available roles
    const allRoles = await prisma.role.findMany()
    const roleMap = {}
    allRoles.forEach(role => {
      roleMap[role.name] = role.id
    })

    // Validate that all requested roles exist
    const invalidRoles = roles.filter(roleName => !roleMap[roleName])
    if (invalidRoles.length > 0) {
      return NextResponse.json({
        error: `Invalid roles: ${invalidRoles.join(', ')}`
      }, { status: 400 })
    }

    // Staff cannot assign admin roles (unless they are admin themselves)
    if (!isAdmin && roles.includes('Admin')) {
      return NextResponse.json({ error: 'You cannot assign admin roles' }, { status: 403 })
    }

    // Use transaction to update user roles
    await prisma.$transaction(async (prisma) => {
      // Delete existing user roles
      await prisma.userRole.deleteMany({
        where: { userId: params.id }
      })

      // Create new user roles
      for (const roleName of roles) {
        if (roleMap[roleName]) {
          await prisma.userRole.create({
            data: {
              userId: params.id,
              roleId: roleMap[roleName]
            }
          })
        }
      }
    })

    // Fetch updated user with roles
    const updatedUser = await prisma.user.findUnique({
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

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('Error updating user roles:', error)

    // Check for unique constraint violation
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Role assignment already exists' }, { status: 400 })
    }

    return NextResponse.json({ error: 'Failed to update user roles' }, { status: 500 })
  }
}