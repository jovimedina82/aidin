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
import { emitTicketCreated, emitTicketUpdated, emitStatsUpdate } from '@/lib/socket'
import { logEvent } from '@/lib/audit'

// Utility function to strip HTML and convert to clean, well-formatted plain text
function stripHtml(html) {
  if (!html) return ''

  let text = String(html)

  // Remove script and style tags and their content
  text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')

  // Remove head section entirely (contains meta tags, styles, etc)
  text = text.replace(/<head\b[^<]*(?:(?!<\/head>)<[^<]*)*<\/head>/gi, '')

  // Extract link text before removing anchors (preserve readable links)
  // For Microsoft safe links, try to extract the actual URL
  text = text.replace(/<a[^>]+href="https:\/\/nam04\.safelinks\.protection\.outlook\.com\/\?url=([^&]+)[^"]*"[^>]*>([^<]*)<\/a>/gi, (match, encodedUrl, linkText) => {
    try {
      const decoded = decodeURIComponent(encodedUrl)
      return linkText || decoded
    } catch {
      return linkText || ''
    }
  })

  // For regular links, keep just the link text
  text = text.replace(/<a[^>]+>([^<]*)<\/a>/gi, '$1')

  // Replace inline images with a placeholder marker
  // This helps users know an image was present in the original email
  text = text.replace(/<img[^>]*>/gi, '\n[Image embedded in original email]\n')

  // Convert block-level elements to proper paragraph spacing
  // Paragraphs get double newlines for visual separation
  text = text.replace(/<\/p>/gi, '\n\n')
  text = text.replace(/<p[^>]*>/gi, '')

  // Divs get single newlines
  text = text.replace(/<\/div>/gi, '\n')
  text = text.replace(/<div[^>]*>/gi, '')

  // Headers get double newlines for emphasis
  text = text.replace(/<\/h[1-6]>/gi, '\n\n')
  text = text.replace(/<h[1-6][^>]*>/gi, '')

  // Line breaks
  text = text.replace(/<br[^>]*>/gi, '\n')

  // Lists - preserve bullet structure
  text = text.replace(/<\/li>/gi, '\n')
  text = text.replace(/<li[^>]*>/gi, '• ')
  text = text.replace(/<\/?[uo]l[^>]*>/gi, '\n')

  // Tables - try to preserve some structure
  text = text.replace(/<\/tr>/gi, '\n')
  text = text.replace(/<tr[^>]*>/gi, '')
  text = text.replace(/<\/td>/gi, ' ')
  text = text.replace(/<td[^>]*>/gi, '')
  text = text.replace(/<\/?table[^>]*>/gi, '\n')
  text = text.replace(/<\/?tbody[^>]*>/gi, '')

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '')

  // Decode HTML entities
  const entities = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&mdash;': '—',
    '&ndash;': '–',
    '&rsquo;': "'",
    '&lsquo;': "'",
    '&rdquo;': '"',
    '&ldquo;': '"',
    '&hellip;': '...',
    '&copy;': '©',
    '&reg;': '®',
    '&trade;': '™',
    '&bull;': '•'
  }

  Object.entries(entities).forEach(([entity, char]) => {
    text = text.replace(new RegExp(entity, 'gi'), char)
  })

  // Decode numeric entities (e.g., &#160;)
  text = text.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
  text = text.replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)))

  // Clean up whitespace while preserving paragraph structure
  // First, normalize line endings
  text = text.replace(/\r\n/g, '\n')
  text = text.replace(/\r/g, '\n')

  // Remove lines that are just whitespace
  text = text.replace(/^\s+$/gm, '')

  // Collapse more than 2 consecutive newlines to 2 (paragraph spacing)
  text = text.replace(/\n{3,}/g, '\n\n')

  // Trim whitespace from each line
  text = text.split('\n').map(line => line.trim()).join('\n')

  // Remove leading/trailing whitespace from the whole text
  text = text.trim()

  return text
}

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

    // Strip HTML from title and description early (important for email-based tickets)
    // This ensures clean data for AI processing, ticket creation, and comments
    if (data.title) {
      data.title = stripHtml(data.title)
    }
    if (data.description) {
      data.description = stripHtml(data.description)
    }

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
        const normalizedEmail = data.requesterEmail.toLowerCase()
        const emailParts = normalizedEmail.split('@')
        const firstName = emailParts[0].split('.')[0] || 'Unknown'
        const lastName = emailParts[0].split('.')[1] || 'User'

        const newUser = await prisma.user.create({
          data: {
            email: normalizedEmail,
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

    // Generate department-based ticket number with retry logic to avoid collisions
    const generateTicketNumber = async (departmentId) => {
      // Retry up to 10 times to find a unique ticket number
      for (let attempt = 0; attempt < 10; attempt++) {
        let ticketNumber

        if (!departmentId) {
          // Fallback for tickets without department
          const ticketCount = await prisma.ticket.count()
          const randomOffset = Math.floor(Math.random() * 100)
          ticketNumber = `GN${(ticketCount + randomOffset + 1).toString().padStart(6, '0')}`
        } else {
          // Get department name
          const department = await prisma.department.findUnique({
            where: { id: departmentId },
            select: { name: true }
          })

          if (!department) {
            // Fallback if department not found
            const ticketCount = await prisma.ticket.count()
            const randomOffset = Math.floor(Math.random() * 100)
            ticketNumber = `GN${(ticketCount + randomOffset + 1).toString().padStart(6, '0')}`
          } else {
            // Extract first two letters of department name
            const departmentPrefix = department.name
              .replace(/\s+/g, '') // Remove spaces
              .substring(0, 2)
              .toUpperCase()

            // Count tickets for this department to get next number
            const departmentTicketCount = await prisma.ticket.count({
              where: { departmentId }
            })

            const randomOffset = Math.floor(Math.random() * 100)
            ticketNumber = `${departmentPrefix}${(departmentTicketCount + randomOffset + 1).toString().padStart(6, '0')}`
          }
        }

        // Check if this ticket number already exists
        const existing = await prisma.ticket.findUnique({
          where: { ticketNumber }
        })

        if (!existing) {
          return ticketNumber
        }

        // If collision, wait a tiny bit and try again
        await new Promise(resolve => setTimeout(resolve, 50))
      }

      // Ultimate fallback: use timestamp + random
      const timestamp = Date.now()
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
      return `TICK-${timestamp}-${random}`
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

    // Process email attachments if messageId is provided
    if (data.emailMessageId || data.messageId) {
      setImmediate(async () => {
        try {
          const { EmailAttachmentHandler } = await import('@/lib/services/EmailAttachmentHandler')
          const handler = new EmailAttachmentHandler()

          const messageId = data.emailMessageId || data.messageId
          const attachments = await handler.processEmailAttachments(
            messageId,
            ticket.id,
            ticket.requesterId,
            data.userEmail || process.env.HELPDESK_EMAIL || 'helpdesk@surterreproperties.com'
          )

          if (attachments.length > 0) {
            console.log(`✅ Processed ${attachments.length} attachment(s) for ticket ${ticket.ticketNumber}`)
          }
        } catch (error) {
          console.error(`⚠️ Failed to process attachments for ticket ${ticket.ticketNumber}:`, error.message)
          // Don't fail ticket creation if attachments fail
        }
      })
    }

    // Log ticket creation to audit trail
    await logEvent({
      action: 'ticket.created',
      actorId: user?.id || 'system',
      actorEmail: user?.email || data.requesterEmail || 'system@surterreproperties.com',
      actorType: user ? 'human' : 'system',
      entityType: 'ticket',
      entityId: ticket.id,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || null,
      newValues: {
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.category,
        departmentId: ticket.departmentId,
        requesterId: ticket.requesterId,
        assigneeId: ticket.assigneeId
      },
      metadata: {
        source: isSystemRequest ? 'email' : 'web',
        hasEmailConversationId: !!data.emailConversationId,
        aiProcessed: !!aiDecisionData
      }
    })

    // Emit Socket.IO event for live updates
    emitTicketCreated(ticket)

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
          // Generate AI response with full ticket data
          const fullTicket = await prisma.ticket.findUnique({
            where: { id: ticket.id },
            include: {
              requester: true,
              assignee: true
            }
          })

          const aiResponse = await generateTicketResponse(fullTicket)

          // Save AI response as draft for staff review (don't auto-post or send email)
          await prisma.ticket.update({
            where: { id: ticket.id },
            data: {
              aiDraftResponse: aiResponse,
              aiDraftGeneratedAt: new Date(),
              aiDraftGeneratedBy: aiUser.id
            }
          })

          console.log(`✅ AI draft response generated for ticket ${ticket.ticketNumber}`)
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