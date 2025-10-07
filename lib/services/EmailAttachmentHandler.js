import { AttachmentService } from './AttachmentService.js'
import { ConfidentialClientApplication } from '@azure/msal-node'

/**
 * EmailAttachmentHandler - Downloads attachments from Microsoft Graph and saves them to tickets
 */
export class EmailAttachmentHandler {
  constructor() {
    this.msalConfig = {
      auth: {
        clientId: process.env.MICROSOFT_CLIENT_ID,
        authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}`,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      }
    }

    this.msalClient = new ConfidentialClientApplication(this.msalConfig)
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
      throw error
    }
  }

  /**
   * Get email message details including attachment info
   */
  async getEmailDetails(messageId, userEmail = 'helpdesk@surterreproperties.com') {
    try {
      const accessToken = await this.getAccessToken()

      const response = await fetch(
        `https://graph.microsoft.com/v1.0/users/${userEmail}/messages/${messageId}?$select=id,subject,hasAttachments`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        throw new Error(`Failed to get email details: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error getting email details:', error)
      throw error
    }
  }

  /**
   * Get all attachments for an email (includes both file attachments and inline images)
   */
  async getEmailAttachments(messageId, userEmail = 'helpdesk@surterreproperties.com') {
    try {
      const accessToken = await this.getAccessToken()

      const response = await fetch(
        `https://graph.microsoft.com/v1.0/users/${userEmail}/messages/${messageId}/attachments`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        throw new Error(`Failed to get attachments: ${response.statusText}`)
      }

      const data = await response.json()
      return data.value || []
    } catch (error) {
      console.error('Error getting email attachments:', error)
      throw error
    }
  }

  /**
   * Get email body to check for inline images
   */
  async getEmailBody(messageId, userEmail = 'helpdesk@surterreproperties.com') {
    try {
      const accessToken = await this.getAccessToken()

      const response = await fetch(
        `https://graph.microsoft.com/v1.0/users/${userEmail}/messages/${messageId}?$select=body,hasAttachments`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        throw new Error(`Failed to get email body: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error getting email body:', error)
      throw error
    }
  }

  /**
   * Process and save email attachments to a ticket
   * @param {string} messageId - Microsoft Graph message ID
   * @param {string} ticketId - Ticket UUID
   * @param {string} userId - User ID who sent the email (requester)
   * @param {string} userEmail - Mailbox email address
   * @returns {Promise<Array>} Array of created attachments
   */
  async processEmailAttachments(messageId, ticketId, userId, userEmail = 'helpdesk@surterreproperties.com') {
    try {
      console.log(`[EmailAttachments] Processing attachments for message ${messageId}, ticket ${ticketId}`)

      // Get email details to check if it has attachments
      const emailDetails = await this.getEmailDetails(messageId, userEmail)

      if (!emailDetails.hasAttachments) {
        console.log(`[EmailAttachments] No attachments found for message ${messageId}`)
        return []
      }

      // Get all attachments
      const attachments = await this.getEmailAttachments(messageId, userEmail)
      console.log(`[EmailAttachments] Found ${attachments.length} attachment(s)`)

      const savedAttachments = []

      for (const attachment of attachments) {
        try {
          // Process file attachments (includes both regular attachments and inline images)
          if (attachment['@odata.type'] !== '#microsoft.graph.fileAttachment') {
            console.log(`[EmailAttachments] Skipping non-file attachment: ${attachment.name}`)
            continue
          }

          // Process inline images (isInline = true) as well as regular attachments
          const isInline = attachment.isInline || false
          const attachmentType = isInline ? 'inline image' : 'file attachment'

          // Check file size (Graph API returns size in bytes)
          if (attachment.size > AttachmentService.MAX_FILE_SIZE) {
            console.warn(`[EmailAttachments] ${attachmentType} ${attachment.name} exceeds size limit (${attachment.size} bytes)`)
            continue
          }

          // Validate MIME type
          const validation = AttachmentService.validateFile({
            name: attachment.name || `inline-image-${Date.now()}.png`,
            size: attachment.size,
            type: attachment.contentType
          })

          if (!validation.valid) {
            console.warn(`[EmailAttachments] ${attachmentType} ${attachment.name} validation failed: ${validation.errors.join(', ')}`)
            continue
          }

          // Decode base64 content
          const contentBytes = Buffer.from(attachment.contentBytes, 'base64')

          // Create a File-like object for AttachmentService
          const file = {
            name: attachment.name || `inline-image-${Date.now()}.png`,
            size: attachment.size,
            type: attachment.contentType,
            arrayBuffer: async () => contentBytes
          }

          // Save attachment using AttachmentService
          const savedAttachment = await AttachmentService.uploadAttachment(file, ticketId, userId)

          savedAttachments.push(savedAttachment)
          console.log(`[EmailAttachments] ✅ Saved ${attachmentType}: ${attachment.name} (${attachment.size} bytes)${isInline ? ' [INLINE]' : ''}`)

        } catch (error) {
          console.error(`[EmailAttachments] Failed to process attachment ${attachment.name}:`, error)
          // Continue with other attachments
        }
      }

      console.log(`[EmailAttachments] Successfully saved ${savedAttachments.length} of ${attachments.length} attachment(s)`)
      return savedAttachments

    } catch (error) {
      console.error('[EmailAttachments] Error processing email attachments:', error)
      // Don't throw - attachments are optional, ticket creation should succeed
      return []
    }
  }

  /**
   * Extract message ID from Graph notification resource URL
   * @param {string} resource - Resource URL from webhook notification
   * @returns {string|null} Message ID
   */
  static extractMessageId(resource) {
    // Resource format: users/{userEmail}/mailFolders/{folderId}/messages/{messageId}
    const match = resource.match(/messages\/([^/]+)$/)
    return match ? match[1] : null
  }
}

export default EmailAttachmentHandler
