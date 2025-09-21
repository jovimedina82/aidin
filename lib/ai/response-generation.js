import OpenAI from 'openai'
import { searchKnowledgeBase, recordKBUsage } from './knowledge-search.js'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function generateEnhancedTicketResponse(ticket) {
  try {
    // Step 1: Search knowledge base for relevant articles
    const query = `${ticket.title} ${ticket.description}`
    const relevantKB = await searchKnowledgeBase(query, ticket.departmentId, 3)

    // Step 2: Generate response based on KB results
    if (relevantKB.length > 0) {
      return await generateKBBasedResponse(ticket, relevantKB)
    } else {
      return await generateGeneralResponse(ticket)
    }

  } catch (error) {
    console.error('Error generating enhanced ticket response:', error)
    return generateFallbackResponse(ticket)
  }
}

async function generateKBBasedResponse(ticket, relevantKB) {
  try {
    // Prepare KB content for AI
    const kbContent = relevantKB.map((article, index) =>
      `[KB Article ${index + 1}] ${article.title}\n${article.content}`
    ).join('\n\n')

    const prompt = `You are Aiden, a helpful IT helpdesk assistant for Surterre Properties. A support ticket has been created and you have access to relevant knowledge base articles to help provide a solution.

Ticket Details:
- Title: ${ticket.title}
- Description: ${ticket.description}
- Priority: ${ticket.priority}
- Category: ${ticket.category || 'General'}
- Requester: ${ticket.requester?.firstName} ${ticket.requester?.lastName}

Relevant Knowledge Base Articles:
${kbContent}

Guidelines:
- Use the knowledge base articles to provide a helpful, specific solution
- Reference the steps or information from the KB articles but rewrite them in a conversational, friendly tone
- If the KB articles don't fully address the issue, combine them with your general knowledge
- Be professional and empathetic
- Provide clear, actionable steps when applicable
- Keep the response concise but thorough
- If you reference KB content, make it natural and conversational

Please generate a helpful response based on the available knowledge base information.`

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are Aiden, a knowledgeable IT support specialist. You have access to a knowledge base and should use that information to provide helpful, accurate solutions. Always maintain a friendly, professional tone and provide actionable advice."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 400,
      temperature: 0.7,
    })

    const response = completion.choices[0].message.content.trim()

    // Record KB usage for all relevant articles
    for (const article of relevantKB) {
      await recordKBUsage(ticket.id, article.id, article.similarity, true)
    }

    return response

  } catch (error) {
    console.error('Error generating KB-based response:', error)
    return generateGeneralResponse(ticket)
  }
}

async function generateGeneralResponse(ticket) {
  try {
    const prompt = `You are Aiden, a helpful IT helpdesk assistant for Surterre Properties. A support ticket has been created but no specific knowledge base articles were found to address this issue.

Ticket Details:
- Title: ${ticket.title}
- Description: ${ticket.description}
- Priority: ${ticket.priority}
- Category: ${ticket.category || 'General'}
- Requester: ${ticket.requester?.firstName} ${ticket.requester?.lastName}

Guidelines:
- Acknowledge that you've received their request
- Provide general troubleshooting steps if applicable
- Let them know you're investigating the issue
- Be professional and empathetic
- Mention that you may follow up with additional questions or solutions
- Keep response concise but helpful

Since no specific knowledge base articles match this issue, provide a general helpful response and mention that you're looking into it further.`

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are Aiden, a knowledgeable IT support specialist. When specific solutions aren't available in the knowledge base, provide helpful general guidance and assure the user you're investigating their issue."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 300,
      temperature: 0.7,
    })

    return completion.choices[0].message.content.trim()

  } catch (error) {
    console.error('Error generating general response:', error)
    return generateFallbackResponse(ticket)
  }
}

function generateFallbackResponse(ticket) {
  const firstName = ticket.requester?.firstName || 'Customer'

  return `Dear ${firstName},

Thank you for reaching out regarding "${ticket.title}". I've received your ticket and will review the details you've provided.

I'll investigate this issue and get back to you with a solution or additional questions if needed. In the meantime, if this is urgent, please don't hesitate to reach out.

Best regards,
Aiden
IT Support Specialist`
}

export async function findSimilarTickets(ticketTitle, ticketDescription, limit = 3) {
  try {
    // This could be enhanced with embeddings for better similarity matching
    // For now, using simple text search
    const searchTerms = `${ticketTitle} ${ticketDescription}`.toLowerCase()
      .split(' ')
      .filter(word => word.length > 3) // Filter out short words
      .slice(0, 10) // Limit search terms

    if (searchTerms.length === 0) return []

    // Search for similar tickets (this is a simple implementation)
    // In production, you'd want to use embeddings for better similarity matching
    const { PrismaClient } = await import('../generated/prisma/index.js')
    const prisma = new PrismaClient()

    const similarTickets = await prisma.ticket.findMany({
      where: {
        AND: [
          { status: 'SOLVED' }, // Only look at solved tickets
          {
            OR: searchTerms.map(term => ({
              OR: [
                { title: { contains: term, mode: 'insensitive' } },
                { description: { contains: term, mode: 'insensitive' } }
              ]
            }))
          }
        ]
      },
      include: {
        requester: {
          select: { firstName: true, lastName: true }
        },
        comments: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { resolvedAt: 'desc' },
      take: limit
    })

    return similarTickets

  } catch (error) {
    console.error('Error finding similar tickets:', error)
    return []
  }
}