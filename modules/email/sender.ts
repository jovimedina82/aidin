/**
 * Email Sender - Provider Selection and Sending
 * Phase 6: Provider abstraction
 */

import { config } from '@/lib/config'
import { smtpProvider } from './provider/smtp'
import { graphProvider } from './provider/graph'
import type { EmailProvider } from './provider'
import type { EmailMessage, SendResult, EmailAttachment } from './domain'

/**
 * Select email provider based on configuration
 */
export function selectProvider(): EmailProvider {
  const provider = config.EMAIL_PROVIDER

  switch (provider) {
    case 'smtp':
      return smtpProvider({
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        user: config.SMTP_USER,
        pass: config.SMTP_PASS,
      })
    case 'graph':
      return graphProvider({
        tenantId: config.GRAPH_TENANT_ID,
        clientId: config.GRAPH_CLIENT_ID,
        clientSecret: config.GRAPH_CLIENT_SECRET,
        webhookSecret: config.GRAPH_WEBHOOK_SECRET,
      })
    default:
      throw new Error(`Unknown email provider: ${provider}`)
  }
}

/**
 * Send email using configured provider
 */
export async function send(message: EmailMessage): Promise<SendResult> {
  const provider = selectProvider()
  return await provider.send(message)
}

// ============================================================================
// Legacy exports for backward compatibility (Phase 2)
// ============================================================================

export type { EmailAttachment }

export interface LegacyEmailProvider {
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
export class NoopEmailProvider implements LegacyEmailProvider {
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
