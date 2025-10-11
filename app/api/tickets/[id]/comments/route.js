import { NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"
import { logEvent } from '@/lib/audit'
import EmailService from '@/lib/services/EmailService'
import { generateEmailActionToken } from '@/lib/email-token'


export async function GET(request, { params }) {
  try {
    const comments = await prisma.ticketComment.findMany({
      where: {
        ticketId: params.id
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
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    return NextResponse.json(comments)
  } catch (error) {
    console.error('Error fetching comments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    )
  }
}

export async function POST(request, { params }) {
  try {
    // Get the authenticated user
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const data = await request.json()

    // Get ticket info for audit log
    const ticket = await prisma.ticket.findUnique({
      where: { id: params.id },
      select: { ticketNumber: true }
    })

    const comment = await prisma.ticketComment.create({
      data: {
        ticketId: params.id,
        userId: user.id,
        content: data.content,
        isPublic: data.isInternal ? false : true // Convert isInternal to isPublic
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

    // Log comment creation to audit trail
    await logEvent({
      action: 'comment.created',
      actorId: user.id,
      actorEmail: user.email,
      actorType: 'human',
      entityType: 'comment',
      entityId: comment.id,
      targetId: params.id,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || null,
      newValues: {
        ticketId: params.id,
        isPublic: comment.isPublic,
        contentLength: data.content?.length || 0,
        contentPreview: data.content?.substring(0, 200) || ''
      },
      metadata: {
        isInternal: data.isInternal || false,
        ticketNumber: ticket?.ticketNumber || 'unknown',
        commentSummary: data.content?.substring(0, 200) || ''
      }
    })

    // Send email notification if this is a public comment (not internal)
    console.log(`🔍 Comment isPublic: ${comment.isPublic}, data.isInternal: ${data.isInternal}`)
    if (comment.isPublic) {
      try {
        console.log(`📧 Attempting to send email notification for public comment on ticket ${params.id}`)

        // Get full ticket details with requester info
        const fullTicket = await prisma.ticket.findUnique({
          where: { id: params.id },
          include: {
            requester: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true
              }
            }
          }
        })

        console.log(`📋 Ticket details: ticketNumber=${fullTicket?.ticketNumber}, requesterEmail=${fullTicket?.requester?.email}`)

        if (fullTicket && fullTicket.requester?.email) {
          console.log(`📬 Preparing to send email to ${fullTicket.requester.email}`)

          const emailService = new EmailService()
          const accessToken = await emailService.getAccessToken()
          console.log(`🔑 Access token acquired: ${accessToken ? 'YES' : 'NO'}`)

          // Generate secure token for one-click survey
          const surveyToken = generateEmailActionToken(params.id, 'mark-solved', 30)
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
          const surveyUrl = `${appUrl}/survey/${surveyToken}`

          // Build HTML email body with direct survey link
          const htmlBody = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background-color: #3d6964; padding: 20px; color: white;">
    <h2 style="margin: 0;">Ticket Update: #${fullTicket.ticketNumber}</h2>
  </div>
  <div style="padding: 20px; background-color: #f9f9f9;">
    <p>Hello ${fullTicket.requester.firstName || 'there'},</p>
    <p><strong>${user.firstName} ${user.lastName}</strong> has replied to your ticket:</p>
    <div style="background-color: white; padding: 15px; border-left: 4px solid #3d6964; margin: 20px 0;">
      ${data.content.replace(/\n/g, '<br>')}
    </div>

    <!-- Was this helpful section with direct survey link -->
    <div style="background-color: #f0fdf4; border: 2px solid #22c55e; border-radius: 8px; padding: 20px; margin: 30px 0; text-align: center;">
      <p style="margin: 0 0 15px 0; font-size: 16px; font-weight: bold; color: #166534;">Did this resolve your issue?</p>
      <p style="margin: 0 0 20px 0; font-size: 14px; color: #166534;">If your problem has been solved, click below to close this ticket and share your feedback:</p>
      <a href="${surveyUrl}"
         style="background-color: #22c55e; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 15px;">
        ✓ Yes, Issue Resolved!
      </a>
      <p style="margin: 15px 0 0 0; font-size: 12px; color: #166534;">One click to mark as solved - no login required!</p>
    </div>

    <p>You can also view the full conversation and reply by clicking the link below:</p>
    <p style="text-align: center; margin: 30px 0;">
      <a href="${appUrl}/tickets/${params.id}"
         style="background-color: #3d6964; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
        View Ticket & Reply
      </a>
    </p>
    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
    <p style="font-size: 12px; color: #666;">
      Ticket: ${fullTicket.ticketNumber}<br>
      AidIN Helpdesk System - Powered by AI
    </p>
  </div>
</div>
          `

          // Build email payload for Microsoft Graph API
          const emailPayload = {
            message: {
              subject: `Re: ${fullTicket.title} [Ticket #${fullTicket.ticketNumber}]`,
              body: {
                contentType: 'HTML',
                content: htmlBody
              },
              toRecipients: [
                {
                  emailAddress: {
                    address: fullTicket.requester.email
                  }
                }
              ]
            },
            saveToSentItems: true
          }

          // Send email using Microsoft Graph API
          console.log(`🚀 Sending email via Microsoft Graph API to ${emailService.helpdeskEmail}`)
          const response = await fetch(
            `https://graph.microsoft.com/v1.0/users/${emailService.helpdeskEmail}/sendMail`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(emailPayload)
            }
          )

          console.log(`📡 Email API response status: ${response.status}`)

          if (!response.ok) {
            const error = await response.text()
            console.error(`❌ Email sending failed: ${error}`)
            throw new Error(`Failed to send email: ${error}`)
          }

          console.log(`✅ Sent email notification for comment on ticket ${fullTicket.ticketNumber} to ${fullTicket.requester.email}`)
        } else {
          console.log(`⚠️ Cannot send email - ticket or requester email missing. Ticket: ${fullTicket ? 'YES' : 'NO'}, Email: ${fullTicket?.requester?.email || 'NONE'}`)
        }
      } catch (emailError) {
        console.error('Failed to send comment notification email:', emailError)
        // Don't fail the request if email fails - comment is already saved
      }
    } else {
      console.log(`ℹ️ Internal note - no email sent for ticket ${ticket?.ticketNumber}`)
    }

    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    console.error('Error creating comment:', error)
    return NextResponse.json(
      { error: 'Failed to create comment' },
      { status: 500 }
    )
  }
}