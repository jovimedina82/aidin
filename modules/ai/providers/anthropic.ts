/**
 * Anthropic (Claude) LLM Provider
 * Phase 2 Scaffold - Phase 3 Implementation
 */

import { LLMProvider, ClassifyResult, RespondResult } from '../domain'

// TODO: Phase 3 - Add @anthropic-ai/sdk dependency
// TODO: Phase 3 - Configure API key from environment variables
// TODO: Phase 3 - Implement prompt engineering for classification and response

export class AnthropicProvider implements LLMProvider {
  async classify(input: string): Promise<ClassifyResult> {
    throw new Error('NotImplemented: AnthropicProvider.classify() - Phase 3')
  }

  async respond(ticket: any): Promise<RespondResult> {
    throw new Error('NotImplemented: AnthropicProvider.respond() - Phase 3')
  }
}
