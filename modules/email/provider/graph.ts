/**
 * Microsoft Graph Email Provider
 * Phase 6: Stub implementation with validation helpers
 */

import type { EmailProvider } from './index'
import type { EmailMessage, SendResult, WebhookValidation } from '../domain'
import { timingSafeEqual } from 'crypto'

export function graphProvider(config: {
  tenantId?: string
  clientId?: string
  clientSecret?: string
  webhookSecret?: string
}): EmailProvider {
  return {
    name: 'graph',

    async send(message: EmailMessage): Promise<SendResult> {
      // Stub implementation - in production, use Microsoft Graph SDK
      console.log('[GraphProvider] Would send email via Microsoft Graph:', {
        to: message.to,
        subject: message.subject,
        bodyLength: message.body.length,
      })

      // Return mock success
      return {
        success: true,
        id: `graph-${Date.now()}`,
        messageId: `<${Date.now()}@graph.microsoft.com>`,
      }
    },
  }
}

/**
 * Validate webhook clientState using constant-time comparison
 * Phase 0.1 security requirement
 */
export function validateWebhookSecret(
  receivedSecret: string | undefined,
  expectedSecret: string
): WebhookValidation {
  if (!receivedSecret) {
    return { valid: false, error: 'Missing clientState' }
  }

  try {
    // Constant-time comparison to prevent timing attacks
    const receivedBuf = Buffer.from(receivedSecret, 'utf8')
    const expectedBuf = Buffer.from(expectedSecret, 'utf8')

    if (receivedBuf.length !== expectedBuf.length) {
      return { valid: false, error: 'Invalid clientState' }
    }

    const valid = timingSafeEqual(receivedBuf, expectedBuf)
    return valid ? { valid: true } : { valid: false, error: 'Invalid clientState' }
  } catch (error) {
    return { valid: false, error: 'Validation error' }
  }
}

// Legacy class for backward compatibility
export class GraphEmailProvider implements EmailProvider {
  name = 'graph'

  async send(message: EmailMessage): Promise<SendResult> {
    return graphProvider({}).send(message)
  }
}
