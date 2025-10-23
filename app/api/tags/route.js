import { NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"

// GET - Fetch all tags
export async function GET(request) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const tags = await prisma.tag.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [
        { usageCount: 'desc' },
        { name: 'asc' }
      ],
      include: {
        _count: {
          select: { tickets: true }
        }
      }
    })

    return NextResponse.json({ tags })
  } catch (error) {
    console.error('Error fetching tags:', error)
    return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 })
  }
}

// POST - Create a new tag
export async function POST(request) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin or manager
    const isAdmin = user.roles?.some(role =>
      ['Admin', 'Manager'].includes(role.role?.name || role.name)
    )

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Only admins and managers can create tags' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, displayName, color, category } = body

    if (!name || !displayName) {
      return NextResponse.json(
        { error: 'Name and display name are required' },
        { status: 400 }
      )
    }

    // Normalize name to lowercase-hyphenated format
    const normalizedName = name.toLowerCase().replace(/\s+/g, '-')

    // Check if tag already exists
    const existing = await prisma.tag.findUnique({
      where: { name: normalizedName }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'A tag with this name already exists' },
        { status: 409 }
      )
    }

    const tag = await prisma.tag.create({
      data: {
        name: normalizedName,
        displayName,
        color: color || null,
        category: category || null,
        isActive: true,
        usageCount: 0
      }
    })

    return NextResponse.json({ success: true, tag })
  } catch (error) {
    console.error('Error creating tag:', error)
    return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 })
  }
}

// PUT - Update a tag
export async function PUT(request) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin or manager
    const isAdmin = user.roles?.some(role =>
      ['Admin', 'Manager'].includes(role.role?.name || role.name)
    )

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Only admins and managers can update tags' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { id, displayName, color, category, isActive } = body

    if (!id) {
      return NextResponse.json({ error: 'Tag ID is required' }, { status: 400 })
    }

    const tag = await prisma.tag.update({
      where: { id },
      data: {
        ...(displayName !== undefined && { displayName }),
        ...(color !== undefined && { color }),
        ...(category !== undefined && { category }),
        ...(isActive !== undefined && { isActive })
      }
    })

    return NextResponse.json({ success: true, tag })
  } catch (error) {
    console.error('Error updating tag:', error)
    return NextResponse.json({ error: 'Failed to update tag' }, { status: 500 })
  }
}

// DELETE - Delete a tag
export async function DELETE(request) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin or manager
    const isAdmin = user.roles?.some(role =>
      ['Admin', 'Manager'].includes(role.role?.name || role.name)
    )

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Only admins and managers can delete tags' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const tagId = searchParams.get('id')

    if (!tagId) {
      return NextResponse.json({ error: 'Tag ID is required' }, { status: 400 })
    }

    // Soft delete by setting isActive to false
    await prisma.tag.update({
      where: { id: tagId },
      data: { isActive: false }
    })

    return NextResponse.json({ success: true, message: 'Tag deleted successfully' })
  } catch (error) {
    console.error('Error deleting tag:', error)
    return NextResponse.json({ error: 'Failed to delete tag' }, { status: 500 })
  }
}
