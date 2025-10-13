import { ConfidentialClientApplication } from '@azure/msal-node'
import { marked } from 'marked'

class EmailService {
  constructor() {
    this.msalConfig = {
      auth: {
        clientId: process.env.AZURE_AD_CLIENT_ID,
        authority: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}`,
        clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
      }
    }
    this.msalClient = new ConfidentialClientApplication(this.msalConfig)
    this.helpdeskEmail = process.env.HELPDESK_EMAIL || 'helpdesk@surterreproperties.com'
  }

  async getAccessToken() {
    try {
      const tokenRequest = {
        scopes: ['https://graph.microsoft.com/.default']
      }

      const response = await this.msalClient.acquireTokenByClientCredential(tokenRequest)
      return response.accessToken
    } catch (error) {
      console.error('Error getting access token:', error)
      throw new Error(`Failed to get access token: ${error.message}`)
    }
  }

  async sendAIResponseEmail(ticket, aiResponse) {
    try {
      // EMERGENCY KILL SWITCH - Disable all email sending
      if (process.env.EMAIL_SENDING_DISABLED === 'true') {
        console.log('🛑 EMAIL SENDING DISABLED - Skipping email for ticket', ticket.ticketNumber)
        return { skipped: true, reason: 'Email sending disabled by admin' }
      }

      if (!ticket.emailConversationId) {
        console.log('Ticket was not created from email, skipping email reply')
        return { skipped: true, reason: 'Not an email ticket' }
      }

      const accessToken = await this.getAccessToken()

      // Get recent emails to find the one with matching conversationId
      const emailsResponse = await fetch(
        `https://graph.microsoft.com/v1.0/users/${this.helpdeskEmail}/mailFolders/inbox/messages?$top=50&$orderby=receivedDateTime desc&$select=id,conversationId,subject,from,receivedDateTime`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      )

      if (!emailsResponse.ok) {
        const error = await emailsResponse.text()
        throw new Error(`Failed to fetch emails: ${error}`)
      }

      const emailsData = await emailsResponse.json()

      // Find the email with matching conversationId
      const originalEmail = emailsData.value?.find(
        email => email.conversationId === ticket.emailConversationId
      )

      if (!originalEmail) {
        throw new Error(`Original email not found for conversationId: ${ticket.emailConversationId}`)
      }

      // Convert markdown to HTML
      const htmlContent = marked.parse(aiResponse)
      const footerHTML = `<hr><p style="color: #666; font-size: 12px;">Ticket: ${ticket.ticketNumber}<br>AidIN Helpdesk System - Powered by AI</p>`

      // Build subject line with ticket number for reply tracking
      // Format: "RE: Original Subject [Ticket #IT000048]"
      const originalSubject = originalEmail.subject || ticket.title
      let replySubject = originalSubject

      // Check if ticket number is already in subject
      if (!originalSubject.includes(ticket.ticketNumber)) {
        // Add ticket number in format that's easy to extract
        replySubject = `RE: ${originalSubject} [Ticket #${ticket.ticketNumber}]`
      } else if (!originalSubject.startsWith('RE:')) {
        replySubject = `RE: ${originalSubject}`
      }

      // Send reply using Microsoft Graph API
      const replyResponse = await fetch(
        `https://graph.microsoft.com/v1.0/users/${this.helpdeskEmail}/messages/${originalEmail.id}/reply`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: {
              subject: replySubject,
              body: {
                contentType: 'HTML',
                content: htmlContent + footerHTML
              }
            }
          })
        }
      )

      if (!replyResponse.ok) {
        const error = await replyResponse.text()
        throw new Error(`Failed to send email reply: ${error}`)
      }

      console.log(`✅ AI response email sent for ticket ${ticket.ticketNumber}`)

      return {
        success: true,
        ticketNumber: ticket.ticketNumber,
        message: 'AI response email sent successfully'
      }
    } catch (error) {
      console.error('Error sending AI response email:', error)
      throw error
    }
  }

  async sendTicketCreatedEmail(ticket, requesterEmail) {
    try {
      // EMERGENCY KILL SWITCH - Disable all email sending
      if (process.env.EMAIL_SENDING_DISABLED === 'true') {
        console.log('🛑 EMAIL SENDING DISABLED - Skipping ticket created email')
        return { skipped: true, reason: 'Email sending disabled by admin' }
      }

      const accessToken = await this.getAccessToken()
      const baseUrl = process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3011}`
      const ticketUrl = `${baseUrl}/tickets/${ticket.id}`

      // Professional HTML email template
      const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f5f5f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" border="0" width="600" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Support Ticket Created</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #333333;">
                Your support request has been successfully received and a ticket has been created.
              </p>

              <!-- Ticket Info Box -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f8f9fa; border-left: 4px solid #667eea; margin: 30px 0; border-radius: 4px;">
                <tr>
                  <td style="padding: 20px;">
                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td style="padding-bottom: 12px;">
                          <strong style="color: #667eea; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Ticket Number</strong><br>
                          <span style="font-size: 24px; font-weight: 700; color: #333333;">${ticket.ticketNumber}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-bottom: 12px;">
                          <strong style="color: #667eea; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Subject</strong><br>
                          <span style="font-size: 16px; color: #333333;">${ticket.title}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-bottom: 12px;">
                          <strong style="color: #667eea; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Priority</strong><br>
                          <span style="font-size: 16px; color: #333333; text-transform: capitalize;">${ticket.priority}</span>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <strong style="color: #667eea; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Status</strong><br>
                          <span style="font-size: 16px; color: #333333; text-transform: capitalize;">${ticket.status}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin: 30px 0 30px 0; font-size: 16px; line-height: 1.6; color: #333333;">
                Our support team will review your request and respond as soon as possible. You can track the progress of your ticket anytime by clicking the button below.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding: 10px 0 30px 0;">
                    <a href="${ticketUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
                      View Ticket
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0 0 0; font-size: 14px; line-height: 1.6; color: #666666; border-top: 1px solid #e5e5e5; padding-top: 20px;">
                <strong>Note:</strong> Please reference ticket number <strong>${ticket.ticketNumber}</strong> in any future correspondence regarding this issue.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 10px 0; font-size: 16px; font-weight: 600; color: #333333;">
                AidIN<br>
                <span style="font-weight: 400; color: #666666;">Surterre Properties</span>
              </p>
              <p style="margin: 0; font-size: 12px; color: #999999;">
                This is an automated message from the AidIN Helpdesk System<br>
                Powered by AI
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `

      const emailPayload = {
        message: {
          subject: `Support Ticket Created - ${ticket.ticketNumber}`,
          body: {
            contentType: 'HTML',
            content: htmlBody
          },
          toRecipients: [
            {
              emailAddress: {
                address: requesterEmail
              }
            }
          ]
        },
        saveToSentItems: true
      }

      const response = await fetch(
        `https://graph.microsoft.com/v1.0/users/${this.helpdeskEmail}/sendMail`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(emailPayload)
        }
      )

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Failed to send ticket created email: ${error}`)
      }

      console.log(`✅ Ticket created email sent to ${requesterEmail} for ticket ${ticket.ticketNumber}`)

      return {
        success: true,
        ticketNumber: ticket.ticketNumber,
        message: 'Ticket created email sent successfully'
      }
    } catch (error) {
      console.error('Error sending ticket created email:', error)
      throw error
    }
  }

  async sendEmail(to, subject, body, replyToMessageId = null, isHTML = true) {
    try {
      // EMERGENCY KILL SWITCH - Disable all email sending
      if (process.env.EMAIL_SENDING_DISABLED === 'true') {
        console.log('🛑 EMAIL SENDING DISABLED - Skipping email to', to)
        return { skipped: true, reason: 'Email sending disabled by admin' }
      }

      const accessToken = await this.getAccessToken()

      const emailPayload = {
        message: {
          subject,
          body: {
            contentType: isHTML ? 'HTML' : 'Text',
            content: body
          },
          toRecipients: [
            {
              emailAddress: {
                address: to
              }
            }
          ]
        },
        saveToSentItems: true
      }

      const endpoint = replyToMessageId
        ? `https://graph.microsoft.com/v1.0/users/${this.helpdeskEmail}/messages/${replyToMessageId}/reply`
        : `https://graph.microsoft.com/v1.0/users/${this.helpdeskEmail}/sendMail`

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailPayload)
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Failed to send email: ${error}`)
      }

      return { success: true, message: 'Email sent successfully' }
    } catch (error) {
      console.error('Error sending email:', error)
      throw error
    }
  }
}

// Singleton instance
let emailServiceInstance = null

export function getEmailService() {
  if (!emailServiceInstance) {
    emailServiceInstance = new EmailService()
  }
  return emailServiceInstance
}

export default EmailService
