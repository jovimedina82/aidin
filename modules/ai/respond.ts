/**
 * AI Respond Orchestration
 * Phase 5: Thin wrapper over provider.respond()
 */

import { config } from '@/lib/config'
import { selectProvider } from './provider'
import type { RespondInput, RespondOptions, RespondResult, LLMProvider } from './domain'

/**
 * Generate response for ticket using configured AI provider
 */
export async function respond(
  input: RespondInput,
  opts?: RespondOptions
): Promise<RespondResult> {
  // Select provider based on config
  const provider = selectProvider(config.AI_PROVIDER, {
    apiKey:
      config.AI_PROVIDER === 'openai' ? config.OPENAI_API_KEY : config.ANTHROPIC_API_KEY,
    respondModel: config.AI_RESPOND_MODEL,
  })

  // Delegate to provider
  return await provider.respond(input, opts)
}

// ============================================================================
// Legacy function (Phase 2 compatibility)
// ============================================================================

export async function respondLegacy(provider: LLMProvider, ticket: any): Promise<RespondResult> {
  return provider.respond(ticket)
}
