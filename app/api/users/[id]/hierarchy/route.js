import { NextResponse } from 'next/server'
import { PrismaClient } from '../../../../../lib/generated/prisma/index.js'
import { getCurrentUser } from '../../../../../lib/auth.js'

const prisma = new PrismaClient()

export async function PUT(request, { params }) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const userRoles = user?.roles || []
    const roleNames = userRoles.map(role =>
      typeof role === 'string' ? role : (role.role?.name || role.name)
    )
    const isAdmin = roleNames.includes('Admin')

    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { managerId } = await request.json()

    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: {
        managerId: managerId || null
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
        }
      }
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('Error updating user hierarchy:', error)
    return NextResponse.json({ error: 'Failed to update user hierarchy' }, { status: 500 })
  }
}

export async function GET(request, { params }) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user with hierarchy information
    const userWithHierarchy = await prisma.user.findUnique({
      where: { id: params.id },
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
        }
      }
    })

    if (!userWithHierarchy) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(userWithHierarchy)
  } catch (error) {
    console.error('Error fetching user hierarchy:', error)
    return NextResponse.json({ error: 'Failed to fetch user hierarchy' }, { status: 500 })
  }
}