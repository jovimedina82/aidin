import { prisma } from './prisma.js'
import { categorizeTicket, generateResponseSuggestion, suggestPriority } from './ai.js'
import { sendTicketCreatedEmail, sendTicketAssignedEmail, sendAIResponseEmail, sendTicketCreatedWithAIResponseEmail } from './email.js'

export function generateTicketNumber() {
  const timestamp = Date.now().toString().slice(-6)
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `TICK-${timestamp}${random}`
}

async function getOrCreateAIUser() {
  try {
    // Try to find existing AI user
    let aiUser = await prisma.user.findFirst({
      where: { email: 'ai-assistant@surterre.local' }
    })

    if (!aiUser) {
      // Create AI system user
      aiUser = await prisma.user.create({
        data: {
          email: 'ai-assistant@surterre.local',
          firstName: 'Aiden',
          lastName: 'AI Assistant',
          isActive: true,
          // No password needed for system user
        }
      })

      // Assign Staff role to AI user so it can create public comments
      const agentRole = await prisma.role.findFirst({
        where: { name: 'Staff' }
      })

      if (agentRole) {
        await prisma.userRole.create({
          data: {
            userId: aiUser.id,
            roleId: agentRole.id
          }
        })
      }
    }

    return aiUser
  } catch (error) {
    console.error('Error getting/creating AI user:', error)
    return null
  }
}

export async function createTicket(data, requesterId) {
  try {
    const ticketNumber = generateTicketNumber()

    // Get AI suggestions
    const [category, suggestedPriority, responseAI] = await Promise.all([
      categorizeTicket(data.title, data.description),
      suggestPriority(data.title, data.description),
      generateResponseSuggestion(data.title, data.description, data.category || 'General Question', data.priority || 'NORMAL')
    ])

    // Create ticket
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        title: data.title,
        description: data.description,
        priority: data.priority || suggestedPriority,
        category: category,
        requesterId,
        orgId: data.orgId,
        customFields: data.customFields ? JSON.stringify(data.customFields) : null,
        tags: data.tags?.join(',') || null,
        channel: data.channel || 'WEB'
      },
      include: {
        requester: true,
        assignee: true,
        org: true
      }
    })

    // Add AI response as public comment from AI user and send combined email
    if (responseAI) {
      const aiUser = await getOrCreateAIUser()

      if (aiUser) {
        const aiComment = await prisma.ticketComment.create({
          data: {
            ticketId: ticket.id,
            userId: aiUser.id,
            content: responseAI,
            isPublic: true,
            isInternal: false
          },
          include: {
            user: { select: { id: true, firstName: true, lastName: true } }
          }
        })

        // Send combined email with ticket creation details AND AI response
        await sendTicketCreatedWithAIResponseEmail(ticket, aiComment, ticket.requester)
      }
    } else {
      // If no AI response, send regular ticket creation email
      await sendTicketCreatedEmail(ticket, ticket.requester)
    }

    return ticket
  } catch (error) {
    console.error('Create ticket error:', error)
    throw new Error('Failed to create ticket')
  }
}

export async function assignTicket(ticketId, assigneeId, assignedById) {
  try {
    const ticket = await prisma.ticket.update({
      where: { id: ticketId },
      data: { 
        assigneeId,
        status: 'OPEN'
      },
      include: {
        requester: true,
        assignee: true
      }
    })

    // Send notification email to assignee
    if (ticket.assignee) {
      await sendTicketAssignedEmail(ticket, ticket.assignee, ticket.requester)
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: assignedById,
        ticketId,
        action: 'TICKET_ASSIGNED',
        entityType: 'ticket',
        entityId: ticketId,
        newValues: JSON.stringify({ assigneeId, status: 'OPEN' })
      }
    })

    return ticket
  } catch (error) {
    console.error('Assign ticket error:', error)
    throw new Error('Failed to assign ticket')
  }
}

export async function updateTicketStatus(ticketId, status, userId) {
  try {
    const oldTicket = await prisma.ticket.findUnique({
      where: { id: ticketId }
    })

    const ticket = await prisma.ticket.update({
      where: { id: ticketId },
      data: { 
        status,
        resolvedAt: status === 'SOLVED' ? new Date() : undefined,
        closedAt: status === 'CLOSED' ? new Date() : undefined
      }
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId,
        ticketId,
        action: 'STATUS_CHANGED',
        entityType: 'ticket',
        entityId: ticketId,
        oldValues: JSON.stringify({ status: oldTicket.status }),
        newValues: JSON.stringify({ status })
      }
    })

    return ticket
  } catch (error) {
    console.error('Update ticket status error:', error)
    throw new Error('Failed to update ticket status')
  }
}

export async function getTicketStats(user = null) {
  try {
    // Create base filter for role-based access
    const baseFilter = {}
    
    // Handle both role formats: string array or object array
    const userRoles = user?.roles || []
    const roleNames = Array.isArray(userRoles) && typeof userRoles[0] === 'string' 
      ? userRoles 
      : userRoles.map(role => role.role?.name || role.name || role)
    
    const isAdmin = roleNames.includes('Admin')
    const isManager = roleNames.includes('Manager')
    const isStaff = roleNames.includes('Staff') || isManager || isAdmin
    
    // If user is not staff/admin, only show their own tickets
    if (user && !isStaff) {
      baseFilter.requesterId = user.id
    }

    const [
      totalTickets,
      openTickets,
      pendingTickets,
      solvedTickets,
      onHoldTickets,
      unassignedTickets,
      unsolvedTickets,
      userAssignedTickets
    ] = await Promise.all([
      prisma.ticket.count({ where: baseFilter }),
      prisma.ticket.count({ where: { ...baseFilter, status: 'OPEN' } }),
      prisma.ticket.count({ where: { ...baseFilter, status: 'PENDING' } }),
      prisma.ticket.count({ where: { ...baseFilter, status: 'SOLVED' } }),
      prisma.ticket.count({ where: { ...baseFilter, status: 'ON_HOLD' } }),
      // Unassigned only makes sense for staff/admins
      isStaff ? prisma.ticket.count({ 
        where: { 
          assigneeId: null,
          status: { in: ['NEW', 'OPEN', 'PENDING'] }
        } 
      }) : Promise.resolve(0),
      prisma.ticket.count({ 
        where: { 
          ...baseFilter,
          status: { in: ['NEW', 'OPEN', 'PENDING'] }
        } 
      }),
      // Count tickets assigned to this user (for "Your work")
      user ? prisma.ticket.count({
        where: {
          assigneeId: user.id,
          status: { in: ['NEW', 'OPEN', 'PENDING'] }
        }
      }) : Promise.resolve(0)
    ])

    return {
      total: totalTickets,
      open: openTickets,
      pending: pendingTickets,
      solved: solvedTickets,
      onHold: onHoldTickets,
      unassigned: unassignedTickets,
      unsolved: unsolvedTickets,
      assigned: userAssignedTickets
    }
  } catch (error) {
    console.error('Get ticket stats error:', error)
    return {
      total: 0,
      open: 0,
      pending: 0,
      solved: 0,
      onHold: 0,
      unassigned: 0,
      unsolved: 0,
      assigned: 0
    }
  }
}