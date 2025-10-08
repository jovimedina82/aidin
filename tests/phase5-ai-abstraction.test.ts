/**
 * Phase 5 Tests: AI Abstraction Layer
 * Tests provider selection, classification, and response generation with mocked providers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as ai from '@/modules/ai'

// Mock the config module
vi.mock('@/lib/config', () => ({
  config: {
    AI_PROVIDER: 'openai',
    OPENAI_API_KEY: 'test-openai-key',
    ANTHROPIC_API_KEY: 'test-anthropic-key',
    AI_CLASSIFY_MODEL: 'gpt-4o-mini',
    AI_RESPOND_MODEL: 'gpt-4o-mini',
    validate: vi.fn(),
  },
}))

// Mock OpenAI SDK
const mockCreate = vi.fn()
vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: mockCreate,
        },
      }
    },
  }
})

describe('Phase 5: AI Abstraction', () => {
  describe('Domain Types', () => {
    it('should export Provider interface', () => {
      expect(ai).toHaveProperty('selectProvider')
    })

    it('should export ClassifyInput type', () => {
      // Type check only - TypeScript will validate
      const input: ai.ClassifyInput = {
        title: 'Test',
        description: 'Test description',
      }
      expect(input).toBeDefined()
    })

    it('should export RespondInput type', () => {
      // Type check only - TypeScript will validate
      const input: ai.RespondInput = {
        ticketId: 'T-001',
        ticketTitle: 'Test',
        ticketDescription: 'Test description',
      }
      expect(input).toBeDefined()
    })
  })

  describe('Provider Selection', () => {
    it('should select OpenAI provider', () => {
      const provider = ai.selectProvider('openai', {
        apiKey: 'test-key',
      })

      expect(provider.name).toBe('openai')
      expect(provider.classify).toBeDefined()
      expect(provider.respond).toBeDefined()
    })

    it('should select Anthropic provider', () => {
      const provider = ai.selectProvider('anthropic', {
        apiKey: 'test-key',
      })

      expect(provider.name).toBe('anthropic')
      expect(provider.classify).toBeDefined()
      expect(provider.respond).toBeDefined()
    })

    it('should throw error for unknown provider', () => {
      expect(() => {
        ai.selectProvider('unknown' as any, { apiKey: 'test-key' })
      }).toThrow('Unknown AI provider')
    })
  })

  describe('OpenAI Provider', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should classify with OpenAI provider', async () => {
      // Mock OpenAI response
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                category: 'Software',
                priority: 'NORMAL',
                confidence: 0.85,
                reasoning: 'Test reasoning',
              }),
            },
          },
        ],
      })

      const provider = ai.openaiProvider({
        apiKey: 'test-key',
        classifyModel: 'gpt-4o-mini',
      })

      const result = await provider.classify({
        title: 'Email not working',
        description: 'Cannot send emails from Outlook',
      })

      expect(result.category).toBe('Software')
      expect(result.confidence).toBe(0.85)
      expect(result.reasoning).toBe('Test reasoning')
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o-mini',
          response_format: { type: 'json_object' },
        })
      )
    })

    it('should respond with OpenAI provider', async () => {
      // Mock OpenAI response
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Hello! Here are the troubleshooting steps...',
            },
          },
        ],
      })

      const provider = ai.openaiProvider({
        apiKey: 'test-key',
        respondModel: 'gpt-4o-mini',
      })

      const result = await provider.respond({
        ticketId: 'T-001',
        ticketTitle: 'Email not working',
        ticketDescription: 'Cannot send emails',
        ticketCategory: 'Software',
        ticketPriority: 'NORMAL',
      })

      expect(result.response).toContain('troubleshooting')
      expect(result.confidence).toBe(0.8)
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o-mini',
        })
      )
    })

    it('should handle classify errors with fallback', async () => {
      // Mock OpenAI error
      mockCreate.mockRejectedValue(new Error('API error'))

      const provider = ai.openaiProvider({
        apiKey: 'test-key',
      })

      const result = await provider.classify({
        title: 'Test',
        description: 'Test',
      })

      expect(result.category).toBe('General')
      expect(result.confidence).toBe(0.3)
      expect(result.reasoning).toContain('error')
    })

    it('should handle respond errors with fallback', async () => {
      // Mock OpenAI error
      mockCreate.mockRejectedValue(new Error('API error'))

      const provider = ai.openaiProvider({
        apiKey: 'test-key',
      })

      const result = await provider.respond({
        ticketId: 'T-001',
        ticketTitle: 'Test ticket',
        ticketDescription: 'Test',
      })

      expect(result.response).toContain('Thank you for reaching out')
      expect(result.confidence).toBe(0.3)
      expect(result.reasoning).toContain('error')
    })
  })

  describe('Anthropic Provider', () => {
    it('should return stub response for classify', async () => {
      const provider = ai.anthropicProvider({
        apiKey: 'test-key',
      })

      const result = await provider.classify({
        title: 'Test',
        description: 'Test',
      })

      expect(result.category).toBe('General')
      expect(result.confidence).toBe(0.5)
      expect(result.reasoning).toContain('not yet implemented')
    })

    it('should return stub response for respond', async () => {
      const provider = ai.anthropicProvider({
        apiKey: 'test-key',
      })

      const result = await provider.respond({
        ticketId: 'T-001',
        ticketTitle: 'Test',
        ticketDescription: 'Test',
      })

      expect(result.response).toContain('Thank you for reaching out')
      expect(result.confidence).toBe(0.5)
      expect(result.reasoning).toContain('not yet implemented')
    })
  })

  describe('Orchestration Functions', () => {
    beforeEach(() => {
      vi.clearAllMocks()

      // Mock OpenAI responses
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                category: 'Hardware',
                priority: 'HIGH',
                confidence: 0.9,
                reasoning: 'Test',
              }),
            },
          },
        ],
      })
    })

    it('should classify using configured provider', async () => {
      const result = await ai.classify({
        title: 'Printer not working',
        description: 'Printer is offline',
      })

      expect(result.category).toBe('Hardware')
      expect(result.confidence).toBeGreaterThan(0)
    })

    it('should accept classification options', async () => {
      const result = await ai.classify(
        {
          title: 'Test',
          description: 'Test',
        },
        {
          model: 'gpt-4o',
          temperature: 0.1,
          maxTokens: 100,
        }
      )

      expect(result).toBeDefined()
    })
  })

  describe('Module Exports', () => {
    it('should export classify function', () => {
      expect(typeof ai.classify).toBe('function')
    })

    it('should export respond function', () => {
      expect(typeof ai.respond).toBe('function')
    })

    it('should export selectProvider function', () => {
      expect(typeof ai.selectProvider).toBe('function')
    })

    it('should export openaiProvider function', () => {
      expect(typeof ai.openaiProvider).toBe('function')
    })

    it('should export anthropicProvider function', () => {
      expect(typeof ai.anthropicProvider).toBe('function')
    })
  })
})
