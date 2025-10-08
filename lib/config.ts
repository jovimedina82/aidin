/**
 * Phase 10 RC1: Environment Configuration with Validation
 * Centralized config with Zod validation
 */

import { z } from 'zod'

/**
 * Environment configuration schema
 */
const configSchema = z.object({
  // Core
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),

  // Security
  ALLOWED_ORIGINS: z.string().optional(),

  // Features
  AUTO_ASSIGN_ENABLED: z.boolean().default(false),
  INBOUND_EMAIL_ENABLED: z.boolean().default(false),
  ENABLE_PUBLIC_REGISTRATION: z.boolean().default(false),

  // Webhooks
  N8N_WEBHOOK_SECRET: z.string().optional(),
  GRAPH_WEBHOOK_SECRET: z.string().optional(),

  // AI Provider
  AI_PROVIDER: z.enum(['openai', 'anthropic']).default('openai'),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),

  // Email Provider
  EMAIL_PROVIDER: z.enum(['smtp', 'graph']).default('smtp'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),

  // Microsoft Graph
  GRAPH_TENANT_ID: z.string().optional(),
  GRAPH_CLIENT_ID: z.string().optional(),
  GRAPH_CLIENT_SECRET: z.string().optional(),
})

/**
 * Parse and validate environment configuration
 */
function parseConfig() {
  const raw = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    JWT_SECRET: process.env.JWT_SECRET || '',
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
    AUTO_ASSIGN_ENABLED: process.env.AUTO_ASSIGN_ENABLED === 'true',
    INBOUND_EMAIL_ENABLED: process.env.INBOUND_EMAIL_ENABLED === 'true',
    ENABLE_PUBLIC_REGISTRATION: process.env.ENABLE_PUBLIC_REGISTRATION === 'true',
    N8N_WEBHOOK_SECRET: process.env.N8N_WEBHOOK_SECRET,
    GRAPH_WEBHOOK_SECRET: process.env.GRAPH_WEBHOOK_SECRET,
    AI_PROVIDER: process.env.AI_PROVIDER || 'openai',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER || 'smtp',
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    GRAPH_TENANT_ID: process.env.GRAPH_TENANT_ID,
    GRAPH_CLIENT_ID: process.env.GRAPH_CLIENT_ID,
    GRAPH_CLIENT_SECRET: process.env.GRAPH_CLIENT_SECRET,
  }

  const result = configSchema.safeParse(raw)

  if (!result.success) {
    console.error('❌ Configuration validation failed:')
    result.error.errors.forEach((err) => {
      console.error(`  - ${err.path.join('.')}: ${err.message}`)
    })
    throw new Error('Invalid configuration. Check environment variables.')
  }

  return result.data
}

/**
 * Validated configuration singleton
 */
export const config = parseConfig()

/**
 * Log startup configuration (dev only, redacted)
 */
if (config.NODE_ENV === 'development') {
  console.log('🔧 Configuration:')
  console.log(`   AI Provider: ${config.AI_PROVIDER}`)
  console.log(`   Email Provider: ${config.EMAIL_PROVIDER}`)
  console.log(`   Auto-Assign: ${config.AUTO_ASSIGN_ENABLED ? 'enabled' : 'disabled'}`)
  console.log(`   Inbound Email: ${config.INBOUND_EMAIL_ENABLED ? 'enabled' : 'disabled'}`)
  console.log(`   Public Registration: ${config.ENABLE_PUBLIC_REGISTRATION ? 'enabled' : 'disabled'}`)
  console.log(`   CORS Origins: ${config.ALLOWED_ORIGINS || '(same-origin only)'}`)
}

/**
 * Get the base URL for the application
 * Sanitizes 0.0.0.0 and :: to localhost for browser compatibility
 */
export function getBaseUrl(req?: Request): string {
  // 1) Explicit env wins
  const envUrl =
    process.env.BASE_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_BASE_URL

  if (envUrl) {
    return envUrl
      .replace('0.0.0.0', 'localhost')
      .replace('::', 'localhost')
  }

  // 2) Infer from request headers in middleware/route handlers
  if (req) {
    try {
      const url = new URL(req.url)
      let host = url.host || ''
      // Some dev setups bind to 0.0.0.0 — browsers can't resolve that
      host = host.replace('0.0.0.0', 'localhost').replace('::', 'localhost')
      const proto = url.protocol && url.protocol.endsWith(':')
        ? url.protocol.slice(0, -1)
        : 'http'
      return `${proto}://${host}`
    } catch {
      // Fall through
    }
  }

  // 3) Fallback
  return 'http://localhost:3000'
}
