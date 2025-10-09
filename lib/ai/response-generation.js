import OpenAI from 'openai'
import { searchKnowledgeBase, recordKBUsage } from './knowledge-search.js'

// Lazy initialization of OpenAI client to avoid build errors when API key is missing
let openai = null
function getOpenAI() {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return openai
}

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

FORMATTING REQUIREMENTS (VERY IMPORTANT):
- Use Markdown formatting for better readability
- Use ## for main section headings (e.g., "## Step-by-Step Guide")
- Use ### for sub-headings (e.g., "### 1. Update the Flyer")
- Use **bold text** for emphasis on important terms or actions (e.g., "**Open your design software**")
- Use bullet points with - for lists
- Start with a friendly greeting using the requester's first name
- End with a professional signature: "Best regards,\\n\\nAiden"

Please generate a helpful response based on the available knowledge base information.`

    const client = getOpenAI()
    if (!client) {
      console.warn('OpenAI client not initialized (missing OPENAI_API_KEY)')
      return generateFallbackResponse(ticket)
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are Aiden, a knowledgeable IT support specialist. You have access to a knowledge base and should use that information to provide helpful, accurate solutions. Always maintain a friendly, professional tone and provide actionable advice. IMPORTANT: Format your responses using Markdown with ## for headings, ### for sub-headings, and **bold** for emphasis."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 500,
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
    // Use GPT-4o with web search capability to find solutions
    const prompt = `You are Aiden, a helpful IT helpdesk assistant for Surterre Properties. A support ticket has been created but no specific knowledge base articles were found to address this issue.

Ticket Details:
- Title: ${ticket.title}
- Description: ${ticket.description}
- Priority: ${ticket.priority}
- Category: ${ticket.category || 'General'}
- Requester: ${ticket.requester?.firstName} ${ticket.requester?.lastName}

Task:
1. Search the internet for accurate, up-to-date solutions to this technical issue
2. Provide specific, actionable troubleshooting steps based on current best practices
3. Include links to official documentation or trusted resources when relevant
4. If this is a common issue, provide the most reliable solution

Guidelines:
- Start with a friendly acknowledgment of their request
- Provide specific, step-by-step troubleshooting instructions
- Use current information from the internet to ensure accuracy
- Be professional and empathetic
- Include any relevant links to official documentation
- Keep response clear and well-structured

FORMATTING REQUIREMENTS (VERY IMPORTANT):
- Use Markdown formatting for better readability
- Use ## for main section headings (e.g., "## Troubleshooting Steps")
- Use ### for sub-headings or numbered steps (e.g., "### 1. Check Connections")
- Use **bold text** for emphasis on important terms or actions (e.g., "**Check the power cable**")
- Use bullet points with - for lists
- Use numbered lists (1., 2., 3.) for sequential steps
- Start with "Hello [FirstName],"
- End with "Best regards,\\n\\nAiden"

Please provide a comprehensive solution based on current internet knowledge and best practices.`

    const client = getOpenAI()
    if (!client) {
      console.warn('OpenAI client not initialized (missing OPENAI_API_KEY)')
      return generateFallbackResponse(ticket)
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are Aiden, a knowledgeable IT support specialist with access to current internet information. Use web search to find accurate, up-to-date solutions. Provide helpful, specific guidance with actionable steps. Always cite sources when providing technical solutions. IMPORTANT: Format your responses using Markdown with ## for headings, ### for sub-headings, and **bold** for emphasis."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 600,
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
                { title: { contains: term } },
                { description: { contains: term } }
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