import OpenAI from 'openai'
import { PrismaClient } from '../generated/prisma/index.js'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const prisma = new PrismaClient()

export async function routeTicketToDepartment(ticketTitle, ticketDescription) {
  try {
    // Step 1: Get all departments with their keywords
    const departments = await prisma.department.findMany({
      where: { isActive: true },
      include: {
        keywords: {
          where: { isActive: true }
        }
      }
    })

    if (departments.length === 0) {
      return {
        departmentId: null,
        confidence: 0,
        method: 'no_departments',
        keywordMatches: [],
        reasoning: 'No active departments found'
      }
    }

    // Step 2: Keyword matching phase
    const keywordResults = analyzeKeywords(ticketTitle, ticketDescription, departments)

    // Step 3: Always use AI analysis for better accuracy
    // AI will consider both keywords and context for best routing
    const aiResult = await analyzeWithAI(ticketTitle, ticketDescription, departments, keywordResults)

    return {
      departmentId: aiResult.departmentId,
      confidence: aiResult.confidence,
      method: 'ai_analysis',
      keywordMatches: keywordResults.matches,
      reasoning: aiResult.reasoning
    }

  } catch (error) {
    console.error('Error routing ticket to department:', error)
    return {
      departmentId: null,
      confidence: 0,
      method: 'error',
      keywordMatches: [],
      reasoning: 'Error occurred during routing analysis'
    }
  }
}

function analyzeKeywords(title, description, departments) {
  const text = `${title} ${description}`.toLowerCase()
  const departmentScores = new Map()
  const allMatches = []

  departments.forEach(dept => {
    let score = 0
    const matches = []

    dept.keywords.forEach(keywordObj => {
      const keyword = keywordObj.keyword.toLowerCase()
      const weight = keywordObj.weight

      // Simple keyword matching (could be enhanced with fuzzy matching)
      if (text.includes(keyword)) {
        score += weight
        matches.push(keyword)
        allMatches.push(keyword)
      }
    })

    if (score > 0) {
      departmentScores.set(dept.id, {
        departmentId: dept.id,
        departmentName: dept.name,
        score,
        matches
      })
    }
  })

  // Find the highest scoring department
  if (departmentScores.size === 0) {
    return {
      departmentId: null,
      confidence: 0,
      matches: []
    }
  }

  const topDepartment = Array.from(departmentScores.values())
    .sort((a, b) => b.score - a.score)[0]

  // Calculate confidence based on score difference and absolute score
  const allScores = Array.from(departmentScores.values()).map(d => d.score)
  const totalScore = allScores.reduce((sum, score) => sum + score, 0)
  const confidence = topDepartment.score / Math.max(totalScore, 1)

  return {
    departmentId: topDepartment.departmentId,
    confidence: Math.min(confidence, 0.95), // Cap at 95% for keyword-only matching
    matches: topDepartment.matches
  }
}

async function analyzeWithAI(title, description, departments, keywordResults) {
  try {
    // Prepare department information for AI
    const departmentInfo = departments.map(dept => ({
      id: dept.id,
      name: dept.name,
      description: dept.description || '',
      keywords: dept.keywords.map(k => k.keyword)
    }))

    const prompt = `You are an expert ticket routing system. Analyze the following support ticket and route it to the most appropriate department.

TICKET SUBJECT: ${title}

TICKET BODY:
${description}

AVAILABLE DEPARTMENTS:
${departmentInfo.map(dept =>
  `${dept.name} (ID: ${dept.id})
  Description: ${dept.description || 'Handles ' + dept.name + ' related issues'}
  Common Keywords: ${dept.keywords.slice(0, 20).join(', ')}${dept.keywords.length > 20 ? '...' : ''}`
).join('\n\n')}

KEYWORD MATCHES FOUND:
${keywordResults.matches.length > 0
  ? keywordResults.matches.join(', ')
  : 'None - rely on contextual analysis'
}

INSTRUCTIONS:
1. Read the ENTIRE ticket subject AND body carefully
2. Understand the user's actual problem/request in context
3. PRIORITIZE the root technical/infrastructure issue over document types or content
   - Example: "Can't print CRMLS forms" → IT (printing issue), NOT Brokerage (CRMLS)
   - Example: "Email not working for client contracts" → IT (email issue), NOT relevant to contract content
   - Example: "VPN won't connect to access MLS" → IT (VPN/network issue), NOT Brokerage (MLS)
4. Identify what is BROKEN or MALFUNCTIONING first, then consider what they're trying to do with it
5. Technical issues (login, password, network, printing, hardware, software) → IT Department
6. Business process issues (contracts, deals, marketing content, HR requests) → Respective departments
7. Don't just match keywords - understand the INTENT and CONTEXT
8. Be confident in your decision (aim for 0.7+ confidence when clear)

Respond ONLY with valid JSON (no markdown):
{
  "departmentId": "exact-department-id-from-list",
  "confidence": 0.85,
  "reasoning": "Brief explanation of routing decision"
}`

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Better model for improved accuracy
      messages: [
        {
          role: "system",
          content: "You are an expert support ticket routing system. Your job is to analyze tickets and route them to the correct department by understanding the full context and intent of the request. CRITICAL: Always prioritize the technical/infrastructure issue over the content or document type. For example, printing issues go to IT regardless of what's being printed. Network/login/software issues go to IT regardless of what system they're trying to access. Always respond with valid JSON only, no additional text or markdown."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 300,
      temperature: 0.2, // Low temperature for consistent routing decisions
    })

    try {
      const result = JSON.parse(completion.choices[0].message.content.trim())

      // Validate the department ID exists
      const validDepartment = departments.find(d => d.id === result.departmentId)
      if (!validDepartment) {
        console.error('Invalid department ID returned by AI:', result.departmentId)
        // Use fallback department
        return {
          departmentId: keywordResults.departmentId || departments[0].id,
          confidence: 0.4,
          reasoning: 'AI returned invalid department, using fallback routing'
        }
      }

      return {
        departmentId: result.departmentId,
        confidence: Math.min(Math.max(result.confidence || 0, 0), 1), // Clamp between 0 and 1
        reasoning: result.reasoning || 'AI analysis completed'
      }
    } catch (parseError) {
      console.error('Error parsing AI routing response:', parseError)

      // Fallback: use keyword results or first department
      return {
        departmentId: keywordResults.departmentId || departments[0].id,
        confidence: 0.5,
        reasoning: 'AI analysis failed, using fallback routing'
      }
    }
  } catch (error) {
    console.error('Error with AI routing analysis:', error)

    // Fallback to keyword results or first department
    return {
      departmentId: keywordResults.departmentId || departments[0].id,
      confidence: 0.3,
      reasoning: 'AI service unavailable, using fallback routing'
    }
  }
}