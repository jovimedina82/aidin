/**
 * Email Domain Types
 * Phase 6: Email provider abstraction
 */

export interface EmailAddress {
  email: string
  name?: string
}

export interface EmailAttachment {
  filename: string
  content: Buffer | string
  contentType?: string
}

export interface EmailMessage {
  to: string | string[] | EmailAddress | EmailAddress[]
  subject: string
  body: string
  from?: EmailAddress
  replyTo?: string
  attachments?: EmailAttachment[]
  html?: boolean
}

export interface SendResult {
  success: boolean
  id?: string
  messageId?: string
  error?: string
}

export interface ProviderError extends Error {
  code?: string
  statusCode?: number
  provider?: string
}

export interface InboundEmail {
  from: string
  to: string
  subject: string
  body: string
  html?: string
  attachments?: EmailAttachment[]
  receivedAt: Date
  headers?: Record<string, string>
}

export interface IngestResult {
  ticketId?: string
  commentId?: string
  isNewTicket: boolean
  attachments?: string[]
  error?: string
}

export interface WebhookValidation {
  valid: boolean
  error?: string
}
