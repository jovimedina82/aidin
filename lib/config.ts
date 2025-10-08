/**
 * Application Configuration
 * Phase 5: AI provider configuration
 * Phase 6: Email provider configuration
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
   * Email Provider Selection
   * Supported: "smtp", "graph"
   * Default: "smtp"
   */
  EMAIL_PROVIDER: (process.env.EMAIL_PROVIDER || 'smtp') as 'smtp' | 'graph',

  /**
   * SMTP Configuration
   */
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',

  /**
   * Microsoft Graph Configuration
   */
  GRAPH_TENANT_ID: process.env.GRAPH_TENANT_ID || '',
  GRAPH_CLIENT_ID: process.env.GRAPH_CLIENT_ID || '',
  GRAPH_CLIENT_SECRET: process.env.GRAPH_CLIENT_SECRET || '',
  GRAPH_WEBHOOK_SECRET: process.env.GRAPH_WEBHOOK_SECRET || '',

  /**
   * Inbound Email Configuration
   */
  INBOUND_EMAIL_ENABLED: process.env.INBOUND_EMAIL_ENABLED === 'true',

  /**
   * Tickets Workflow Configuration
   * Phase 8: Auto-assignment feature flag
   */
  AUTO_ASSIGN_ENABLED: process.env.AUTO_ASSIGN_ENABLED === 'true',

  /**
   * Validation
   */
  validate() {
    // AI validation
    if (this.AI_PROVIDER === 'openai' && !this.OPENAI_API_KEY) {
      console.warn('Warning: OPENAI_API_KEY is not set')
    }
    if (this.AI_PROVIDER === 'anthropic' && !this.ANTHROPIC_API_KEY) {
      console.warn('Warning: ANTHROPIC_API_KEY is not set')
    }

    // Email validation
    if (this.EMAIL_PROVIDER === 'smtp' && !this.SMTP_HOST) {
      console.warn('Warning: SMTP_HOST is not set')
    }
    if (this.EMAIL_PROVIDER === 'graph' && !this.GRAPH_CLIENT_ID) {
      console.warn('Warning: GRAPH_CLIENT_ID is not set')
    }
    if (this.INBOUND_EMAIL_ENABLED && !this.GRAPH_WEBHOOK_SECRET) {
      console.warn('Warning: GRAPH_WEBHOOK_SECRET is required when INBOUND_EMAIL_ENABLED=true')
    }
  },
}
