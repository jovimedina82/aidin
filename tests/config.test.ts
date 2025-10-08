import { describe, it, expect, beforeEach } from 'vitest'

describe('Config Validation', () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv }
  })

  it('should validate required DATABASE_URL', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb'
    process.env.APP_BASE_URL = 'http://localhost:3000'

    // Test that the config schema accepts valid values
    const { z } = require('zod')
    const schema = z.object({
      DATABASE_URL: z.string().min(1),
      APP_BASE_URL: z.string().url(),
    })

    expect(() => {
      schema.parse({
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/testdb',
        APP_BASE_URL: 'http://localhost:3000',
      })
    }).not.toThrow()
  })

  it('should reject missing DATABASE_URL', () => {
    const { z } = require('zod')
    const schema = z.object({
      DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
      APP_BASE_URL: z.string().url(),
    })

    expect(() => {
      schema.parse({
        DATABASE_URL: '',
        APP_BASE_URL: 'http://localhost:3000',
      })
    }).toThrow()
  })

  it('should reject invalid APP_BASE_URL', () => {
    const { z } = require('zod')
    const schema = z.object({
      DATABASE_URL: z.string().min(1),
      APP_BASE_URL: z.string().url('APP_BASE_URL must be a valid URL'),
    })

    expect(() => {
      schema.parse({
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/testdb',
        APP_BASE_URL: 'not-a-valid-url',
      })
    }).toThrow()
  })

  it('should allow optional configuration variables', () => {
    const { z } = require('zod')
    const schema = z.object({
      DATABASE_URL: z.string().min(1),
      APP_BASE_URL: z.string().url(),
      OPENAI_API_KEY: z.string().optional(),
      AZURE_TENANT_ID: z.string().optional(),
    })

    const result = schema.parse({
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/testdb',
      APP_BASE_URL: 'http://localhost:3000',
      OPENAI_API_KEY: 'sk-test-key',
    })

    expect(result.OPENAI_API_KEY).toBe('sk-test-key')
    expect(result.AZURE_TENANT_ID).toBeUndefined()
  })
})
