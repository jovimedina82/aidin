import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { emitTicketUpdated } from '@/lib/socket'
import OpenAI from 'openai'
import { readFile } from 'fs/promises'
import { join } from 'path'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

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
      const response = await openai.chat.completions.create({
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

/**
 * Create KB article from the sent draft
 */
async function createKBArticleFromDraft(ticket, draftContent, ticketId) {
  try {
    let imageInsights = []

    // Analyze images with OpenAI Vision API if present
    const imageUrls = extractImageUrls(draftContent)
    if (imageUrls.length > 0) {
      console.log(`📸 Found ${imageUrls.length} image(s) in draft, analyzing...`)
      imageInsights = await analyzeImagesWithAI(imageUrls, ticketId)
    }

    // Build enhanced content with image insights
    let enhancedContent = draftContent
    if (imageInsights.length > 0) {
      enhancedContent += '\n\n## Image Analysis\n\n'
      imageInsights.forEach((img, index) => {
        enhancedContent += `**Image ${index + 1} (${img.filename}):** ${img.insight}\n\n`
      })
    }

    // Use OpenAI to create a generic, reusable KB article
    const completion = await openai.chat.completions.create({
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

Transform this into a generic, reusable knowledge base article. Keep the markdown formatting and images. Remove any specific references to the requester's name or specific instances. If image analysis is included, integrate those insights naturally into the article to make it more valuable.`
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    })

    const finalContent = completion.choices[0].message.content.trim()

    // Generate improved title
    const titleCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Create a clear, searchable knowledge base article title. Keep it under 100 characters. Focus on the problem/solution, not specific instances."
        },
        {
          role: "user",
          content: `Original title: "${ticket.title}"\nTicket category: "${ticket.category}"\n\nCreate an improved, generic KB article title.`
        }
      ],
      temperature: 0.7,
      max_tokens: 50
    })

    const suggestedTitle = titleCompletion.choices[0].message.content.trim().replace(/^["']|["']$/g, '')
    const finalTitle = (suggestedTitle && suggestedTitle.length > 10) ? suggestedTitle : ticket.title

    // Create KB article
    const kbArticle = await prisma.knowledgeBase.create({
      data: {
        title: finalTitle,
        content: finalContent,
        tags: JSON.stringify([ticket.category]),
        departmentId: ticket.departmentId,
        isActive: true,
        usageCount: 0
      }
    })

    // Link the ticket to this KB article
    await prisma.ticketKBUsage.create({
      data: {
        ticketId: ticketId,
        kbId: kbArticle.id,
        relevance: 1.0,
        usedInResponse: true
      }
    })

    const imageInfo = imageInsights.length > 0 ? ` with ${imageInsights.length} image(s) analyzed` : ''
    console.log(`✅ Auto-created KB article from ticket ${ticket.ticketNumber}: ${kbArticle.id} - "${finalTitle}"${imageInfo}`)

    return kbArticle
  } catch (error) {
    console.error('Failed to auto-create KB article:', error.message)
    // Don't fail the request if KB creation fails
    return null
  }
}

/**
 * POST /api/tickets/{id}/send-draft
 * Send the AI draft response as final answer to the requester
 * Body: { draftContent: string }
 */
export async function POST(request, { params }) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ticketId = params.id
    const { draftContent } = await request.json()

    if (!draftContent || !draftContent.trim()) {
      return NextResponse.json(
        { error: 'Draft content is required' },
        { status: 400 }
      )
    }

    // Get the ticket
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Get AI user for posting the comment
    const aiUser = await prisma.user.findUnique({
      where: { email: 'ai-assistant@surterre.local' }
    })

    if (!aiUser) {
      return NextResponse.json(
        { error: 'AI user not found. Please contact administrator.' },
        { status: 500 }
      )
    }

    // Create comment with the draft content
    const comment = await prisma.ticketComment.create({
      data: {
        ticketId: ticket.id,
        userId: aiUser.id,
        content: draftContent,
        isPublic: true,
        createdAt: new Date()
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    })

    // Clear the draft fields and assign ticket to the user who sent the response
    const updatedTicket = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        aiDraftResponse: null,
        aiDraftGeneratedAt: null,
        aiDraftGeneratedBy: null,
        assigneeId: user.id,  // Assign to user who sent the response
        status: ticket.status === 'NEW' ? 'OPEN' : ticket.status,  // Update status to OPEN if it was NEW
        updatedAt: new Date()
      },
      include: {
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        },
        attachments: {
          orderBy: {
            uploadedAt: 'desc'
          }
        }
      }
    })

    console.log(`✅ AI draft sent as comment for ticket ${ticket.ticketNumber}`)

    // Send email to requester if ticket came from email
    if (ticket.emailConversationId && ticket.requester?.email) {
      try {
        console.log(`📧 Sending email response for ticket ${ticket.ticketNumber} to ${ticket.requester.email}...`)
        const { getEmailService } = await import('@/lib/services/EmailService.js')
        const emailService = getEmailService()

        await emailService.sendAIResponseEmail(ticket, draftContent)
        console.log(`✅ AI response email sent for ticket ${ticket.ticketNumber}`)
      } catch (emailError) {
        console.error(`❌ Failed to send AI response email for ticket ${ticket.ticketNumber}:`, emailError.message)
        // Don't fail the request if email fails - comment is already posted
      }
    } else {
      // Log why email was skipped
      if (!ticket.emailConversationId) {
        console.log(`⚠️  Email NOT sent for ticket ${ticket.ticketNumber}: No emailConversationId (ticket was not created from email)`)
      } else if (!ticket.requester?.email) {
        console.log(`⚠️  Email NOT sent for ticket ${ticket.ticketNumber}: No requester email address`)
      }
    }

    // Auto-create KB article from the sent draft (runs in background, doesn't block response)
    createKBArticleFromDraft(ticket, draftContent, ticketId).catch(err => {
      console.error('Background KB article creation failed:', err.message)
    })

    // Emit socket event for live updates
    emitTicketUpdated(updatedTicket)

    return NextResponse.json({
      success: true,
      message: 'Draft sent successfully. Knowledge base article will be created automatically.',
      ticket: updatedTicket,
      comment: comment
    })
  } catch (error) {
    console.error('Error sending draft:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send draft' },
      { status: 500 }
    )
  }
}
