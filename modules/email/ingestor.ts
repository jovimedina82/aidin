/**
 * Email Ingestor - Webhook Validation and Email Parsing
 * Phase 6: Safe wiring with validation
 */

import { config } from '@/lib/config'
import { validateWebhookSecret } from './provider/graph'
import type { InboundEmail, IngestResult, WebhookValidation } from './domain'

/**
 * Validate inbound webhook request
 * Enforces INBOUND_EMAIL_ENABLED and GRAPH_WEBHOOK_SECRET
 */
export function validateInboundWebhook(
  clientState: string | undefined
): WebhookValidation {
  // Check if inbound email is enabled
  if (!config.INBOUND_EMAIL_ENABLED) {
    return { valid: false, error: 'Inbound email processing is disabled' }
  }

  // Validate webhook secret using constant-time comparison (Phase 0.1)
  const expectedSecret = config.GRAPH_WEBHOOK_SECRET
  if (!expectedSecret) {
    return { valid: false, error: 'Webhook secret not configured' }
  }

  return validateWebhookSecret(clientState, expectedSecret)
}

/**
 * Parse webhook payload to extract email metadata
 * Phase 6: Minimal parsing, delegates actual ticket creation to existing logic
 */
export function parseWebhookPayload(payload: any): {
  notifications: Array<{
    resourceData?: any
    changeType?: string
    resource?: string
  }>
} {
  return {
    notifications: payload.value || [],
  }
}

// ============================================================================
// Legacy exports for backward compatibility (Phase 2)
// ============================================================================

export interface InboundEmailData {
  from: string
  to: string
  subject: string
  body: string
  attachments?: Array<{
    filename: string
    content: Buffer
    contentType: string
  }>
  receivedAt: Date
}

export async function processInboundEmail(emailData: InboundEmailData): Promise<void> {
  throw new Error('NotImplemented: processInboundEmail() - Phase 3')
}
