/**
 * AI Provider Selector
 * Phase 5: Selects appropriate provider based on configuration
 */

import type { Provider } from './domain'
import { openaiProvider } from './providers/openai'
import { anthropicProvider } from './providers/anthropic'

/**
 * Select AI provider based on configuration
 * @param providerName - "openai" or "anthropic"
 * @param config - Provider-specific configuration
 * @returns Provider instance
 */
export function selectProvider(
  providerName: 'openai' | 'anthropic',
  config: {
    apiKey: string
    classifyModel?: string
    respondModel?: string
  }
): Provider {
  switch (providerName) {
    case 'openai':
      return openaiProvider(config)
    case 'anthropic':
      return anthropicProvider(config)
    default:
      throw new Error(`Unknown AI provider: ${providerName}`)
  }
}
