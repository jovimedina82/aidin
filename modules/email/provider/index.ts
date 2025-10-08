/**
 * Email Provider Interface
 * Phase 6: Provider abstraction
 */

import type { EmailMessage, SendResult } from '../domain'

export interface EmailProvider {
  name: string
  send(message: EmailMessage): Promise<SendResult>
}
