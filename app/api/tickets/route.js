import { NextResponse } from 'next/server'
import { PrismaClient } from '../../../lib/generated/prisma/index.js'
import { generateTicketResponse, categorizeTicket, processTicketWithAI } from '../../../lib/openai.js'

const prisma = new PrismaClient()

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')) : undefined
    const statuses = searchParams.getAll('status')
    const excludeStatuses = searchParams.getAll('excludeStatus')
    const priority = searchParams.get('priority')
    const assigneeId = searchParams.get('assigneeId')
    const unassigned = searchParams.get('unassigned')
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    const where = {}

    // Handle multiple status filters
    if (statuses.length > 0) {
      where.status = { in: statuses }
    } else if (excludeStatuses.length > 0) {
      where.status = { notIn: excludeStatuses }
    }

    if (priority) where.priority = priority

    // Handle assignee filtering
    if (unassigned === 'true') {
      where.assigneeId = null
    } else if (assigneeId) {
      where.assigneeId = assigneeId
    }

    // Build orderBy clause
    let orderBy = {}

    // Handle priority sorting with custom order (URGENT > HIGH > NORMAL > LOW)
    if (sortBy === 'priority') {
      // For priority, we need to use a raw query to sort properly
      // Since Prisma sorts enums alphabetically, we'll add a secondary sort by createdAt
      orderBy = [
        { priority: sortOrder },
        { createdAt: 'desc' } // Secondary sort for consistent ordering
      ]
    } else if (sortBy === 'requester') {
      // Sort by requester's first name then last name
      orderBy = [
        { requester: { firstName: sortOrder } },
        { requester: { lastName: sortOrder } },
        { createdAt: 'desc' } // Tertiary sort for consistent ordering
      ]
    } else {
      orderBy[sortBy] = sortOrder
    }

    console.log('Tickets API - Query params:', { sortBy, sortOrder, statuses, excludeStatuses, unassigned })
    console.log('Tickets API - Where clause:', JSON.stringify(where, null, 2))
    console.log('Tickets API - OrderBy clause:', JSON.stringify(orderBy, null, 2))

    const tickets = await prisma.ticket.findMany({
      where,
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
            createdAt: 'desc'
          }
        }
      },
      orderBy,
      take: limit
    })

    return NextResponse.json({ tickets })
  } catch (error) {
    console.error('Error fetching tickets:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tickets' },
      { status: 500 }
    )
  }
}

export async function POST(request) {
  try {
    const data = await request.json()

    // Enhanced AI processing with routing and categorization
    let category = data.category
    let priority = data.priority || 'NORMAL'
    let departmentId = data.departmentId
    let aiDecisionData = null

    if (!category || !departmentId) {
      try {
        const aiProcessing = await processTicketWithAI(data.title, data.description, data.requesterId)

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
        requesterId: data.requesterId,
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