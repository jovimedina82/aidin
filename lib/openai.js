import OpenAI from 'openai'
import { routeTicketToDepartment } from './ai/routing.js'
import { enhancedCategorizeTicket } from './ai/categorization.js'
import { generateEnhancedTicketResponse } from './ai/response-generation.js'
import { prisma } from './prisma.js'

// Lazy initialization of OpenAI client to avoid build errors when API key is missing
let openai = null

export function getOpenAIClient() {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return openai
}

export async function generateTicketResponse(ticket) {
  try {
    // Use the enhanced response generation that includes KB search
    return await generateEnhancedTicketResponse(ticket)
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error generating enhanced AI response:', error)
    }

    // Fallback response if enhanced service fails
    return `Dear ${ticket.requester?.firstName || 'Customer'},

Thank you for reaching out with your ${ticket.title.toLowerCase()} inquiry. I've received your ticket and will review the details you've provided.

I'll investigate this issue and get back to you with a solution or additional questions if needed. In the meantime, if this is urgent, please don't hesitate to reach out.

Best regards,
Aiden
IT Support Specialist`
  }
}

export async function categorizeTicket(title, description, departmentName = null) {
  try {
    // Use the enhanced categorization service
    const result = await enhancedCategorizeTicket(title, description, departmentName)
    return {
      category: result.category,
      priority: result.priority
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error with enhanced categorization:', error)
    }
    return {
      category: 'General Question',
      priority: 'NORMAL'
    }
  }
}

// New function for complete ticket processing with AI routing
export async function processTicketWithAI(title, description, requesterId) {
  try {
    // Step 1: Route to department
    const routingResult = await routeTicketToDepartment(title, description)

    // Step 2: Get department name for enhanced categorization
    let departmentName = null
    if (routingResult.departmentId) {
      const department = await prisma.department.findUnique({
        where: { id: routingResult.departmentId }
      })
      departmentName = department?.name
    }

    // Step 3: Enhanced categorization
    const categorizationResult = await enhancedCategorizeTicket(title, description, departmentName)

    return {
      departmentId: routingResult.departmentId,
      departmentConfidence: routingResult.confidence,
      routingMethod: routingResult.method,
      keywordMatches: routingResult.keywordMatches,
      aiReasoning: routingResult.reasoning,
      category: categorizationResult.category,
      priority: categorizationResult.priority,
      categorizationConfidence: categorizationResult.confidence
    }

  } catch (error) {
    console.error('Error processing ticket with AI:', error)
    return {
      departmentId: null,
      departmentConfidence: 0,
      routingMethod: 'error',
      keywordMatches: [],
      aiReasoning: 'Error occurred during processing',
      category: 'General Question',
      priority: 'NORMAL',
      categorizationConfidence: 0.3
    }
  }
}