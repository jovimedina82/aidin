/**
 * Application Configuration
 * Phase 5: AI provider configuration
 */

export const config = {
  /**
   * AI Provider Selection
   * Supported: "openai", "anthropic"
   * Default: "openai"
   */
  AI_PROVIDER: (process.env.AI_PROVIDER || 'openai') as 'openai' | 'anthropic',

  /**
   * OpenAI Configuration
   */
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',

  /**
   * Anthropic Configuration (future)
   */
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',

  /**
   * AI Model Defaults
   */
  AI_CLASSIFY_MODEL: process.env.AI_CLASSIFY_MODEL || 'gpt-4o-mini',
  AI_RESPOND_MODEL: process.env.AI_RESPOND_MODEL || 'gpt-4o-mini',

  /**
   * Validation
   */
  validate() {
    if (this.AI_PROVIDER === 'openai' && !this.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required when AI_PROVIDER=openai')
    }
    if (this.AI_PROVIDER === 'anthropic' && !this.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is required when AI_PROVIDER=anthropic')
    }
  },
}
