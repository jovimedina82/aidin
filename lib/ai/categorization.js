import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function enhancedCategorizeTicket(title, description, departmentName = null) {
  try {
    // Enhanced categories based on common IT helpdesk scenarios
    const categories = {
      'Hardware Problem': {
        description: 'Issues with physical equipment, devices, peripherals',
        keywords: ['laptop', 'desktop', 'monitor', 'keyboard', 'mouse', 'printer', 'hardware', 'device', 'screen', 'broken', 'damaged'],
        defaultPriority: 'HIGH'
      },
      'Software Issue': {
        description: 'Problems with applications, programs, software functionality',
        keywords: ['software', 'application', 'program', 'app', 'install', 'update', 'bug', 'error', 'crash', 'not working'],
        defaultPriority: 'NORMAL'
      },
      'Account Access': {
        description: 'Login problems, password resets, account permissions',
        keywords: ['login', 'password', 'access', 'account', 'permission', 'locked', 'reset', 'authentication', 'sign in'],
        defaultPriority: 'HIGH'
      },
      'Network Issue': {
        description: 'Internet connectivity, network access, WiFi problems',
        keywords: ['internet', 'network', 'wifi', 'connection', 'connectivity', 'vpn', 'slow', 'disconnected'],
        defaultPriority: 'HIGH'
      },
      'Email Problem': {
        description: 'Email client issues, sending/receiving problems',
        keywords: ['email', 'outlook', 'mail', 'send', 'receive', 'attachment', 'spam'],
        defaultPriority: 'NORMAL'
      },
      'Security Issue': {
        description: 'Security concerns, potential threats, suspicious activity',
        keywords: ['security', 'virus', 'malware', 'suspicious', 'phishing', 'scam', 'threat', 'infected'],
        defaultPriority: 'URGENT'
      },
      'Office 365': {
        description: 'Microsoft Office 365 applications and services',
        keywords: ['office 365', 'teams', 'sharepoint', 'onedrive', 'word', 'excel', 'powerpoint', 'outlook'],
        defaultPriority: 'NORMAL'
      },
      'Feature Request': {
        description: 'Requests for new features or functionality',
        keywords: ['request', 'feature', 'new', 'add', 'enhancement', 'improvement', 'would like'],
        defaultPriority: 'LOW'
      },
      'Training Request': {
        description: 'Training or guidance on using systems or software',
        keywords: ['training', 'help', 'how to', 'tutorial', 'guidance', 'learn', 'show me'],
        defaultPriority: 'LOW'
      },
      'General Question': {
        description: 'General inquiries and questions',
        keywords: ['question', 'inquiry', 'information', 'general'],
        defaultPriority: 'NORMAL'
      }
    }

    // Department-specific adjustments
    const departmentAdjustments = {
      'Accounting': {
        additionalCategories: ['Financial Software', 'Billing System'],
        priorityBoost: ['Account Access', 'Security Issue']
      },
      'HR': {
        additionalCategories: ['HRIS System', 'Payroll System'],
        priorityBoost: ['Account Access', 'Security Issue']
      },
      'Sales': {
        additionalCategories: ['CRM System', 'Sales Tools'],
        priorityBoost: ['Network Issue', 'Email Problem']
      }
    }

    const prompt = `Analyze this support ticket and categorize it appropriately.

Ticket Title: ${title}
Ticket Description: ${description}
${departmentName ? `Department: ${departmentName}` : ''}

Available Categories:
${Object.entries(categories).map(([name, info]) =>
  `- ${name}: ${info.description}`
).join('\n')}

Priority Levels (with guidelines):
- URGENT: Critical business impact, security issues, complete system down
- HIGH: Significant impact on productivity, access issues, hardware problems
- NORMAL: Standard requests, software issues, general problems
- LOW: Feature requests, training, non-critical questions

Consider:
1. The nature and severity of the issue
2. Business impact and urgency
3. Category descriptions and typical priorities
4. Keywords and context clues
${departmentName ? `5. Department-specific considerations for ${departmentName}` : ''}

Respond with a JSON object containing:
- category: The most appropriate category from the list above
- priority: The appropriate priority level (URGENT, HIGH, NORMAL, LOW)
- confidence: A number between 0 and 1 indicating confidence in the categorization
- reasoning: Brief explanation of the categorization decision`

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert IT helpdesk ticket categorization specialist. Analyze tickets carefully and provide accurate categorization with appropriate priority levels. Always respond with valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 200,
      temperature: 0.1, // Low temperature for consistent categorization
    })

    try {
      const result = JSON.parse(completion.choices[0].message.content.trim())

      // Validate and sanitize the result
      const validCategory = Object.keys(categories).includes(result.category)
        ? result.category
        : 'General Question'

      const validPriority = ['URGENT', 'HIGH', 'NORMAL', 'LOW'].includes(result.priority)
        ? result.priority
        : 'NORMAL'

      const confidence = Math.min(Math.max(result.confidence || 0.5, 0), 1)

      // Apply department-specific adjustments
      let finalPriority = validPriority
      if (departmentName && departmentAdjustments[departmentName]) {
        const adjustments = departmentAdjustments[departmentName]
        if (adjustments.priorityBoost?.includes(validCategory)) {
          // Boost priority if applicable
          const priorityLevels = ['LOW', 'NORMAL', 'HIGH', 'URGENT']
          const currentIndex = priorityLevels.indexOf(validPriority)
          if (currentIndex < priorityLevels.length - 1) {
            finalPriority = priorityLevels[currentIndex + 1]
          }
        }
      }

      return {
        category: validCategory,
        priority: finalPriority,
        confidence,
        reasoning: result.reasoning || 'Automated categorization completed',
        method: 'ai_enhanced'
      }

    } catch (parseError) {
      console.error('Error parsing AI categorization response:', parseError)

      // Fallback: use keyword-based categorization
      return keywordBasedCategorization(title, description, categories)
    }

  } catch (error) {
    console.error('Error with enhanced categorization:', error)

    // Fallback to simple categorization
    return {
      category: 'General Question',
      priority: 'NORMAL',
      confidence: 0.3,
      reasoning: 'AI service unavailable, using fallback',
      method: 'fallback'
    }
  }
}

function keywordBasedCategorization(title, description, categories) {
  const text = `${title} ${description}`.toLowerCase()
  const scores = {}

  // Score each category based on keyword matches
  Object.entries(categories).forEach(([categoryName, categoryInfo]) => {
    let score = 0
    categoryInfo.keywords.forEach(keyword => {
      if (text.includes(keyword.toLowerCase())) {
        score += 1
      }
    })
    if (score > 0) {
      scores[categoryName] = score
    }
  })

  // Find the highest scoring category
  const topCategory = Object.entries(scores).length > 0
    ? Object.entries(scores).sort(([,a], [,b]) => b - a)[0][0]
    : 'General Question'

  const priority = categories[topCategory]?.defaultPriority || 'NORMAL'

  return {
    category: topCategory,
    priority,
    confidence: Object.keys(scores).length > 0 ? 0.6 : 0.3,
    reasoning: `Keyword-based categorization: matched "${topCategory}"`,
    method: 'keyword_fallback'
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

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
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
      max_tokens: 100,
      temperature: 0.3,
    })

    try {
      const tags = JSON.parse(completion.choices[0].message.content.trim())
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