/**
 * Anthropic (Claude) Provider Implementation
 * Phase 5: Stub implementation with same interface as OpenAI
 */

import type {
  Provider,
  ClassifyInput,
  ClassifyOptions,
  ClassifyResult,
  RespondInput,
  RespondOptions,
  RespondResult,
  LLMProvider,
} from '../domain'

/**
 * Create Anthropic provider instance (stub)
 * TODO: Implement real Anthropic SDK integration when needed
 */
export function anthropicProvider(config: {
  apiKey: string
  classifyModel?: string
  respondModel?: string
}): Provider {
  return {
    name: 'anthropic',

    async classify(input: ClassifyInput, opts?: ClassifyOptions): Promise<ClassifyResult> {
      // Stub implementation - same interface as OpenAI
      console.warn('Anthropic provider not yet implemented, using fallback')

      return {
        category: 'General',
        confidence: 0.5,
        reasoning: 'Anthropic provider not yet implemented',
      }
    },

    async respond(input: RespondInput, opts?: RespondOptions): Promise<RespondResult> {
      // Stub implementation - same interface as OpenAI
      console.warn('Anthropic provider not yet implemented, using fallback')

      return {
        response: `Thank you for reaching out regarding "${input.ticketTitle}". I've received your ticket and will review the details you've provided.\n\nI'll investigate this issue and get back to you with a solution or additional questions if needed.\n\nBest regards,\nAiden`,
        confidence: 0.5,
        reasoning: 'Anthropic provider not yet implemented',
      }
    },
  }
}

// ============================================================================
// Legacy LLMProvider compatibility (Phase 2)
// ============================================================================

export class AnthropicProvider implements LLMProvider {
  async classify(input: string): Promise<ClassifyResult> {
    throw new Error('NotImplemented: Use anthropicProvider() factory function instead - Phase 5')
  }

  async respond(ticket: any): Promise<RespondResult> {
    throw new Error('NotImplemented: Use anthropicProvider() factory function instead - Phase 5')
  }
}
