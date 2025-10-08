/**
 * OpenAI Provider Implementation
 * Phase 5: Real OpenAI integration
 */

import OpenAI from 'openai'
import type {
  Provider,
  ClassifyInput,
  ClassifyOptions,
  ClassifyResult,
  RespondInput,
  RespondOptions,
  RespondResult,
  LLMProvider,
} from '../domain'

/**
 * Create OpenAI provider instance
 */
export function openaiProvider(config: {
  apiKey: string
  classifyModel?: string
  respondModel?: string
}): Provider {
  const openai = new OpenAI({
    apiKey: config.apiKey,
  })

  const classifyModel = config.classifyModel || 'gpt-4o-mini'
  const respondModel = config.respondModel || 'gpt-4o-mini'

  return {
    name: 'openai',

    async classify(input: ClassifyInput, opts?: ClassifyOptions): Promise<ClassifyResult> {
      try {
        const prompt = buildClassifyPrompt(input)
        const model = opts?.model || classifyModel
        const temperature = opts?.temperature ?? 0.2
        const maxTokens = opts?.maxTokens || 250

        const completion = await openai.chat.completions.create({
          model,
          messages: [
            {
              role: 'system',
              content:
                'You are an expert ticket categorization system. Create concise, reusable category names that help organize support tickets effectively. Always respond with valid JSON only.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          response_format: { type: 'json_object' },
          max_tokens: maxTokens,
          temperature,
        })

        const content = completion.choices[0].message.content?.trim()
        if (!content) {
          throw new Error('Empty response from OpenAI')
        }

        const result = JSON.parse(content)

        // Validate and sanitize
        const validPriority = ['URGENT', 'HIGH', 'NORMAL', 'LOW'].includes(result.priority)
          ? result.priority
          : 'NORMAL'

        const confidence = Math.min(Math.max(result.confidence || 0.5, 0), 1)

        const category = result.category ? result.category.trim().substring(0, 50) : 'General'

        return {
          category,
          confidence,
          reasoning: result.reasoning || 'Automated categorization completed',
        }
      } catch (error) {
        console.error('OpenAI classify error:', error)

        // Fallback response
        return {
          category: 'General',
          confidence: 0.3,
          reasoning: 'AI service error, using fallback',
        }
      }
    },

    async respond(input: RespondInput, opts?: RespondOptions): Promise<RespondResult> {
      try {
        const prompt = buildRespondPrompt(input, opts)
        const model = opts?.model || respondModel
        const temperature = opts?.temperature ?? 0.7
        const maxTokens = opts?.maxTokens || 500

        const completion = await openai.chat.completions.create({
          model,
          messages: [
            {
              role: 'system',
              content:
                'You are Aiden, a knowledgeable IT support specialist. Provide helpful, accurate solutions with a friendly, professional tone. IMPORTANT: Format your responses using Markdown with ## for headings, ### for sub-headings, and **bold** for emphasis.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: maxTokens,
          temperature,
        })

        const response = completion.choices[0].message.content?.trim()
        if (!response) {
          throw new Error('Empty response from OpenAI')
        }

        return {
          response,
          confidence: 0.8,
          reasoning: 'AI-generated response',
        }
      } catch (error) {
        console.error('OpenAI respond error:', error)

        // Fallback response
        return {
          response: `Thank you for reaching out regarding "${input.ticketTitle}". I've received your ticket and will review the details you've provided.\n\nI'll investigate this issue and get back to you with a solution or additional questions if needed.\n\nBest regards,\nAiden`,
          confidence: 0.3,
          reasoning: 'AI service error, using fallback',
        }
      }
    },
  }
}

/**
 * Build prompt for ticket classification
 */
function buildClassifyPrompt(input: ClassifyInput): string {
  return `You are an expert support ticket categorization system. Analyze this ticket and create or assign a descriptive category.

TICKET SUBJECT: ${input.title}

TICKET BODY:
${input.description}

INSTRUCTIONS:
1. Read the full ticket carefully - understand what the user actually needs
2. Create a SHORT, DESCRIPTIVE category name (1-3 words) that describes this type of request
3. Categories should be:
   - Specific enough to be useful (e.g., "Software", "Forms", "Printing", "Email Setup")
   - Reusable for similar tickets
   - Professional and clear
4. Set priority based on business impact:
   - URGENT: System down, security issue, critical business impact
   - HIGH: Significant productivity impact, time-sensitive
   - NORMAL: Standard requests, non-urgent issues
   - LOW: Feature requests, training, nice-to-have

EXAMPLE CATEGORIES by department:
- IT: Software, Hardware, Email, Printing, Network, Access, Setup
- Accounting: Invoice, Reconciliation, Reports, Banking, Payroll
- Brokerage: MLS, Forms, Commission, Transaction, Listing
- HR: Onboarding, Benefits, Compliance, Payroll, Training
- Marketing: Campaign, Design, Social Media, Analytics, Content

Respond with JSON only:
{
  "category": "Short Category Name",
  "priority": "NORMAL",
  "confidence": 0.85,
  "reasoning": "Brief explanation"
}`
}

/**
 * Build prompt for ticket response generation
 */
function buildRespondPrompt(input: RespondInput, opts?: RespondOptions): string {
  const tone = opts?.tone || 'friendly'

  return `You are Aiden, a helpful IT helpdesk assistant. A support ticket needs a response.

Ticket Details:
- Title: ${input.ticketTitle}
- Description: ${input.ticketDescription}
- Category: ${input.ticketCategory || 'General'}
- Priority: ${input.ticketPriority || 'NORMAL'}

Guidelines:
- Provide specific, actionable troubleshooting instructions
- Be ${tone} and professional
- Use current best practices
- Keep response clear and well-structured

FORMATTING REQUIREMENTS:
- Use Markdown formatting for better readability
- Use ## for main section headings (e.g., "## Troubleshooting Steps")
- Use ### for sub-headings or numbered steps (e.g., "### 1. Check Connections")
- Use **bold text** for emphasis on important terms or actions
- Use bullet points with - for lists
- Use numbered lists (1., 2., 3.) for sequential steps
- Start with a friendly greeting
- End with "Best regards,\\n\\nAiden"

Please provide a comprehensive solution based on best practices.`
}

// ============================================================================
// Legacy LLMProvider compatibility (Phase 2)
// ============================================================================

export class OpenAIProvider implements LLMProvider {
  async classify(input: string): Promise<ClassifyResult> {
    throw new Error('NotImplemented: Use openaiProvider() factory function instead - Phase 5')
  }

  async respond(ticket: any): Promise<RespondResult> {
    throw new Error('NotImplemented: Use openaiProvider() factory function instead - Phase 5')
  }
}
