import { prisma } from '../lib/prisma.js'

/**
 * This script is called by n8n webhook to send AI response via email
 * It receives ticketId and sends the AI response back to the requester
 */

export async function sendAIResponseEmail(ticketId, accessToken) {
  try {
    // Get ticket with AI comment
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        requester: true,
        comments: {
          where: {
            user: {
              email: 'ai-assistant@surterre.local'
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1,
          include: {
            user: true
          }
        }
      }
    })

    if (!ticket) {
      throw new Error('Ticket not found')
    }

    if (!ticket.emailConversationId) {
      console.log('Ticket was not created from email, skipping email reply')
      return { skipped: true, reason: 'Not an email ticket' }
    }

    const aiComment = ticket.comments[0]
    if (!aiComment) {
      throw new Error('No AI comment found')
    }

    // Get the original email ID from the conversation
    const emailsResponse = await fetch(
      `https://graph.microsoft.com/v1.0/users/helpdesk@surterreproperties.com/messages?$filter=conversationId eq '${ticket.emailConversationId}'&$top=1&$orderby=receivedDateTime desc`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    )

    const emailsData = await emailsResponse.json()
    const originalEmail = emailsData.value?.[0]

    if (!originalEmail) {
      throw new Error('Original email not found')
    }

    // Send reply using Microsoft Graph API
    const replyResponse = await fetch(
      `https://graph.microsoft.com/v1.0/users/helpdesk@surterreproperties.com/messages/${originalEmail.id}/reply`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: {
            body: {
              contentType: 'Text',
              content: `${aiComment.content}\n\n---\nTicket: ${ticket.ticketNumber}\nAidIN Helpdesk System`
            }
          }
        })
      }
    )

    if (!replyResponse.ok) {
      const error = await replyResponse.text()
      throw new Error(`Failed to send email: ${error}`)
    }

    console.log(`✅ AI response email sent for ticket ${ticket.ticketNumber}`)
    return { success: true, ticketNumber: ticket.ticketNumber }

  } catch (error) {
    console.error('Error sending AI response email:', error)
    throw error
  }
}
