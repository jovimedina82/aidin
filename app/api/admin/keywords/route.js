import { NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"


export async function GET(request) {
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

    // Get all departments with their keywords
    const departments = await prisma.department.findMany({
      include: {
        keywords: {
          orderBy: {
            weight: 'desc'
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    return NextResponse.json({ departments })

  } catch (error) {
    console.error('Error fetching keywords:', error)
    return NextResponse.json({ error: 'Failed to fetch keywords' }, { status: 500 })
  }
}

export async function POST(request) {
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
    const { departmentId, keyword, weight } = data

    // Validate required fields
    if (!departmentId || !keyword || weight === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Create new keyword
    const newKeyword = await prisma.departmentKeyword.create({
      data: {
        departmentId,
        keyword: keyword.toLowerCase().trim(),
        weight: parseFloat(weight),
        isActive: true
      },
      include: {
        department: {
          select: {
            name: true
          }
        }
      }
    })

    return NextResponse.json(newKeyword, { status: 201 })

  } catch (error) {
    console.error('Error creating keyword:', error)

    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Keyword already exists for this department' }, { status: 400 })
    }

    return NextResponse.json({ error: 'Failed to create keyword' }, { status: 500 })
  }
}