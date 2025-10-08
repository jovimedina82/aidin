/**
 * AI Domain Types and Provider Interface
 * Phase 5: Provider abstraction
 */

// ============================================================================
// Provider Interface
// ============================================================================

export interface Provider {
  name: string
  classify(input: ClassifyInput, opts?: ClassifyOptions): Promise<ClassifyResult>
  respond(input: RespondInput, opts?: RespondOptions): Promise<RespondResult>
}

// ============================================================================
// Input DTOs
// ============================================================================

export interface ClassifyInput {
  title: string
  description: string
}

export interface RespondInput {
  ticketId: string
  ticketTitle: string
  ticketDescription: string
  ticketCategory?: string
  ticketPriority?: string
}

// ============================================================================
// Options
// ============================================================================

export interface ClassifyOptions {
  model?: string
  temperature?: number
  maxTokens?: number
}

export interface RespondOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  tone?: 'formal' | 'friendly' | 'technical'
}

// ============================================================================
// Result DTOs
// ============================================================================

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

// ============================================================================
// Legacy Interface (Phase 2 compatibility)
// ============================================================================

export interface LLMProvider {
  classify(input: string): Promise<ClassifyResult>
  respond(ticket: any): Promise<RespondResult>
}
