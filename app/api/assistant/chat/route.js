import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getOpenAIClient } from '@/lib/openai'
import { prisma } from '@/lib/prisma'

export async function POST(request) {
  try {
    // Get authenticated user
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { message, ticket, conversationHistory } = await request.json()

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Get OpenAI client
    const openai = getOpenAIClient()
    if (!openai) {
      return NextResponse.json({
        response: "I'm sorry, the AI assistant is not available right now. Please contact your system administrator.",
        suggestions: ["Contact support", "Check documentation", "Try again later"]
      })
    }

    // Build context for the AI
    let context = `You are AidIN, a helpful virtual assistant for a helpdesk system. You help users solve technical problems and guide them through ticket resolution.

User Information:
- Name: ${user.firstName} ${user.lastName}
- Email: ${user.email}
- Role: ${user.userType}

`

    // Add ticket context if available
    if (ticket) {
      context += `Current Ticket Context:
- Ticket #: ${ticket.ticketNumber}
- Title: ${ticket.title}
- Description: ${ticket.description}
- Status: ${ticket.status}
- Priority: ${ticket.priority}
- Category: ${ticket.category || 'Not specified'}
- Created: ${new Date(ticket.createdAt).toLocaleDateString()}

`
    }

    // Enhanced Knowledge Base and Similar Ticket Lookup
    let relevantKB = []
    let similarResolvedTickets = []

    if (ticket || message) {
      const searchTerms = ticket ?
        `${ticket.title} ${ticket.description}` :
        message

      const keywords = searchTerms.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 3) // Only meaningful words
        .slice(0, 5) // Top 5 keywords

      try {
        // 1. Search Knowledge Base Articles
        relevantKB = await prisma.knowledgeBase.findMany({
          where: {
            OR: keywords.map(keyword => ({
              OR: [
                { title: { contains: keyword } },
                { content: { contains: keyword } },
                { tags: { contains: keyword } }
              ]
            })),
            isActive: true
          },
          take: 3,
          orderBy: { usageCount: 'desc' },
          select: {
            title: true,
            content: true,
            tags: true,
            usageCount: true
          }
        })

        // 2. Search Similar Resolved Tickets
        similarResolvedTickets = await prisma.ticket.findMany({
          where: {
            status: 'SOLVED',
            OR: keywords.map(keyword => ({
              OR: [
                { title: { contains: keyword } },
                { description: { contains: keyword } },
                { category: { contains: keyword } }
              ]
            }))
          },
          take: 3,
          orderBy: { resolvedAt: 'desc' },
          select: {
            ticketNumber: true,
            title: true,
            description: true,
            category: true,
            priority: true,
            resolvedAt: true,
            comments: {
              where: { isPublic: true },
              orderBy: { createdAt: 'desc' },
              take: 2,
              select: {
                content: true,
                createdAt: true,
                user: {
                  select: { firstName: true, lastName: true, userType: true }
                }
              }
            }
          }
        })

        // 3. If current ticket, also search for tickets with same category/priority
        if (ticket) {
          const categoryMatches = await prisma.ticket.findMany({
            where: {
              status: 'SOLVED',
              category: ticket.category,
              priority: ticket.priority,
              id: { not: ticket.id }
            },
            take: 2,
            orderBy: { resolvedAt: 'desc' },
            select: {
              ticketNumber: true,
              title: true,
              description: true,
              resolvedAt: true,
              comments: {
                where: { isPublic: true },
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: {
                  content: true,
                  user: { select: { firstName: true, lastName: true } }
                }
              }
            }
          })

          // Add category matches to similar tickets (avoid duplicates)
          const existingTicketNumbers = new Set(similarResolvedTickets.map(t => t.ticketNumber))
          categoryMatches.forEach(ticket => {
            if (!existingTicketNumbers.has(ticket.ticketNumber)) {
              similarResolvedTickets.push(ticket)
            }
          })
        }

      } catch (error) {
        console.error('Enhanced KB search error:', error)
      }
    }

    // Add Knowledge Base Articles to context
    if (relevantKB.length > 0) {
      context += `📚 Relevant Knowledge Base Articles:
${relevantKB.map((kb, index) =>
  `${index + 1}. ${kb.title}\n   ${kb.content.substring(0, 200)}...\n   Usage: ${kb.usageCount} times`
).join('\n')}

`
    }

    // Add Similar Resolved Tickets to context
    if (similarResolvedTickets.length > 0) {
      context += `🎫 Similar Resolved Tickets:
${similarResolvedTickets.map((ticket, index) => {
  const lastComment = ticket.comments?.[0]
  const resolution = lastComment ?
    `\n   Resolution: ${lastComment.content.substring(0, 150)}... - ${lastComment.user.firstName} ${lastComment.user.lastName}` :
    ''

  return `${index + 1}. Ticket #${ticket.ticketNumber}: ${ticket.title}
   Description: ${ticket.description.substring(0, 100)}...
   Category: ${ticket.category || 'N/A'} | Priority: ${ticket.priority}
   Resolved: ${new Date(ticket.resolvedAt).toLocaleDateString()}${resolution}`
}).join('\n')}

`
    }

    context += `Guidelines:
- PRIORITIZE knowledge base articles and similar resolved tickets above all else
- If you found similar resolved tickets, reference them specifically with ticket numbers
- Quote solutions and resolutions from the similar tickets when applicable
- Use knowledge base articles as primary sources of truth
- If no KB/similar tickets match, then provide general AI guidance
- Be helpful, friendly, and professional
- Provide specific, actionable advice based on the resolved tickets
- Always mention ticket numbers when referencing similar cases
- Keep responses concise but thorough
- Suggest practical next steps based on past successful resolutions

${similarResolvedTickets.length > 0 ?
  `IMPORTANT: You found ${similarResolvedTickets.length} similar resolved tickets. Base your response primarily on these solutions.` :
  ''}

User's question: ${message}`

    // Build conversation history for context
    const conversationMessages = [
      {
        role: 'system',
        content: context
      }
    ]

    // Add recent conversation history
    if (conversationHistory && conversationHistory.length > 0) {
      conversationHistory.slice(-4).forEach(msg => {
        if (msg.type === 'user') {
          conversationMessages.push({
            role: 'user',
            content: msg.content
          })
        } else if (msg.type === 'assistant') {
          conversationMessages.push({
            role: 'assistant',
            content: msg.content
          })
        }
      })
    }

    // Add current message
    conversationMessages.push({
      role: 'user',
      content: message
    })

    // Get AI response
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: conversationMessages,
      max_tokens: 500,
      temperature: 0.7,
      presence_penalty: 0.1,
      frequency_penalty: 0.1
    })

    let aiResponse = completion.choices[0]?.message?.content ||
      "I'm sorry, I couldn't generate a response. Please try again."

    // Generate enhanced suggestions based on knowledge base and similar tickets
    let suggestions = []

    // Priority 1: Suggestions from similar resolved tickets
    if (similarResolvedTickets.length > 0) {
      similarResolvedTickets.slice(0, 2).forEach(resolvedTicket => {
        suggestions.push(`View Ticket #${resolvedTicket.ticketNumber}`)
      })
      suggestions.push('Apply similar solution')
    }

    // Priority 2: Suggestions from knowledge base
    if (relevantKB.length > 0) {
      suggestions.push('Check knowledge base')
      if (relevantKB[0].title) {
        suggestions.push(`Review: ${relevantKB[0].title.substring(0, 30)}...`)
      }
    }

    // Priority 3: Context-based suggestions
    if (ticket) {
      switch (ticket.status) {
        case 'NEW':
          if (!similarResolvedTickets.length) {
            suggestions.push('Search similar tickets', 'Assign to specialist', 'Set priority level')
          }
          break
        case 'OPEN':
          suggestions.push('Add progress comment', 'Request more info', 'Update status')
          break
        case 'PENDING':
          suggestions.push('Follow up with user', 'Check for updates', 'Apply known solution')
          break
        case 'ON_HOLD':
          suggestions.push('Resume ticket', 'Check dependencies', 'Review similar cases')
          break
        default:
          suggestions.push('View ticket history', 'Check similar tickets', 'Add to knowledge base')
      }
    } else {
      // General suggestions based on message content
      const lowerMessage = message.toLowerCase()
      if (lowerMessage.includes('password') || lowerMessage.includes('login')) {
        if (!similarResolvedTickets.length) {
          suggestions.push('Reset password', 'Check account status', 'Verify credentials')
        }
      } else if (lowerMessage.includes('email') || lowerMessage.includes('mail')) {
        if (!similarResolvedTickets.length) {
          suggestions.push('Check email settings', 'Verify server status', 'Test connectivity')
        }
      } else if (lowerMessage.includes('printer') || lowerMessage.includes('print')) {
        if (!similarResolvedTickets.length) {
          suggestions.push('Check printer status', 'Update drivers', 'Clear print queue')
        }
      } else {
        if (!similarResolvedTickets.length && !relevantKB.length) {
          suggestions.push('Create new ticket', 'Search knowledge base', 'Contact specialist')
        }
      }
    }

    // Ensure we have at least one suggestion
    if (suggestions.length === 0) {
      suggestions = ['Search knowledge base', 'Check similar tickets', 'Get help']
    }

    // Update usage count for relevant knowledge base articles
    if (relevantKB.length > 0) {
      try {
        await Promise.all(relevantKB.map(kb =>
          prisma.knowledgeBase.updateMany({
            where: { title: kb.title },
            data: { usageCount: { increment: 1 } }
          })
        ))
      } catch (error) {
        console.error('Error updating KB usage:', error)
      }
    }

    return NextResponse.json({
      response: aiResponse,
      suggestions: suggestions.slice(0, 3), // Limit to 3 suggestions
      timestamp: new Date().toISOString(),
      foundSimilarTickets: similarResolvedTickets.length,
      foundKnowledgeBase: relevantKB.length
    })

  } catch (error) {
    console.error('Assistant API error:', error)
    return NextResponse.json({
      response: "I'm experiencing some technical difficulties. Please try again in a moment, or contact support if the issue persists.",
      suggestions: ["Try again", "Contact support", "Check system status"],
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 })
  }
}