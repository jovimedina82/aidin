import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request) {
  try {
    const { ticketId, accessToken } = await request.json()

    if (!ticketId || !accessToken) {
      return NextResponse.json(
        { error: 'ticketId and accessToken are required' },
        { status: 400 }
      )
    }

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
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    if (!ticket.emailConversationId) {
      return NextResponse.json({
        skipped: true,
        reason: 'Ticket was not created from email'
      })
    }

    const aiComment = ticket.comments[0]
    if (!aiComment) {
      return NextResponse.json(
        { error: 'No AI comment found' },
        { status: 404 }
      )
    }

    // Get recent unread/read emails and find one with matching conversationId
    const emailsResponse = await fetch(
      `https://graph.microsoft.com/v1.0/users/helpdesk@surterreproperties.com/mailFolders/inbox/messages?$top=50&$orderby=receivedDateTime desc&$select=id,conversationId,subject,from,receivedDateTime`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    )

    if (!emailsResponse.ok) {
      const error = await emailsResponse.text()
      return NextResponse.json(
        { error: `Failed to fetch emails: ${error}` },
        { status: 500 }
      )
    }

    const emailsData = await emailsResponse.json()

    // Find the email with matching conversationId
    const originalEmail = emailsData.value?.find(
      email => email.conversationId === ticket.emailConversationId
    )

    if (!originalEmail) {
      return NextResponse.json(
        { error: `Original email not found for conversationId: ${ticket.emailConversationId}` },
        { status: 404 }
      )
    }

    // Send reply using Microsoft Graph API
    const replyResponse = await fetch(
      `https://graph.microsoft.com/v1.0/users/helpdesk@surterreproperties.com/messages/${originalEmail.id}/reply`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
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
      return NextResponse.json(
        { error: `Failed to send email reply: ${error}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      ticketNumber: ticket.ticketNumber,
      message: 'AI response email sent successfully'
    })
  } catch (error) {
    console.error('Error in send-ai-email:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
