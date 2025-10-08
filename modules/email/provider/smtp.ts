/**
 * SMTP Email Provider
 * Phase 2 Scaffold - Phase 3 Implementation
 */

import { EmailProvider, EmailAttachment } from '../sender'

// TODO: Phase 3 - Add nodemailer dependency
// TODO: Phase 3 - Configure SMTP settings from environment variables

export class SMTPProvider implements EmailProvider {
  async send(
    to: string | string[],
    subject: string,
    body: string,
    attachments?: EmailAttachment[]
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    throw new Error('NotImplemented: SMTPProvider.send() - Phase 3')
  }
}
