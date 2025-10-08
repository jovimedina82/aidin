import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import OpenAI from 'openai'
import { readFile } from 'fs/promises'
import { join } from 'path'

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

/**
 * Extract image URLs from markdown content
 */
function extractImageUrls(content) {
  const imageRegex = /!\[.*?\]\((.*?)\)/g
  const urls = []
  let match

  while ((match = imageRegex.exec(content)) !== null) {
    urls.push(match[1])
  }

  return urls
}

/**
 * Analyze images using OpenAI Vision API and return insights
 */
async function analyzeImagesWithAI(imageUrls, ticketId) {
  const imageInsights = []

  for (const imageUrl of imageUrls) {
    try {
      // Convert relative URL to absolute file path
      // imageUrl format: /draft-images/{ticketId}/{filename}
      const urlParts = imageUrl.split('/')
      const filename = urlParts[urlParts.length - 1]
      const imagePath = join(process.cwd(), 'public', 'draft-images', ticketId, filename)

      // Read image file and convert to base64
      const imageBuffer = await readFile(imagePath)
      const base64Image = imageBuffer.toString('base64')

      // Determine image type from filename
      const ext = filename.split('.').pop().toLowerCase()
      const mimeTypes = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp'
      }
      const mimeType = mimeTypes[ext] || 'image/jpeg'

      // Call OpenAI Vision API
      const response = await getOpenAI()?.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are analyzing screenshots and images from helpdesk ticket responses. Describe what you see in the image, focusing on technical details, UI elements, error messages, settings, or steps shown. Be concise and technical. Your description will be added to a knowledge base article."
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this image and describe what it shows. Focus on technical details that would help someone understand the solution or troubleshooting steps."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 500
      })

      const insight = response.choices[0].message.content.trim()
      imageInsights.push({
        url: imageUrl,
        filename,
        insight
      })

      console.log(`✅ Analyzed image: ${filename}`)
    } catch (error) {
      console.error(`Failed to analyze image ${imageUrl}:`, error.message)
      // Continue with other images even if one fails
    }
  }

  return imageInsights
}

export async function POST(request, { params }) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is staff/admin
    const userRoles = user.roles || []
    const roleNames = userRoles.map(r => r.role?.name || r.name || r)
    const isStaff = roleNames.some(role => ['Admin', 'Manager', 'Staff'].includes(role))

    if (!isStaff) {
      return NextResponse.json({ error: 'Only staff can create KB articles' }, { status: 403 })
    }

    const ticketId = params.id
    const { title, content, tags, useAI = true } = await request.json()

    if (!title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      )
    }

    // Get ticket details for context
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        requester: true
      }
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    let finalContent = content
    let finalTitle = title
    let imageInsights = []

    // Analyze images with OpenAI Vision API if present
    const imageUrls = extractImageUrls(content)
    if (imageUrls.length > 0) {
      console.log(`📸 Found ${imageUrls.length} image(s) in content, analyzing...`)
      imageInsights = await analyzeImagesWithAI(imageUrls, ticketId)
    }

    // Use OpenAI to create a more generic, reusable KB article
    if (useAI) {
      try {
        // Build enhanced content with image insights
        let enhancedContent = content
        if (imageInsights.length > 0) {
          enhancedContent += '\n\n## Image Analysis\n\n'
          imageInsights.forEach((img, index) => {
            enhancedContent += `**Image ${index + 1} (${img.filename}):** ${img.insight}\n\n`
          })
        }

        const completion = await getOpenAI()?.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are a knowledge base article creator. Transform ticket responses into reusable, generic knowledge base articles.

IMPORTANT FORMATTING:
- Use Markdown formatting for structure
- Use ## for main section headings
- Use ### for sub-headings
- Use **bold** for important terms and actions
- Use bullet lists with - for options and steps
- Use numbered lists 1., 2., 3. for sequential procedures
- Include clear, actionable instructions
- Make it generic (remove specific user names, ticket numbers, dates)
- Keep helpful screenshots and images if present in markdown format
- If image analysis is provided, integrate those insights naturally into the article where relevant
- Focus on the solution, not the specific problem instance

The article should be:
1. Generic and reusable for similar issues
2. Well-structured with clear headings
3. Step-by-step when applicable
4. Professional and helpful
5. Include troubleshooting steps where relevant
6. Integrate image descriptions naturally to enhance understanding`
            },
            {
              role: "user",
              content: `Create a knowledge base article from this ticket response:

Original Ticket Title: ${ticket.title}
Category: ${ticket.category || 'General'}

Response Content:
${enhancedContent}

Article Title Provided: ${title}

Transform this into a generic, reusable knowledge base article. Keep the markdown formatting and images. Remove any specific references to the requester's name or specific instances. If image analysis is included, integrate those insights naturally into the article to make it more valuable.`
            }
          ],
          temperature: 0.7,
          max_tokens: 2000
        })

        finalContent = completion.choices[0].message.content.trim()

        // Optionally improve the title too
        const titleCompletion = await getOpenAI()?.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "Create a clear, searchable knowledge base article title. Keep it under 100 characters. Focus on the problem/solution, not specific instances."
            },
            {
              role: "user",
              content: `Original title: "${title}"\nTicket category: "${ticket.category}"\n\nCreate an improved, generic KB article title.`
            }
          ],
          temperature: 0.7,
          max_tokens: 50
        })

        const suggestedTitle = titleCompletion.choices[0].message.content.trim().replace(/^["']|["']$/g, '')
        if (suggestedTitle && suggestedTitle.length > 10) {
          finalTitle = suggestedTitle
        }

        const imageInfo = imageInsights.length > 0 ? ` with ${imageInsights.length} image(s) analyzed` : ''
        console.log(`✅ AI-enhanced KB article: "${finalTitle}"${imageInfo}`)
      } catch (aiError) {
        console.error('AI enhancement failed, using original content:', aiError.message)
        // Continue with original content if AI fails
      }
    }

    // Create KB article with AI-enhanced content
    const kbArticle = await prisma.knowledgeBase.create({
      data: {
        title: finalTitle,
        content: finalContent,
        tags: tags ? JSON.stringify(tags) : JSON.stringify([ticket.category]),
        departmentId: ticket.departmentId,
        isActive: true,
        usageCount: 0
      }
    })

    // Link the ticket to this KB article for reference
    await prisma.ticketKBUsage.create({
      data: {
        ticketId: ticketId,
        kbId: kbArticle.id,
        relevance: 1.0,
        usedInResponse: true
      }
    })

    console.log(`✅ KB article created from ticket ${ticket.ticketNumber}: ${kbArticle.id} - "${finalTitle}"`)

    return NextResponse.json({
      success: true,
      article: {
        id: kbArticle.id,
        title: kbArticle.title,
        aiEnhanced: useAI,
        imagesAnalyzed: imageInsights.length
      },
      message: imageInsights.length > 0
        ? `Knowledge base article created successfully with ${imageInsights.length} image(s) analyzed`
        : 'Knowledge base article created successfully'
    })

  } catch (error) {
    console.error('Error creating KB article:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create KB article' },
      { status: 500 }
    )
  }
}
