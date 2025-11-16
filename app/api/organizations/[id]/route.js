import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request, { params }) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organization = await prisma.organization.findUnique({
      where: { id: params.id },
      include: {
        users: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        _count: {
          select: {
            users: true,
            tickets: true,
          },
        },
      },
    })

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    return NextResponse.json(organization)
  } catch (error) {
    console.error('Error fetching organization:', error)
    return NextResponse.json({ error: 'Failed to fetch organization' }, { status: 500 })
  }
}

export async function PUT(request, { params }) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, domain, description } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const organization = await prisma.organization.update({
      where: { id: params.id },
      data: {
        name,
        domain: domain || null,
        description: description || null,
      },
      include: {
        _count: {
          select: {
            users: true,
            tickets: true,
          },
        },
      },
    })

    return NextResponse.json(organization)
  } catch (error) {
    console.error('Error updating organization:', error)
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to update organization' }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.organization.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting organization:', error)
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to delete organization' }, { status: 500 })
  }
}
