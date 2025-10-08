import { NextResponse } from 'next/server'
import { logger } from './logger'

/**
 * Unified API error shape and handling utilities
 * Ensures consistent error responses across all API routes
 */

export interface ApiError {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

/**
 * Custom error class for API errors
 */
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'AppError'
  }
}

/**
 * Create a standardized API error response
 * @param status - HTTP status code
 * @param code - Error code (e.g., 'UNAUTHORIZED', 'VALIDATION_ERROR')
 * @param message - Human-readable error message
 * @param details - Optional additional error details
 * @returns NextResponse with error JSON
 */
export function apiError(
  status: number,
  code: string,
  message: string,
  details?: unknown
): NextResponse<ApiError> {
  const errorResponse: ApiError = {
    error: {
      code,
      message,
      ...(details && { details }),
    },
  }

  return NextResponse.json(errorResponse, { status })
}

/**
 * Higher-order function to wrap API route handlers with error handling
 * Catches errors and returns standardized JSON error responses
 *
 * @param fn - Async route handler function
 * @returns Wrapped handler with error handling
 *
 * @example
 * export const GET = handleApi(async (request) => {
 *   const data = await fetchData()
 *   return NextResponse.json({ data })
 * })
 */
export function handleApi<T extends (...args: any[]) => Promise<NextResponse>>(
  fn: T
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args)
    } catch (error) {
      // Handle known AppError
      if (error instanceof AppError) {
        logger.warn(
          {
            code: error.code,
            status: error.status,
            message: error.message,
            details: error.details,
          },
          'API error'
        )
        return apiError(error.status, error.code, error.message, error.details)
      }

      // Handle Zod validation errors
      if (error && typeof error === 'object' && 'name' in error && error.name === 'ZodError') {
        const zodError = error as { issues: Array<{ path: string[]; message: string }> }
        logger.warn({ error: zodError }, 'Validation error')
        return apiError(400, 'VALIDATION_ERROR', 'Invalid request data', {
          issues: zodError.issues,
        })
      }

      // Handle unexpected errors
      logger.error({ error }, 'Unexpected error in API handler')

      return apiError(
        500,
        'INTERNAL_ERROR',
        'An unexpected error occurred',
        process.env.NODE_ENV === 'development' && error instanceof Error
          ? { message: error.message, stack: error.stack }
          : undefined
      )
    }
  }) as T
}

/**
 * Common error factories
 */
export const errors = {
  unauthorized: (message = 'Authentication required') =>
    new AppError(401, 'UNAUTHORIZED', message),

  forbidden: (message = 'Access denied') =>
    new AppError(403, 'FORBIDDEN', message),

  notFound: (resource = 'Resource') =>
    new AppError(404, 'NOT_FOUND', `${resource} not found`),

  validation: (message = 'Invalid request data', details?: unknown) =>
    new AppError(400, 'VALIDATION_ERROR', message, details),

  conflict: (message = 'Resource already exists') =>
    new AppError(409, 'CONFLICT', message),

  internal: (message = 'An unexpected error occurred') =>
    new AppError(500, 'INTERNAL_ERROR', message),
}
