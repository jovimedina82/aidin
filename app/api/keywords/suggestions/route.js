import { NextResponse } from 'next/server'
import { PrismaClient } from '@/lib/generated/prisma/index.js'
import OpenAI from 'openai'

const prisma = new PrismaClient()

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

// Force this route to be dynamic (not cached)
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(request) {
  try {
    const { departmentId } = await request.json()

    if (!departmentId) {
      return NextResponse.json({
        success: false,
        error: 'Department ID is required'
      }, { status: 400 })
    }

    // Get department
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      include: {
        keywords: {
          where: { isActive: true },
          select: { keyword: true }
        }
      }
    })

    if (!department) {
      return NextResponse.json({
        success: false,
        error: 'Department not found'
      }, { status: 404 })
    }

    // Get recent tickets from this department (last 100)
    const tickets = await prisma.ticket.findMany({
      where: {
        departmentId: departmentId
      },
      select: {
        title: true,
        description: true,
        category: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 100
    })

    if (tickets.length === 0) {
      return NextResponse.json({
        success: true,
        suggestions: [],
        message: 'No tickets found for this department'
      })
    }

    // Prepare existing keywords list
    const existingKeywords = department.keywords.map(k => k.keyword)

    // Analyze tickets with AI to suggest new keywords
    const ticketSummary = tickets.map(t =>
      `Title: ${t.title}\nDescription: ${t.description.substring(0, 200)}...\nCategory: ${t.category || 'N/A'}`
    ).join('\n\n---\n\n')

    const prompt = `You are a keyword extraction specialist for a helpdesk system. Analyze these support tickets from the ${department.name} department and suggest NEW keywords that would help route similar tickets in the future.

EXISTING KEYWORDS (do NOT suggest these):
${existingKeywords.join(', ')}

RECENT TICKETS:
${ticketSummary.substring(0, 8000)}

INSTRUCTIONS:
1. Identify common themes, technical terms, and user pain points across tickets
2. Extract keywords that are:
   - NOT already in the existing keywords list
   - Specific and actionable (avoid generic terms like "help", "issue", "problem")
   - Technical terms users actually use (e.g., "Outlook", "password reset", "printer jam")
   - Both technical jargon AND user-friendly descriptions
   - Relevant to ${department.name} department
3. Include variations users might use (e.g., "login", "sign in", "sign-in")
4. Suggest 10-20 new keywords maximum
5. Rate each keyword's importance with a weight between 0.5 and 2.0

Respond with JSON only:
{
  "suggestions": [
    {
      "keyword": "keyword phrase",
      "weight": 1.0,
      "reasoning": "Brief explanation of why this keyword is useful"
    }
  ]
}`

    const client = getOpenAI()
    if (!client) {
      console.warn('OpenAI client not initialized (missing OPENAI_API_KEY)')
      return NextResponse.json({
        success: false,
        error: 'AI service not available'
      }, { status: 503 })
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a keyword extraction specialist. Analyze support tickets and suggest useful keywords for automatic ticket routing. Always respond with valid JSON only."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
      temperature: 0.3,
    })

    try {
      const result = JSON.parse(completion.choices[0].message.content.trim())
      const suggestions = result.suggestions || []

      return NextResponse.json({
        success: true,
        departmentName: department.name,
        ticketsAnalyzed: tickets.length,
        existingKeywordsCount: existingKeywords.length,
        suggestions: suggestions
      })

    } catch (parseError) {
      console.error('Error parsing AI keyword suggestions:', parseError)
      return NextResponse.json({
        success: false,
        error: 'Failed to parse AI response'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Error generating keyword suggestions:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to generate keyword suggestions'
    }, { status: 500 })
  }
}
