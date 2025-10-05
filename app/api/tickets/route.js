import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import {
  ApiError,
  ApiSuccess,
  withErrorHandler,
  parseQueryParams,
  buildWhereClause,
  validateRequired
} from '@/lib/api-utils'
import { QueryOptimizations, PerformanceMonitor } from '@/lib/performance'
import { generateTicketResponse, categorizeTicket, processTicketWithAI } from '@/lib/openai'
import { buildTicketAccessWhere } from '@/lib/access-control'

export const GET = withErrorHandler(async (request) => {
  PerformanceMonitor.start('tickets-fetch')

  const user = await getCurrentUser(request)
  if (!user) {
    throw new Error('UNAUTHORIZED')
  }

  const { searchParams } = new URL(request.url)

  // Parse query parameters with defaults
  const params = parseQueryParams(searchParams, {
    limit: 100,
    page: 1,
    sortBy: 'createdAt',
    sortOrder: 'desc',
    unassigned: false
  })

  const statuses = searchParams.getAll('status')
  const excludeStatuses = searchParams.getAll('excludeStatus')
  const priority = searchParams.get('priority')
  const assigneeId = searchParams.get('assigneeId')

  // Build where clause with access control
  const accessWhere = await buildTicketAccessWhere(user)
  const where = { ...accessWhere }

  // Handle status filters
  if (statuses.length > 0) {
    where.status = { in: statuses }
  } else if (excludeStatuses.length > 0) {
    where.status = { notIn: excludeStatuses }
  }

  if (priority) where.priority = priority

  // Handle assignee filtering
  if (params.unassigned) {
    where.assigneeId = null
  } else if (assigneeId) {
    where.assigneeId = assigneeId
  }

  // Build orderBy clause
  let orderBy = {}
  switch (params.sortBy) {
    case 'priority':
      orderBy = [
        { priority: params.sortOrder },
        { createdAt: 'desc' }
      ]
      break
    case 'requester':
      orderBy = [
        { requester: { firstName: params.sortOrder } },
        { requester: { lastName: params.sortOrder } },
        { createdAt: 'desc' }
      ]
      break
    default:
      orderBy[params.sortBy] = params.sortOrder
  }

  // Use optimized select for better performance
  const tickets = await prisma.ticket.findMany({
    where,
    select: {
      ...QueryOptimizations.ticketSelect,
      requester: {
        select: QueryOptimizations.userSelect
      },
      assignee: {
        select: QueryOptimizations.userSelect
      },
      _count: {
        select: {
          comments: true
        }
      }
    },
    orderBy,
    take: params.limit,
    skip: (params.page - 1) * params.limit
  })

  // Get total count for pagination
  const total = await prisma.ticket.count({ where })

  PerformanceMonitor.end('tickets-fetch')

  return ApiSuccess.ok({
    tickets,
    pagination: {
      total,
      page: params.page,
      limit: params.limit,
      hasMore: (params.page * params.limit) < total
    }
  })
})

