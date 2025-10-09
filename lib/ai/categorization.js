import OpenAI from 'openai'

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

export async function enhancedCategorizeTicket(title, description, departmentName = null) {
  try {
    const prompt = `You are an expert support ticket categorization system. Analyze this ticket and create or assign a descriptive category.

TICKET SUBJECT: ${title}

TICKET BODY:
${description}

${departmentName ? `DEPARTMENT: ${departmentName}` : ''}

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

    const client = getOpenAI()
    if (!client) {
      console.warn('OpenAI client not initialized (missing OPENAI_API_KEY)')
      return null
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert ticket categorization system. Create concise, reusable category names that help organize support tickets effectively. Always respond with valid JSON only."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 250,
      temperature: 0.2,
    })

    try {
      const result = JSON.parse(completion.choices[0].message.content.trim())

      // Validate and sanitize
      const validPriority = ['URGENT', 'HIGH', 'NORMAL', 'LOW'].includes(result.priority)
        ? result.priority
        : 'NORMAL'

      const confidence = Math.min(Math.max(result.confidence || 0.5, 0), 1)

      // Clean up category name
      const category = result.category
        ? result.category.trim().substring(0, 50) // Max 50 chars
        : 'General'

      return {
        category,
        priority: validPriority,
        confidence,
        reasoning: result.reasoning || 'Automated categorization completed',
        method: 'ai_dynamic'
      }

    } catch (parseError) {
      console.error('Error parsing AI categorization response:', parseError)

      return {
        category: 'General',
        priority: 'NORMAL',
        confidence: 0.3,
        reasoning: 'Parsing error, using fallback',
        method: 'fallback'
      }
    }

  } catch (error) {
    console.error('Error with enhanced categorization:', error)

    return {
      category: 'General',
      priority: 'NORMAL',
      confidence: 0.3,
      reasoning: 'AI service unavailable, using fallback',
      method: 'fallback'
    }
  }
}

export async function suggestTicketTags(title, description, category) {
  try {
    const prompt = `Based on this support ticket, suggest 3-5 relevant tags that would help with organization and searching.

Title: ${title}
Description: ${description}
Category: ${category}

Tags should be:
- Single words or short phrases
- Relevant to the issue
- Useful for searching and filtering
- Technical when appropriate

Respond with a JSON array of suggested tags (strings only).

Examples: ["outlook", "password-reset", "urgent"] or ["hardware", "laptop", "screen-issue"]`

    const client = getOpenAI()
    if (!client) {
      console.warn('OpenAI client not initialized (missing OPENAI_API_KEY)')
      return null
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a ticket tagging specialist. Generate relevant, useful tags for support tickets. Respond only with a JSON array of strings."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 100,
      temperature: 0.3,
    })

    try {
      const result = JSON.parse(completion.choices[0].message.content.trim())
      const tags = result.tags || []
      return Array.isArray(tags) ? tags.slice(0, 5) : []
    } catch (parseError) {
      console.error('Error parsing tag suggestions:', parseError)
      return []
    }

  } catch (error) {
    console.error('Error generating tag suggestions:', error)
    return []
  }
}
