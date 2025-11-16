import { NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"
import { logEvent } from '@/lib/audit'
import EmailService from '@/lib/services/EmailService'
import { generateEmailActionToken } from '@/lib/email-token'
import { escapeHtmlWithBreaks } from '@/lib/utils/html-escape'


export async function GET(request, { params }) {
  try {
    // SECURITY: Require authentication to view comments
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Verify user has access to this ticket
    const ticket = await prisma.ticket.findUnique({
      where: { id: params.id },
      select: {
        requesterId: true,
        assigneeId: true,
        departmentId: true
      }
    })

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    // Check user has permission to view this ticket's comments
    const userRoles = user.roles?.map(role =>
      typeof role === 'string' ? role : (role.role?.name || role.name)
    ) || []

    const isAdmin = userRoles.includes('Admin')
    const isAgent = userRoles.includes('Agent') || userRoles.includes('Support')
    const isRequester = ticket.requesterId === user.id
    const isAssignee = ticket.assigneeId === user.id

    // Allow access if: admin, agent, ticket requester, or ticket assignee
    if (!isAdmin && !isAgent && !isRequester && !isAssignee) {
      return NextResponse.json(
        { error: 'You do not have permission to view this ticket' },
        { status: 403 }
      )
    }

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
        },
        attachments: {
          select: {
            id: true,
            fileName: true,
            fileSize: true,
            mimeType: true,
            uploadedAt: true
          },
          orderBy: {
            uploadedAt: 'asc'
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
    const { surveyRecipient } = data  // Extract selected recipient for "Mark as Solved" button

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
          const appUrl = process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3011}`
          const surveyUrl = `${appUrl}/survey/${surveyToken}`

          // Build HTML email body with direct survey link
          const htmlBody = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background-color: #3d6964; padding: 15px; color: white;">
    <h3 style="margin: 0;">Ticket #${fullTicket.ticketNumber}</h3>
  </div>
  <div style="padding: 20px; background-color: #fff;">
    <p>Hello ${fullTicket.requester.firstName || 'there'},</p>
    <p><strong>${user.firstName} ${user.lastName}</strong> replied:</p>
    <div style="background-color: #f5f5f5; padding: 12px; border-left: 3px solid #3d6964; margin: 15px 0;">
      ${escapeHtmlWithBreaks(data.content || '')}
    </div>
    <div style="background-color: #f0fdf4; border: 2px solid #22c55e; border-radius: 6px; padding: 15px; margin: 20px 0; text-align: center;">
      <p style="margin: 0 0 12px 0; font-weight: bold; color: #166534;">Issue Resolved?</p>
      <a href="${surveyUrl}" style="background-color: #22c55e; color: white; padding: 12px 28px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">✓ Yes, Mark as Solved</a>
      <p style="margin: 10px 0 0 0; font-size: 11px; color: #166534;">No login required</p>
    </div>
    <p style="text-align: center; margin: 15px 0;">
      <a href="${appUrl}/tickets/${params.id}" style="color: #3d6964; text-decoration: none;">View Full Ticket →</a>
    </p>
    <p style="font-size: 11px; color: #999; margin: 15px 0 0 0; border-top: 1px solid #eee; padding-top: 10px;">
      Ticket ${fullTicket.ticketNumber} • AidIN Helpdesk
    </p>
  </div>
</div>
          `

          // Fetch ONLY attachments linked to this specific comment
          // This ensures we only send attachments that belong to this reply
          const ticketAttachments = await prisma.attachment.findMany({
            where: {
              ticketId: params.id,
              commentId: comment.id,  // Only get attachments for this specific comment
              sentInEmail: false  // Only get attachments not yet sent
            },
            orderBy: { uploadedAt: 'desc' }
          })

          console.log(`📎 Found ${ticketAttachments.length} new attachments for comment ${comment.id} on ticket ${fullTicket.ticketNumber}`)

          // Convert attachments to Graph API format
          const emailAttachments = []
          const MAX_TOTAL_SIZE = 20 * 1024 * 1024 // 20 MB limit
          let totalSize = 0
          const skippedAttachments = []
          const processedAttachmentIds = [] // Track which attachments were successfully added
          const failedAttachmentIds = [] // Track which attachments failed to read

          if (ticketAttachments.length > 0) {
            const fs = await import('fs').then(mod => mod.promises)
            const path = await import('path')

            for (const attachment of ticketAttachments) {
              try {
                // Check if adding this attachment would exceed the limit
                if (totalSize + attachment.fileSize > MAX_TOTAL_SIZE) {
                  console.log(`   ⚠️  Skipping ${attachment.fileName} - would exceed 20 MB limit (${((totalSize + attachment.fileSize) / 1024 / 1024).toFixed(2)} MB total)`)
                  skippedAttachments.push(attachment)
                  continue
                }

                let fileBuffer
                const isUrl = attachment.filePath.startsWith('http://') || attachment.filePath.startsWith('https://')

                if (isUrl) {
                  // Fetch from CDN (email attachments)
                  console.log(`   Fetching attachment from CDN: ${attachment.fileName}`)
                  const response = await fetch(attachment.filePath)
                  if (!response.ok) {
                    throw new Error(`Failed to fetch from CDN: ${response.status}`)
                  }
                  const arrayBuffer = await response.arrayBuffer()
                  fileBuffer = Buffer.from(arrayBuffer)
                } else {
                  // Read from local filesystem (manual uploads)
                  // SECURITY: Validate path to prevent directory traversal
                  const baseDir = path.join(process.cwd(), 'uploads', 'attachments')
                  const absolutePath = path.resolve(baseDir, attachment.filePath)

                  // Ensure the resolved path is within the allowed base directory
                  if (!absolutePath.startsWith(baseDir)) {
                    throw new Error(`Invalid file path: attempted directory traversal`)
                  }

                  console.log(`   Reading attachment from disk: ${attachment.fileName} from ${absolutePath}`)
                  fileBuffer = await fs.readFile(absolutePath)
                }

                const base64Content = fileBuffer.toString('base64')

                emailAttachments.push({
                  '@odata.type': '#microsoft.graph.fileAttachment',
                  name: attachment.fileName,
                  contentType: attachment.mimeType,
                  contentBytes: base64Content
                })

                totalSize += attachment.fileSize
                processedAttachmentIds.push(attachment.id)
                console.log(`   ✓ Added ${attachment.fileName} (${(attachment.fileSize / 1024).toFixed(1)} KB) - Total: ${(totalSize / 1024 / 1024).toFixed(2)} MB`)
              } catch (error) {
                console.error(`   ✗ Failed to read attachment ${attachment.fileName}:`, error.message)
                // Mark failed attachments so they don't keep retrying
                failedAttachmentIds.push(attachment.id)
              }
            }

            // Log summary
            if (skippedAttachments.length > 0) {
              console.log(`⚠️  ${skippedAttachments.length} attachment(s) skipped due to 20 MB email size limit:`)
              skippedAttachments.forEach(att => {
                console.log(`     - ${att.fileName} (${(att.fileSize / 1024).toFixed(1)} KB)`)
              })
            }

            // Mark failed attachments as sent to prevent retry loops
            if (failedAttachmentIds.length > 0) {
              await prisma.attachment.updateMany({
                where: {
                  id: { in: failedAttachmentIds }
                },
                data: {
                  sentInEmail: true // Mark as sent even though failed, to prevent infinite retry
                }
              })
              console.log(`⚠️  Marked ${failedAttachmentIds.length} failed attachment(s) as sent to prevent retry loops`)
            }
          }

          // Fetch CC recipients for this ticket
          const ccRecipients = await prisma.ticketCC.findMany({
            where: {
              ticketId: params.id
            },
            select: {
              email: true,
              name: true
            }
          })

          // Determine who receives the "Mark as Solved" button
          // Default to requester if no specific recipient is selected
          const selectedSurveyRecipient = surveyRecipient || fullTicket.requester.email
          console.log(`📊 Survey button will be sent to: ${selectedSurveyRecipient}`)

          // Build list of all recipients who should get the email
          const allRecipients = [
            { email: fullTicket.requester.email, name: `${fullTicket.requester.firstName} ${fullTicket.requester.lastName}` },
            ...ccRecipients.map(cc => ({ email: cc.email, name: cc.name || cc.email }))
          ]

          // Separate recipients: the survey recipient and others
          const primaryRecipient = allRecipients.find(r => r.email === selectedSurveyRecipient)
          const otherRecipients = allRecipients.filter(r => r.email !== selectedSurveyRecipient)

          // Build email body WITHOUT the "Mark as Solved" button for CC recipients
          const htmlBodyWithoutButton = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background-color: #3d6964; padding: 15px; color: white;">
    <h3 style="margin: 0;">Ticket #${fullTicket.ticketNumber}</h3>
  </div>
  <div style="padding: 20px; background-color: #fff;">
    <p>Hello,</p>
    <p><strong>${user.firstName} ${user.lastName}</strong> replied:</p>
    <div style="background-color: #f5f5f5; padding: 12px; border-left: 3px solid #3d6964; margin: 15px 0;">
      ${escapeHtmlWithBreaks(data.content || '')}
    </div>
    <p style="text-align: center; margin: 15px 0;">
      <a href="${appUrl}/tickets/${params.id}" style="color: #3d6964; text-decoration: none;">View Full Ticket →</a>
    </p>
    <p style="font-size: 11px; color: #999; margin: 15px 0 0 0; border-top: 1px solid #eee; padding-top: 10px;">
      Ticket ${fullTicket.ticketNumber} • AidIN Helpdesk
    </p>
  </div>
</div>
          `

          // Send email WITH button to the selected survey recipient
          console.log(`📧 Sending email WITH survey button to: ${primaryRecipient.email}`)
          const emailPayloadWithButton = {
            message: {
              subject: `Re: ${fullTicket.title} [Ticket #${fullTicket.ticketNumber}]`,
              body: {
                contentType: 'HTML',
                content: htmlBody
              },
              toRecipients: [
                {
                  emailAddress: {
                    address: primaryRecipient.email,
                    name: primaryRecipient.name
                  }
                }
              ],
              attachments: emailAttachments
            },
            saveToSentItems: true
          }

          const responseWithButton = await fetch(
            `https://graph.microsoft.com/v1.0/users/${emailService.helpdeskEmail}/sendMail`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(emailPayloadWithButton)
            }
          )

          console.log(`📡 Email WITH button response status: ${responseWithButton.status}`)

          if (!responseWithButton.ok) {
            const error = await responseWithButton.text()
            console.error(`❌ Email sending failed: ${error}`)
            throw new Error(`Failed to send email: ${error}`)
          }

          console.log(`✅ Sent email WITH survey button to ${primaryRecipient.email}`)

          // Send email WITHOUT button to other recipients (CC)
          if (otherRecipients.length > 0) {
            console.log(`📧 Sending email WITHOUT survey button to ${otherRecipients.length} CC recipient(s): ${otherRecipients.map(r => r.email).join(', ')}`)

            const emailPayloadWithoutButton = {
              message: {
                subject: `Re: ${fullTicket.title} [Ticket #${fullTicket.ticketNumber}]`,
                body: {
                  contentType: 'HTML',
                  content: htmlBodyWithoutButton
                },
                toRecipients: otherRecipients.map(recipient => ({
                  emailAddress: {
                    address: recipient.email,
                    name: recipient.name || undefined
                  }
                })),
                attachments: emailAttachments
              },
              saveToSentItems: true
            }

            const responseWithoutButton = await fetch(
              `https://graph.microsoft.com/v1.0/users/${emailService.helpdeskEmail}/sendMail`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(emailPayloadWithoutButton)
              }
            )

            console.log(`📡 Email WITHOUT button response status: ${responseWithoutButton.status}`)

            if (!responseWithoutButton.ok) {
              const error = await responseWithoutButton.text()
              console.error(`⚠️ Email to CC recipients failed: ${error}`)
              // Don't throw - primary email was sent successfully
            } else {
              console.log(`✅ Sent email WITHOUT survey button to ${otherRecipients.length} CC recipient(s)`)
            }
          }

          console.log(`✅ All email notifications sent for ticket ${fullTicket.ticketNumber}`)

          // Mark only successfully sent attachments as sent (not skipped ones)
          if (processedAttachmentIds.length > 0) {
            await prisma.attachment.updateMany({
              where: {
                id: { in: processedAttachmentIds }
              },
              data: {
                sentInEmail: true
              }
            })
            console.log(`✓ Marked ${processedAttachmentIds.length} attachment(s) as sent in email`)

            if (skippedAttachments.length > 0) {
              console.log(`ℹ️  ${skippedAttachments.length} attachment(s) remain unsent (exceeded size limit) and will be included in next email`)
            }
          }
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