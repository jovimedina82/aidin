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
    // Authentication check
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized access. Please log in.' },
        { status: 401 }
      )
    }

    const data = await request.json()

    // Set requesterId to current user if not provided
    const requesterId = data.requesterId || user.id

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

    // Generate ticket number
    const ticketCount = await prisma.ticket.count()
    const ticketNumber = `TICK-${(ticketCount + 1001).toString().padStart(4, '0')}`

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
        departmentId
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

          console.log(`AI response added to ticket ${ticket.ticketNumber}`)
        }
      } catch (error) {
        console.error('Failed to generate AI response:', error)
      }
    })

    return NextResponse.json(ticket, { status: 201 })
  } catch (error) {
    console.error('Error creating ticket:', error)
    return NextResponse.json(
      { error: 'Failed to create ticket' },
      { status: 500 }
    )
  }
}