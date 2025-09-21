import { NextResponse } from 'next/server'
import { PrismaClient } from '../../../../lib/generated/prisma/index.js'
import { getCurrentUser } from '../../../../lib/auth.js'

const prisma = new PrismaClient()

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

    const { searchParams } = new URL(request.url)
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')) : 50
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')) : 0

    // Get AI decisions with ticket details
    const aiDecisions = await prisma.aIDecision.findMany({
      include: {
        ticket: {
          include: {
            requester: {
              select: {
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit,
      skip: offset
    })

    // Get summary statistics
    const stats = await prisma.aIDecision.aggregate({
      _avg: {
        departmentConfidence: true
      },
      _count: {
        id: true
      }
    })

    // Get routing method distribution
    const routingMethods = await prisma.aIDecision.groupBy({
      by: ['wasOverridden'],
      _count: {
        id: true
      }
    })

    return NextResponse.json({
      decisions: aiDecisions,
      stats: {
        averageConfidence: stats._avg.departmentConfidence || 0,
        totalDecisions: stats._count.id || 0,
        overrideRate: routingMethods.find(r => r.wasOverridden)?._count.id || 0
      }
    })

  } catch (error) {
    console.error('Error fetching AI decisions:', error)
    return NextResponse.json({ error: 'Failed to fetch AI decisions' }, { status: 500 })
  }
}