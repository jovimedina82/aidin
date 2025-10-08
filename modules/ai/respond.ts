/**
 * AI Response Generation Service
 * Phase 2 Scaffold
 */

import { LLMProvider, RespondResult } from './domain'

export async function respond(provider: LLMProvider, ticket: any): Promise<RespondResult> {
  return provider.respond(ticket)
}
