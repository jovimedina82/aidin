/**
 * Phase 6 Tests: Email Module (Provider Abstraction + Safe Wiring)
 * Tests provider selection, sender, webhook validation with mocks
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as email from '@/modules/email'

// Mock the config module
vi.mock('@/lib/config', () => ({
  config: {
    EMAIL_PROVIDER: 'smtp',
    SMTP_HOST: 'smtp.test.com',
    SMTP_PORT: 587,
    SMTP_USER: 'test@test.com',
    SMTP_PASS: 'password',
    GRAPH_TENANT_ID: 'tenant-id',
    GRAPH_CLIENT_ID: 'client-id',
    GRAPH_CLIENT_SECRET: 'client-secret',
    GRAPH_WEBHOOK_SECRET: 'test-webhook-secret',
    INBOUND_EMAIL_ENABLED: true,
    validate: vi.fn(),
  },
}))

describe('Phase 6: Email Module', () => {
  describe('Domain Types', () => {
    it('should export EmailMessage type', () => {
      const message: email.EmailMessage = {
        to: 'test@test.com',
        subject: 'Test',
        body: 'Test body',
      }
      expect(message).toBeDefined()
    })

    it('should export SendResult type', () => {
      const result: email.SendResult = {
        success: true,
        id: 'test-123',
      }
      expect(result).toBeDefined()
    })

    it('should export WebhookValidation type', () => {
      const validation: email.WebhookValidation = {
        valid: true,
      }
      expect(validation).toBeDefined()
    })
  })

  describe('Provider Selection', () => {
    it('should select SMTP provider by default', () => {
      const provider = email.selectProvider()
      expect(provider.name).toBe('smtp')
    })

    it('should have send method', () => {
      const provider = email.selectProvider()
      expect(typeof provider.send).toBe('function')
    })
  })

  describe('SMTP Provider', () => {
    it('should send email and return success', async () => {
      const provider = email.smtpProvider({
        host: 'smtp.test.com',
        port: 587,
      })

      const result = await provider.send({
        to: 'test@test.com',
        subject: 'Test Email',
        body: 'This is a test',
      })

      expect(result.success).toBe(true)
      expect(result.id).toMatch(/^smtp-/)
      expect(result.messageId).toMatch(/@smtp.local>$/)
    })

    it('should handle array of recipients', async () => {
      const provider = email.smtpProvider({})

      const result = await provider.send({
        to: ['test1@test.com', 'test2@test.com'],
        subject: 'Test',
        body: 'Body',
      })

      expect(result.success).toBe(true)
    })
  })

  describe('Graph Provider', () => {
    it('should send email and return success', async () => {
      const provider = email.graphProvider({
        tenantId: 'tenant-id',
        clientId: 'client-id',
      })

      const result = await provider.send({
        to: 'test@test.com',
        subject: 'Test Email',
        body: 'This is a test',
      })

      expect(result.success).toBe(true)
      expect(result.id).toMatch(/^graph-/)
      expect(result.messageId).toMatch(/@graph.microsoft.com>$/)
    })
  })

  describe('Webhook Secret Validation', () => {
    it('should validate correct secret (constant-time comparison)', () => {
      const validation = email.validateWebhookSecret(
        'test-webhook-secret',
        'test-webhook-secret'
      )

      expect(validation.valid).toBe(true)
      expect(validation.error).toBeUndefined()
    })

    it('should reject incorrect secret', () => {
      const validation = email.validateWebhookSecret(
        'wrong-secret',
        'test-webhook-secret'
      )

      expect(validation.valid).toBe(false)
      expect(validation.error).toBe('Invalid clientState')
    })

    it('should reject missing secret', () => {
      const validation = email.validateWebhookSecret(
        undefined,
        'test-webhook-secret'
      )

      expect(validation.valid).toBe(false)
      expect(validation.error).toBe('Missing clientState')
    })

    it('should reject secrets of different lengths', () => {
      const validation = email.validateWebhookSecret(
        'short',
        'much-longer-secret-key'
      )

      expect(validation.valid).toBe(false)
      expect(validation.error).toBe('Invalid clientState')
    })
  })

  describe('Inbound Webhook Validation', () => {
    it('should validate webhook with correct secret', () => {
      const validation = email.validateInboundWebhook('test-webhook-secret')

      expect(validation.valid).toBe(true)
    })

    it('should reject webhook with wrong secret', () => {
      const validation = email.validateInboundWebhook('wrong-secret')

      expect(validation.valid).toBe(false)
      expect(validation.error).toBe('Invalid clientState')
    })

    it('should reject webhook with missing secret', () => {
      const validation = email.validateInboundWebhook(undefined)

      expect(validation.valid).toBe(false)
      expect(validation.error).toBe('Missing clientState')
    })
  })

  describe('Webhook Payload Parsing', () => {
    it('should parse webhook payload with notifications', () => {
      const payload = {
        value: [
          {
            resourceData: { id: 'email-1' },
            changeType: 'created',
            resource: 'messages/123',
          },
          {
            resourceData: { id: 'email-2' },
            changeType: 'created',
            resource: 'messages/456',
          },
        ],
      }

      const result = email.parseWebhookPayload(payload)

      expect(result.notifications).toHaveLength(2)
      expect(result.notifications[0].resourceData).toEqual({ id: 'email-1' })
      expect(result.notifications[1].changeType).toBe('created')
    })

    it('should handle empty payload', () => {
      const result = email.parseWebhookPayload({})

      expect(result.notifications).toHaveLength(0)
    })

    it('should handle payload without value field', () => {
      const result = email.parseWebhookPayload({ other: 'data' })

      expect(result.notifications).toHaveLength(0)
    })
  })

  describe('Sender Module', () => {
    it('should send email using configured provider', async () => {
      const result = await email.send({
        to: 'test@test.com',
        subject: 'Test',
        body: 'Test body',
      })

      expect(result.success).toBe(true)
      expect(result.id).toBeDefined()
    })

    it('should handle attachments', async () => {
      const result = await email.send({
        to: 'test@test.com',
        subject: 'Test with attachment',
        body: 'Test',
        attachments: [
          {
            filename: 'test.txt',
            content: 'Test content',
            contentType: 'text/plain',
          },
        ],
      })

      expect(result.success).toBe(true)
    })
  })

  describe('Module Exports', () => {
    it('should export send function', () => {
      expect(typeof email.send).toBe('function')
    })

    it('should export selectProvider function', () => {
      expect(typeof email.selectProvider).toBe('function')
    })

    it('should export validateInboundWebhook function', () => {
      expect(typeof email.validateInboundWebhook).toBe('function')
    })

    it('should export parseWebhookPayload function', () => {
      expect(typeof email.parseWebhookPayload).toBe('function')
    })

    it('should export smtpProvider function', () => {
      expect(typeof email.smtpProvider).toBe('function')
    })

    it('should export graphProvider function', () => {
      expect(typeof email.graphProvider).toBe('function')
    })

    it('should export validateWebhookSecret function', () => {
      expect(typeof email.validateWebhookSecret).toBe('function')
    })
  })

  describe('Legacy Compatibility', () => {
    it('should export NoopEmailProvider class', () => {
      const provider = new email.NoopEmailProvider()
      expect(provider).toBeDefined()
    })

    it('should allow NoopEmailProvider to send', async () => {
      const provider = new email.NoopEmailProvider()
      const result = await provider.send(
        'test@test.com',
        'Subject',
        'Body'
      )

      expect(result.success).toBe(true)
      expect(result.messageId).toMatch(/^noop-/)
    })
  })
})
