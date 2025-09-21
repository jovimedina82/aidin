import { NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"


export async function PUT(request, { params }) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has admin access
    const userRoles = user?.roles || []
    const roleNames = userRoles.map(role =>
      typeof role === 'string' ? role : (role.role?.name || role.name)
    )
    const isAdmin = roleNames.includes('Admin')

    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const data = await request.json()
    const { keyword, weight, isActive } = data

    // Update keyword
    const updatedKeyword = await prisma.departmentKeyword.update({
      where: { id: params.id },
      data: {
        keyword: keyword?.toLowerCase().trim(),
        weight: weight !== undefined ? parseFloat(weight) : undefined,
        isActive: isActive !== undefined ? isActive : undefined
      },
      include: {
        department: {
          select: {
            name: true
          }
        }
      }
    })

    return NextResponse.json(updatedKeyword)

  } catch (error) {
    console.error('Error updating keyword:', error)

    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Keyword not found' }, { status: 404 })
    }

    return NextResponse.json({ error: 'Failed to update keyword' }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has admin access
    const userRoles = user?.roles || []
    const roleNames = userRoles.map(role =>
      typeof role === 'string' ? role : (role.role?.name || role.name)
    )
    const isAdmin = roleNames.includes('Admin')

    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Delete keyword
    await prisma.departmentKeyword.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ message: 'Keyword deleted successfully' })

  } catch (error) {
    console.error('Error deleting keyword:', error)

    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Keyword not found' }, { status: 404 })
    }

    return NextResponse.json({ error: 'Failed to delete keyword' }, { status: 500 })
  }
}