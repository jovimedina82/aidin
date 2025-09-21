import { NextResponse } from 'next/server'
import { PrismaClient } from '../../../../lib/generated/prisma/index.js'
import { getCurrentUser } from '../../../../lib/auth.js'

const prisma = new PrismaClient()

export async function GET(request, { params }) {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: {
        id: params.id
      },
      include: {
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    })

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(ticket)
  } catch (error) {
    console.error('Error fetching ticket:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ticket' },
      { status: 500 }
    )
  }
}

export async function PUT(request, { params }) {
  try {
    const data = await request.json()

    const ticket = await prisma.ticket.update({
      where: {
        id: params.id
      },
      data: {
        ...data,
        updatedAt: new Date()
      },
      include: {
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    })

    return NextResponse.json(ticket)
  } catch (error) {
    console.error('Error updating ticket:', error)
    return NextResponse.json(
      { error: 'Failed to update ticket' },
      { status: 500 }
    )
  }
}

export async function PATCH(request, { params }) {
  try {
    // Get current user for automatic assignment
    const currentUser = await getCurrentUser(request)
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user roles to check if admin
    const userRoles = currentUser?.roles || []
    const roleNames = userRoles.map(role =>
      typeof role === 'string' ? role : (role.role?.name || role.name)
    )
    const isAdmin = roleNames.includes('Admin')

    const data = await request.json()

    // First, get the current ticket to check current state
    const currentTicket = await prisma.ticket.findUnique({
      where: { id: params.id }
    })

    if (!currentTicket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Handle status changes with timestamps
    const updateData = { ...data }

    // NEW ticket assignment workflow logic
    if (data.status) {
      // Rule 1: Only admin can change status TO 'NEW'
      if (data.status === 'NEW' && currentTicket.status !== 'NEW' && !isAdmin) {
        return NextResponse.json({
          error: 'Only System Administrator can change status back to NEW'
        }, { status: 403 })
      }

      // Rule 2: When changing TO 'NEW', always unassign the ticket
      if (data.status === 'NEW') {
        updateData.assigneeId = null
      }

      // Rule 3: When changing FROM 'NEW' to any other status, auto-assign to current user
      if (currentTicket.status === 'NEW' && data.status !== 'NEW') {
        updateData.assigneeId = currentUser.id
      }
    }

    if (data.status === 'SOLVED' && !updateData.resolvedAt) {
      updateData.resolvedAt = new Date()
    }

    if (data.status === 'CLOSED' && !updateData.closedAt) {
      updateData.closedAt = new Date()
    }

    const ticket = await prisma.ticket.update({
      where: {
        id: params.id
      },
      data: {
        ...updateData,
        updatedAt: new Date()
      },
      include: {
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    })

    return NextResponse.json(ticket)
  } catch (error) {
    console.error('Error updating ticket:', error)
    return NextResponse.json(
      { error: 'Failed to update ticket' },
      { status: 500 }
    )
  }
}