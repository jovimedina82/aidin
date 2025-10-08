import { z } from 'zod'

/**
 * Centralized configuration with Zod validation
 * Validates environment variables at startup
 */

const configSchema = z.object({
  // Required configuration
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  APP_BASE_URL: z.string().url('APP_BASE_URL must be a valid URL'),

  // Optional provider configuration (warn if missing, not fatal)
  OPENAI_API_KEY: z.string().optional(),
  AZURE_TENANT_ID: z.string().optional(),
  AZURE_CLIENT_ID: z.string().optional(),
  AZURE_CLIENT_SECRET: z.string().optional(),

  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

export type Config = z.infer<typeof configSchema>

/**
 * Validates and loads configuration from environment variables
 * Throws error if required variables are missing or invalid
 */
function loadConfig(): Config {
  try {
    const config = configSchema.parse({
      DATABASE_URL: process.env.DATABASE_URL,
      APP_BASE_URL: process.env.APP_BASE_URL,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      AZURE_TENANT_ID: process.env.AZURE_TENANT_ID,
      AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID,
      AZURE_CLIENT_SECRET: process.env.AZURE_CLIENT_SECRET,
      NODE_ENV: process.env.NODE_ENV,
    })

    // Warn about missing optional configuration
    const optionalKeys = [
      'OPENAI_API_KEY',
      'AZURE_TENANT_ID',
      'AZURE_CLIENT_ID',
      'AZURE_CLIENT_SECRET',
    ] as const

    optionalKeys.forEach((key) => {
      if (!config[key]) {
        console.warn(`[Config] Optional environment variable ${key} is not set`)
      }
    })

    return config
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[Config] Invalid configuration:')
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`)
      })
      throw new Error('Configuration validation failed')
    }
    throw error
  }
}

// Singleton config instance
export const config = loadConfig()
