import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizations = await prisma.organization.findMany({
      include: {
        _count: {
          select: {
            users: true,
            tickets: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    return NextResponse.json(organizations)
  } catch (error) {
    console.error('Error fetching organizations:', error)
    return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 })
  }
}

export async function POST(request) {
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

    const organization = await prisma.organization.create({
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
    console.error('Error creating organization:', error)
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Organization with this name already exists' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 })
  }
}
