/**
 * Phase 10 RC1: Smoke Tests
 * Golden path validation for critical functionality
 */

import { describe, it, expect } from 'vitest'

describe('RC1 Smoke Tests', () => {
  describe('Module Imports', () => {
    it('should import security middleware modules', () => {
      const { applySecurityHeaders } = require('@/lib/http/security')
      const { checkRateLimit } = require('@/lib/http/ratelimit')
      const { handleApiError } = require('@/lib/http/errors')

      expect(applySecurityHeaders).toBeInstanceOf(Function)
      expect(checkRateLimit).toBeInstanceOf(Function)
      expect(handleApiError).toBeInstanceOf(Function)
    })

    it('should import config with validation', () => {
      const { config } = require('@/lib/config')

      expect(config).toBeDefined()
      expect(config.NODE_ENV).toBeDefined()
      expect(config.JWT_SECRET).toBeDefined()
    })
  })

  describe('Security Headers', () => {
    it('should apply all security headers', () => {
      const { applySecurityHeaders } = require('@/lib/http/security')
      const { NextResponse } = require('next/server')

      const response = applySecurityHeaders(new NextResponse())

      expect(response.headers.get('Strict-Transport-Security')).toContain('max-age=15552000')
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
      expect(response.headers.get('X-Frame-Options')).toBe('DENY')
      expect(response.headers.get('Referrer-Policy')).toBe('no-referrer')
      expect(response.headers.get('Permissions-Policy')).toContain('geolocation=()')
    })
  })

  describe('Rate Limiting', () => {
    it('should allow requests within limit', () => {
      const { checkRateLimit, clearRateLimits } = require('@/lib/http/ratelimit')

      clearRateLimits()

      const result = checkRateLimit('127.0.0.1', '/api/test')

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBeGreaterThan(0)
    })

    it('should block requests exceeding limit', () => {
      const { checkRateLimit, clearRateLimits, DEFAULT_RATE_LIMIT } = require('@/lib/http/ratelimit')

      clearRateLimits()

      // Exhaust limit
      for (let i = 0; i < DEFAULT_RATE_LIMIT.maxRequests; i++) {
        checkRateLimit('127.0.0.2', '/api/test2')
      }

      // Next request should be blocked
      const result = checkRateLimit('127.0.0.2', '/api/test2')

      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
    })
  })

  describe('Error Model', () => {
    it('should create standardized error response', () => {
      const { createErrorResponse, ErrorCode } = require('@/lib/http/errors')

      const response = createErrorResponse(
        ErrorCode.NOT_FOUND,
        'Resource not found',
        404
      )

      const json = response.json()

      expect(json).toHaveProperty('ok', false)
      expect(json).toHaveProperty('error')
      expect(json.error).toHaveProperty('code', ErrorCode.NOT_FOUND)
      expect(json.error).toHaveProperty('message', 'Resource not found')
    })

    it('should handle Zod validation errors', () => {
      const { handleApiError } = require('@/lib/http/errors')
      const { z } = require('zod')

      const schema = z.object({
        email: z.string().email(),
      })

      try {
        schema.parse({ email: 'invalid' })
      } catch (error) {
        const response = handleApiError(error)
        const json = response.json()

        expect(json.ok).toBe(false)
        expect(json.error.code).toBe('VALIDATION_ERROR')
      }
    })
  })

  describe('CORS Configuration', () => {
    it('should reject origins not in ALLOWED_ORIGINS', () => {
      const { isOriginAllowed } = require('@/lib/http/security')

      // No ALLOWED_ORIGINS set, should reject
      const allowed = isOriginAllowed('https://evil.com')

      expect(allowed).toBe(false)
    })

    it('should handle null origin', () => {
      const { isOriginAllowed } = require('@/lib/http/security')

      const allowed = isOriginAllowed(null)

      expect(allowed).toBe(false)
    })
  })

  describe('Config Validation', () => {
    it('should have required security config', () => {
      const { config } = require('@/lib/config')

      expect(config.JWT_SECRET).toBeDefined()
      expect(config.JWT_SECRET.length).toBeGreaterThanOrEqual(32)
    })

    it('should have feature flags', () => {
      const { config } = require('@/lib/config')

      expect(typeof config.AUTO_ASSIGN_ENABLED).toBe('boolean')
      expect(typeof config.INBOUND_EMAIL_ENABLED).toBe('boolean')
      expect(typeof config.ENABLE_PUBLIC_REGISTRATION).toBe('boolean')
    })

    it('should have provider configuration', () => {
      const { config } = require('@/lib/config')

      expect(config.AI_PROVIDER).toBeDefined()
      expect(['openai', 'anthropic']).toContain(config.AI_PROVIDER)

      expect(config.EMAIL_PROVIDER).toBeDefined()
      expect(['smtp', 'graph']).toContain(config.EMAIL_PROVIDER)
    })
  })
})
