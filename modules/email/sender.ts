/**
 * Email Sender and Provider Interface
 * Phase 2 Scaffold - Phase 3 Implementation
 */

export interface EmailAttachment {
  filename: string
  content: Buffer | string
  contentType?: string
}

export interface EmailProvider {
  send(
    to: string | string[],
    subject: string,
    body: string,
    attachments?: EmailAttachment[]
  ): Promise<{ success: boolean; messageId?: string; error?: string }>
}

/**
 * No-op Email Provider for development/testing
 * Returns success without actually sending emails
 */
export class NoopEmailProvider implements EmailProvider {
  async send(
    to: string | string[],
    subject: string,
    body: string,
    attachments?: EmailAttachment[]
  ): Promise<{ success: boolean; messageId?: string }> {
    console.log('[NoopEmailProvider] Would send email:', { to, subject, bodyLength: body.length })
    return { success: true, messageId: `noop-${Date.now()}` }
  }
}
