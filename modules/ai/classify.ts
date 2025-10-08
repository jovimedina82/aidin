/**
 * AI Classify Orchestration
 * Phase 5: Thin wrapper over provider.classify()
 */

import { config } from '@/lib/config'
import { selectProvider } from './provider'
import type { ClassifyInput, ClassifyOptions, ClassifyResult, LLMProvider } from './domain'

/**
 * Classify ticket using configured AI provider
 */
export async function classify(
  input: ClassifyInput,
  opts?: ClassifyOptions
): Promise<ClassifyResult> {
  // Select provider based on config
  const provider = selectProvider(config.AI_PROVIDER, {
    apiKey:
      config.AI_PROVIDER === 'openai' ? config.OPENAI_API_KEY : config.ANTHROPIC_API_KEY,
    classifyModel: config.AI_CLASSIFY_MODEL,
  })

  // Delegate to provider
  return await provider.classify(input, opts)
}

// ============================================================================
// Legacy function (Phase 2 compatibility)
// ============================================================================

export async function classifyLegacy(provider: LLMProvider, input: string): Promise<ClassifyResult> {
  return provider.classify(input)
}
