/**
 * AI Domain Types and Provider Interface
 * Phase 2 Scaffold
 */

export interface ClassifyResult {
  category: string
  confidence: number
  reasoning?: string
}

export interface RespondResult {
  response: string
  confidence: number
  reasoning?: string
}

export interface LLMProvider {
  classify(input: string): Promise<ClassifyResult>
  respond(ticket: any): Promise<RespondResult>
}