export async function POST(request) {
  try {
    // Authentication check (allow n8n/system with basic auth OR logged-in user)
    const authHeader = request.headers.get('authorization')
    const isSystemRequest = authHeader?.includes('Basic')

    const user = await getCurrentUser(request)
    if (!user && !isSystemRequest) {
      return NextResponse.json(
        { error: 'Unauthorized access. Please log in.' },
        { status: 401 }
      )
    }

    const data = await request.json()

    // Check if this is a reply to an existing email thread
    if (data.emailConversationId) {
      const existingTicket = await prisma.ticket.findFirst({
        where: {
          emailConversationId: data.emailConversationId
        }
      })

      if (existingTicket) {
        // This is a reply - add as comment instead of creating new ticket
        const requester = await prisma.user.findFirst({
          where: {
            email: data.requesterEmail?.toLowerCase()
          }
        })

        if (requester) {
          await prisma.ticketComment.create({
            data: {
              ticketId: existingTicket.id,
              userId: requester.id,
              content: data.description || data.title,
              isPublic: true
            }
          })

          return NextResponse.json({
            success: true,
            message: 'Reply added to existing ticket',
            ticketId: existingTicket.id,
            ticketNumber: existingTicket.ticketNumber,
            action: 'comment_added'
          })
        }
      }
    }

    // Handle email-based ticket creation (from n8n)
    let requesterId = data.requesterId || user?.id

    if (data.requesterEmail && !requesterId) {
      // Find user by email (case-insensitive)
      const requester = await prisma.user.findFirst({
        where: {
          email: data.requesterEmail.toLowerCase()
        }
      })

      if (requester) {
        requesterId = requester.id
      } else {
        // Create new user from email if not exists
        const emailParts = data.requesterEmail.split('@')
        const firstName = emailParts[0].split('.')[0] || 'Unknown'
        const lastName = emailParts[0].split('.')[1] || 'User'

        const newUser = await prisma.user.create({
          data: {
            email: data.requesterEmail,
            firstName: firstName.charAt(0).toUpperCase() + firstName.slice(1),
            lastName: lastName ? lastName.charAt(0).toUpperCase() + lastName.slice(1) : '',
            password: Math.random().toString(36).slice(-12), // Random temp password
            userType: 'REQUESTER',
            isActive: true
          }
        })

        requesterId = newUser.id
      }
    }

    if (!requesterId) {
      return NextResponse.json(
        { error: 'Could not determine ticket requester' },
        { status: 400 }
      )
    }

    // Enhanced AI processing with routing and categorization
    let category = data.category
    let priority = data.priority || 'NORMAL'
    let departmentId = data.departmentId
    let aiDecisionData = null

    if (!category || !departmentId) {
      try {
        const aiProcessing = await processTicketWithAI(data.title, data.description, requesterId)

        // Use AI results if not manually specified
        if (!category) {
          category = aiProcessing.category
        }
        if (!data.priority) {
          priority = aiProcessing.priority
        }
        if (!departmentId) {
          departmentId = aiProcessing.departmentId
        }

        // Store AI decision data for later insertion
        aiDecisionData = {
          suggestedDepartment: aiProcessing.departmentId,
          departmentConfidence: aiProcessing.departmentConfidence,
          keywordMatches: JSON.stringify(aiProcessing.keywordMatches),
          aiReasoning: aiProcessing.aiReasoning,
          finalDepartment: aiProcessing.departmentId,
          wasOverridden: false
        }

      } catch (error) {
        console.error('AI processing failed, using defaults:', error)
        category = category || 'General Question'
        priority = priority || 'NORMAL'
      }
    }

    // Generate department-based ticket number
    const generateTicketNumber = async (departmentId) => {
      if (!departmentId) {
        // Fallback for tickets without department
        const ticketCount = await prisma.ticket.count()
        return `GN${(ticketCount + 1).toString().padStart(6, '0')}`
      }

      // Get department name
      const department = await prisma.department.findUnique({
        where: { id: departmentId },
        select: { name: true }
      })

      if (!department) {
        // Fallback if department not found
        const ticketCount = await prisma.ticket.count()
        return `GN${(ticketCount + 1).toString().padStart(6, '0')}`
      }

      // Extract first two letters of department name
      const departmentPrefix = department.name
        .replace(/\s+/g, '') // Remove spaces
        .substring(0, 2)
        .toUpperCase()

      // Count tickets for this department to get next number
      const departmentTicketCount = await prisma.ticket.count({
        where: { departmentId }
      })

      return `${departmentPrefix}${(departmentTicketCount + 1).toString().padStart(6, '0')}`
    }

    const ticketNumber = await generateTicketNumber(departmentId)

    // NEW tickets should always be unassigned
    const finalStatus = data.status || 'NEW'
    const finalAssigneeId = finalStatus === 'NEW' ? null : data.assigneeId

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        title: data.title,
        description: data.description,
        status: finalStatus,
        priority,
        category,
        requesterId: requesterId,
        assigneeId: finalAssigneeId,
        departmentId,
        emailConversationId: data.emailConversationId || null
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
        }
      }
    })

    // Store AI decision data if available
    if (aiDecisionData) {
      try {
        await prisma.aIDecision.create({
          data: {
            ticketId: ticket.id,
            ...aiDecisionData
          }
        })
      } catch (error) {
        console.error('Error storing AI decision data:', error)
      }
    }

    // Trigger N8N webhook for new ticket (don't wait for it)
    setImmediate(async () => {
      try {
        // Send webhook to N8N if running
        await fetch('http://localhost:5678/webhook/new-ticket', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            event: 'ticket.created',
            timestamp: new Date().toISOString(),
            data: {
              id: ticket.id,
              ticketNumber: ticket.ticketNumber,
              title: ticket.title,
              description: ticket.description,
              status: ticket.status,
              priority: ticket.priority,
              category: ticket.category,
              requesterId: ticket.requesterId,
              assigneeId: ticket.assigneeId,
              departmentId: ticket.departmentId,
              createdAt: ticket.createdAt
            }
          })
        })

        if (process.env.NODE_ENV === 'development') {
          console.log(`N8N webhook triggered for ticket ${ticket.ticketNumber}`)
        }
      } catch (error) {
        // Don't fail ticket creation if webhook fails
        if (process.env.NODE_ENV === 'development') {
          console.warn('N8N webhook failed (this is normal if N8N is not running):', error.message)
        }
      }
    })

    // Generate AI response in background (don't wait for it)
    setImmediate(async () => {
      try {
        // Find the AI assistant user
        const aiUser = await prisma.user.findFirst({
          where: {
            email: 'ai-assistant@surterre.local'
          }
        })

        if (aiUser) {
          // Generate AI response
          const aiResponse = await generateTicketResponse(ticket)

          // Add AI comment to ticket
          await prisma.ticketComment.create({
            data: {
              ticketId: ticket.id,
              userId: aiUser.id,
              content: aiResponse,
              isPublic: true
            }
          })

          if (process.env.NODE_ENV === 'development') {
            console.log(`AI response added to ticket ${ticket.ticketNumber}`)
          }

          // If ticket was created from email, send AI response via email
          if (ticket.emailConversationId) {
            try {
              await fetch('http://localhost:5678/webhook/send-ai-response', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  ticketId: ticket.id,
                  ticketNumber: ticket.ticketNumber,
                  aiResponse: aiResponse
                })
              })
              console.log(`Triggered email send for AI response on ticket ${ticket.ticketNumber}`)
            } catch (webhookError) {
              console.warn('Failed to trigger AI email webhook:', webhookError.message)
            }
          }
        }
      } catch (error) {
        console.error('Failed to generate AI response:', error)
      }
    })

    return NextResponse.json(ticket, { status: 201 })
  } catch (error) {
    console.error('Error creating ticket:', error)
    return NextResponse.json(
      { error: 'Failed to create ticket', details: error.message },
      { status: 500 }
    )
  }
}