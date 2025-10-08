/**
 * AI Classification Service
 * Phase 2 Scaffold
 */

import { LLMProvider, ClassifyResult } from './domain'

export async function classify(provider: LLMProvider, input: string): Promise<ClassifyResult> {
  return provider.classify(input)
}
