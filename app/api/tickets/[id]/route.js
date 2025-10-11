import { NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"
import { hasTicketAccess, canTakeTicket } from "@/lib/access-control"
import { emitTicketUpdated, emitTicketDeleted } from '@/lib/socket'
import { logEvent } from '@/lib/audit'


export async function GET(request, { params }) {
  try {
    // Get current user for access control
    const currentUser = await getCurrentUser(request)
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }


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
        },
        attachments: {
          orderBy: {
            uploadedAt: 'desc'
          }
        },
        // Include parent ticket info
        parentTicket: {
          select: {
            id: true,
            ticketNumber: true,
            title: true,
            status: true,
            createdAt: true
          }
        },
        // Include child tickets
        childTickets: {
          select: {
            id: true,
            ticketNumber: true,
            title: true,
            status: true,
            createdAt: true,
            requester: {
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
        },
        // Include email messages (for email-based tickets)
        ticketMessages: {
          orderBy: {
            createdAt: 'asc'
          }
        },
        // Include inbound email messages with images
        inboundMessages: {
          orderBy: {
            receivedAt: 'desc'
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

    // Apply access control
    const hasAccess = await hasTicketAccess(currentUser, ticket)

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
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

    // Get current user for validation
    const currentUser = await getCurrentUser(request)
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user roles
    const userRoles = currentUser?.roles || []
    const roleNames = userRoles.map(role =>
      typeof role === 'string' ? role : (role.role?.name || role.name)
    )

    // If assigneeId is being updated, validate staff assignment rules
    if (data.assigneeId) {
      // Get the current ticket to check who created it
      const currentTicket = await prisma.ticket.findUnique({
        where: { id: params.id }
      })

      if (!currentTicket) {
        return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
      }

      // Staff validation - staff cannot be assigned to tickets they created
      if (currentTicket.requesterId === data.assigneeId) {
        // Get the assignee's roles to check if they are staff
        const assignee = await prisma.user.findUnique({
          where: { id: data.assigneeId },
          include: {
            roles: {
              include: {
                role: true
              }
            }
          }
        })

        if (assignee) {
          const assigneeRoles = assignee.roles.map(role => role.role.name)
          if (assigneeRoles.includes('Staff')) {
            return NextResponse.json({
              error: 'Staff members cannot be assigned to tickets they created themselves. Please assign to another staff member, manager, or admin.'
            }, { status: 403 })
          }
        }
      }
    }

    // Staff validation - staff cannot change status or assignee of tickets they created
    // They can only add comments to their own tickets
    if (data.status || data.assigneeId || data.priority || data.category || data.title || data.description) {
      const currentTicket = await prisma.ticket.findUnique({
        where: { id: params.id }
      })

      if (currentTicket && currentTicket.requesterId === currentUser.id) {
        const isStaff = roleNames.includes('Staff')
        const isAdmin = roleNames.includes('Admin')
        const isManager = roleNames.includes('Manager')

        if (isStaff && !isAdmin && !isManager) {
          return NextResponse.json({
            error: 'Staff members cannot modify tickets they created themselves. You can only add comments to your own tickets.'
          }, { status: 403 })
        }
      }
    }

    // Get the current ticket to check current state for auto status changes
    const currentTicket = await prisma.ticket.findUnique({
      where: { id: params.id }
    })

    if (!currentTicket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Apply automatic assignment and status change rules
    const updateData = { ...data }

    // Check if current user is admin
    const isAdmin = roleNames.includes('Admin')

    // Rule 1: Auto-change status from NEW to OPEN when ticket is assigned
    if (data.assigneeId && currentTicket.status === 'NEW') {
      updateData.status = 'OPEN'
    }

    // Rule 2: Auto-assign ticket to current user when changing status from NEW to OPEN/PENDING/ON_HOLD/SOLVED
    // if the ticket is currently unassigned
    if (data.status &&
        currentTicket.status === 'NEW' &&
        !currentTicket.assigneeId &&
        ['OPEN', 'PENDING', 'ON_HOLD', 'SOLVED'].includes(data.status)) {
      updateData.assigneeId = currentUser.id
    }

    // Rule 3: Auto-change status from NEW to OPEN when taking (self-assigning) an unassigned NEW ticket
    if (data.assigneeId === currentUser.id &&
        currentTicket.status === 'NEW' &&
        !currentTicket.assigneeId) {
      updateData.status = 'OPEN'
    }

    // Rule 4: Admin privilege - when changing status to NEW, automatically unassign the ticket
    if (isAdmin && data.status === 'NEW') {
      updateData.assigneeId = null
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
        },
        attachments: {
          orderBy: {
            uploadedAt: 'desc'
          }
        }
      }
    })

    // Emit Socket.IO event for live updates
    emitTicketUpdated(ticket)

    return NextResponse.json(ticket)
  } catch (error) {
    console.error('Error updating ticket:', error)
    return NextResponse.json(
      { error: 'Failed to update ticket' },
      { status: 500 }
    )
  }
}

export async function DELETE(request, { params }) {
  try {
    // Get current user for authorization
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

    // Only admins can delete tickets
    if (!isAdmin) {
      return NextResponse.json({
        error: 'Only administrators can delete tickets'
      }, { status: 403 })
    }

    // Check if ticket exists
    const ticket = await prisma.ticket.findUnique({
      where: { id: params.id }
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Delete related comments first (due to foreign key constraints)
    await prisma.ticketComment.deleteMany({
      where: { ticketId: params.id }
    })

    // Delete the ticket
    await prisma.ticket.delete({
      where: { id: params.id }
    })

    // Emit Socket.IO event for live updates
    emitTicketDeleted(params.id)

    return NextResponse.json({
      success: true,
      message: 'Ticket deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting ticket:', error)
    return NextResponse.json(
      { error: 'Failed to delete ticket' },
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
        // Rule 3a: Staff validation - staff cannot take tickets they created themselves
        if (currentTicket.requesterId === currentUser.id && roleNames.includes('Staff')) {
          return NextResponse.json({
            error: 'Staff members cannot take tickets they created themselves. This ticket must be assigned to another staff member, manager, or admin.'
          }, { status: 403 })
        }
        updateData.assigneeId = currentUser.id
      }
    }

    if (data.status === 'SOLVED' && !updateData.resolvedAt) {
      updateData.resolvedAt = new Date()
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
        },
        attachments: {
          orderBy: {
            uploadedAt: 'desc'
          }
        }
      }
    })

    // Log ticket assignment/unassignment to audit trail
    if ('assigneeId' in data && currentTicket.assigneeId !== data.assigneeId) {
      const wasUnassigned = !currentTicket.assigneeId
      const wasTakenBySelf = data.assigneeId === currentUser.id
      const isUnassigning = data.assigneeId === null

      if (isUnassigning) {
        // Log unassignment
        await logEvent({
          action: 'ticket.unassigned',
          actorId: currentUser.id,
          actorEmail: currentUser.email,
          actorType: 'human',
          entityType: 'ticket',
          entityId: ticket.id,
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          userAgent: request.headers.get('user-agent') || null,
          prevValues: {
            assigneeId: currentTicket.assigneeId,
            status: currentTicket.status,
            ticketNumber: currentTicket.ticketNumber
          },
          newValues: {
            assigneeId: null,
            status: ticket.status,
            ticketNumber: ticket.ticketNumber
          },
          metadata: {
            previousAssignee: currentTicket.assignee ? `${currentTicket.assignee.firstName} ${currentTicket.assignee.lastName}` : 'unassigned'
          }
        })
      } else {
        // Log assignment or takeover
        await logEvent({
          action: wasUnassigned && wasTakenBySelf ? 'ticket.taken' : 'ticket.assigned',
          actorId: currentUser.id,
          actorEmail: currentUser.email,
          actorType: 'human',
          entityType: 'ticket',
          entityId: ticket.id,
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          userAgent: request.headers.get('user-agent') || null,
          prevValues: {
            assigneeId: currentTicket.assigneeId,
            status: currentTicket.status
          },
          newValues: {
            assigneeId: ticket.assigneeId,
            status: ticket.status,
            ticketNumber: ticket.ticketNumber
          },
          metadata: {
            assignedTo: ticket.assignee ? `${ticket.assignee.firstName} ${ticket.assignee.lastName}` : null,
            previousAssignee: currentTicket.assigneeId ? 'someone' : 'unassigned',
            isAdminTakeover: currentTicket.assigneeId && currentTicket.assigneeId !== currentUser.id && isAdmin
          }
        })
      }
    }

    // Log status changes
    if (data.status && currentTicket.status !== data.status) {
      await logEvent({
        action: 'ticket.status_changed',
        actorId: currentUser.id,
        actorEmail: currentUser.email,
        actorType: 'human',
        entityType: 'ticket',
        entityId: ticket.id,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || null,
        prevValues: {
          status: currentTicket.status
        },
        newValues: {
          status: ticket.status,
          ticketNumber: ticket.ticketNumber
        },
        metadata: {
          fromStatus: currentTicket.status,
          toStatus: ticket.status
        }
      })
    }

    return NextResponse.json(ticket)
  } catch (error) {
    console.error('Error updating ticket:', error)
    return NextResponse.json(
      { error: 'Failed to update ticket' },
      { status: 500 }
    )
  }
}