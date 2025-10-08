import { describe, it, expect } from 'vitest'
import { apiError, AppError, errors, handleApi } from '../lib/errors'
import { NextResponse } from 'next/server'

describe('Error Handling', () => {
  describe('apiError', () => {
    it('should create standardized error response', () => {
      const response = apiError(404, 'NOT_FOUND', 'Resource not found')

      expect(response).toBeInstanceOf(NextResponse)
      expect(response.status).toBe(404)
    })

    it('should include details when provided', async () => {
      const response = apiError(400, 'VALIDATION_ERROR', 'Invalid data', {
        field: 'email',
        reason: 'invalid format',
      })

      const json = await response.json()

      expect(json).toEqual({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid data',
          details: {
            field: 'email',
            reason: 'invalid format',
          },
        },
      })
    })

    it('should omit details when not provided', async () => {
      const response = apiError(401, 'UNAUTHORIZED', 'Authentication required')
      const json = await response.json()

      expect(json).toEqual({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      })
      expect(json.error.details).toBeUndefined()
    })
  })

  describe('AppError', () => {
    it('should create custom error with status and code', () => {
      const error = new AppError(403, 'FORBIDDEN', 'Access denied')

      expect(error).toBeInstanceOf(Error)
      expect(error.status).toBe(403)
      expect(error.code).toBe('FORBIDDEN')
      expect(error.message).toBe('Access denied')
      expect(error.name).toBe('AppError')
    })

    it('should support optional details', () => {
      const error = new AppError(400, 'VALIDATION_ERROR', 'Invalid input', {
        fields: ['email', 'password'],
      })

      expect(error.details).toEqual({ fields: ['email', 'password'] })
    })
  })

  describe('error factories', () => {
    it('should create unauthorized error', () => {
      const error = errors.unauthorized()

      expect(error.status).toBe(401)
      expect(error.code).toBe('UNAUTHORIZED')
      expect(error.message).toBe('Authentication required')
    })

    it('should create forbidden error', () => {
      const error = errors.forbidden('You cannot access this')

      expect(error.status).toBe(403)
      expect(error.code).toBe('FORBIDDEN')
      expect(error.message).toBe('You cannot access this')
    })

    it('should create not found error', () => {
      const error = errors.notFound('Ticket')

      expect(error.status).toBe(404)
      expect(error.code).toBe('NOT_FOUND')
      expect(error.message).toBe('Ticket not found')
    })

    it('should create validation error', () => {
      const error = errors.validation('Invalid email', { field: 'email' })

      expect(error.status).toBe(400)
      expect(error.code).toBe('VALIDATION_ERROR')
      expect(error.message).toBe('Invalid email')
      expect(error.details).toEqual({ field: 'email' })
    })

    it('should create conflict error', () => {
      const error = errors.conflict('User already exists')

      expect(error.status).toBe(409)
      expect(error.code).toBe('CONFLICT')
      expect(error.message).toBe('User already exists')
    })

    it('should create internal error', () => {
      const error = errors.internal()

      expect(error.status).toBe(500)
      expect(error.code).toBe('INTERNAL_ERROR')
      expect(error.message).toBe('An unexpected error occurred')
    })
  })

  describe('handleApi', () => {
    it('should pass through successful responses', async () => {
      const handler = handleApi(async () => {
        return NextResponse.json({ success: true })
      })

      const response = await handler()
      const json = await response.json()

      expect(json).toEqual({ success: true })
      expect(response.status).toBe(200)
    })

    it('should catch AppError and return standardized response', async () => {
      const handler = handleApi(async () => {
        throw new AppError(404, 'NOT_FOUND', 'Ticket not found')
      })

      const response = await handler()
      const json = await response.json()

      expect(response.status).toBe(404)
      expect(json).toEqual({
        error: {
          code: 'NOT_FOUND',
          message: 'Ticket not found',
        },
      })
    })

    it('should catch generic errors and return 500', async () => {
      const handler = handleApi(async () => {
        throw new Error('Something went wrong')
      })

      const response = await handler()
      const json = await response.json()

      expect(response.status).toBe(500)
      expect(json.error.code).toBe('INTERNAL_ERROR')
      expect(json.error.message).toBe('An unexpected error occurred')
    })

    it('should preserve function arguments', async () => {
      const handler = handleApi(async (request: Request, context: any) => {
        return NextResponse.json({ id: context.params.id })
      })

      const mockRequest = new Request('http://localhost:3000')
      const mockContext = { params: { id: '123' } }

      const response = await handler(mockRequest, mockContext)
      const json = await response.json()

      expect(json).toEqual({ id: '123' })
    })
  })
})
