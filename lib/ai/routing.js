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

    // Step 3: If keyword matching is conclusive (confidence > 0.8), use it
    if (keywordResults.confidence > 0.8) {
      return {
        departmentId: keywordResults.departmentId,
        confidence: keywordResults.confidence,
        method: 'keyword_match',
        keywordMatches: keywordResults.matches,
        reasoning: `Strong keyword match: ${keywordResults.matches.join(', ')}`
      }
    }

    // Step 4: If keyword matching is unclear, use AI analysis
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

    const prompt = `Analyze this support ticket and determine which department should handle it.

Ticket Title: ${title}
Ticket Description: ${description}

Available Departments:
${departmentInfo.map(dept =>
  `- ${dept.name}: ${dept.description}\n  Keywords: ${dept.keywords.join(', ')}`
).join('\n')}

Keyword Analysis Results:
${keywordResults.matches.length > 0
  ? `Found keywords: ${keywordResults.matches.join(', ')}`
  : 'No keyword matches found'
}

Please respond with a JSON object containing:
- departmentId: The ID of the most appropriate department
- confidence: A number between 0 and 1 indicating confidence
- reasoning: Brief explanation of why this department was chosen

Consider the ticket content, keywords, and department descriptions to make the best routing decision.`

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a ticket routing specialist. Analyze support tickets and route them to the most appropriate department based on content and available department information. Always respond with valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 200,
      temperature: 0.1, // Low temperature for consistent routing decisions
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