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

  async sendEmail(to, subject, body, replyToMessageId = null) {
    try {
      const accessToken = await this.getAccessToken()

      const emailPayload = {
        message: {
          subject,
          body: {
            contentType: 'Text',
            content: body
          },
          toRecipients: [
            {
              emailAddress: {
                address: to
              }
            }
          ]
        }
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
