/**
 * SMTP Email Provider
 * Phase 6: Stub implementation
 */

import type { EmailProvider } from './index'
import type { EmailMessage, SendResult } from '../domain'

export function smtpProvider(config: {
  host?: string
  port?: number
  user?: string
  pass?: string
}): EmailProvider {
  return {
    name: 'smtp',

    async send(message: EmailMessage): Promise<SendResult> {
      // Stub implementation - in production, use nodemailer
      console.log('[SMTPProvider] Would send email via SMTP:', {
        to: message.to,
        subject: message.subject,
        bodyLength: message.body.length,
      })

      // Return mock success
      return {
        success: true,
        id: `smtp-${Date.now()}`,
        messageId: `<${Date.now()}@smtp.local>`,
      }
    },
  }
}

// Legacy class for backward compatibility
export class SMTPProvider implements EmailProvider {
  name = 'smtp'

  async send(message: EmailMessage): Promise<SendResult> {
    return smtpProvider({}).send(message)
  }
}
