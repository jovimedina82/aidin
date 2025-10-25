/**
 * Phase 10 RC1: Unified Error Model
 * Consistent error responses across all API routes
 */

import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { Prisma } from '@/lib/generated/prisma'

/**
 * Standard error codes
 */
export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  CONFLICT = 'CONFLICT',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

/**
 * Standard error response shape
 */
export interface ErrorResponse {
  ok: false
  error: {
    code: ErrorCode | string
    message: string
    details?: any
  }
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  code: ErrorCode | string,
  message: string,
  status: number,
  details?: any
): NextResponse<ErrorResponse> {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message,
        ...(details && { details }),
      },
    },
    { status }
  )
}

/**
 * Handle and map errors to standardized responses
 */
export function handleApiError(error: unknown): NextResponse<ErrorResponse> {
  console.error('[API Error]', error)

  // Zod validation errors
  if (error instanceof ZodError) {
    return createErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Validation failed',
      400,
      error.issues
    )
  }

  // Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Unique constraint violation
    if (error.code === 'P2002') {
      return createErrorResponse(
        ErrorCode.CONFLICT,
        'Resource already exists',
        409,
        { target: error.meta?.target }
      )
    }

    // Record not found
    if (error.code === 'P2025') {
      return createErrorResponse(
        ErrorCode.NOT_FOUND,
        'Resource not found',
        404
      )
    }
  }

  // Standard Error with message
  if (error instanceof Error) {
    // Check for known error messages
    if (error.message.includes('not found') || error.message.includes('Not found')) {
      return createErrorResponse(
        ErrorCode.NOT_FOUND,
        error.message,
        404
      )
    }

    if (error.message.includes('Unauthorized') || error.message.includes('Authentication required')) {
      return createErrorResponse(
        ErrorCode.UNAUTHORIZED,
        error.message,
        401
      )
    }

    if (error.message.includes('Forbidden') || error.message.includes('permission')) {
      return createErrorResponse(
        ErrorCode.FORBIDDEN,
        error.message,
        403
      )
    }

    // Generic error
    return createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      error.message || 'An unexpected error occurred',
      500
    )
  }

  // Unknown error
  return createErrorResponse(
    ErrorCode.INTERNAL_ERROR,
    'An unexpected error occurred',
    500
  )
}

/**
 * Create validation error response
 */
export function validationError(message: string, details?: any): NextResponse<ErrorResponse> {
  return createErrorResponse(ErrorCode.VALIDATION_ERROR, message, 400, details)
}

/**
 * Create not found error response
 */
export function notFoundError(message: string = 'Resource not found'): NextResponse<ErrorResponse> {
  return createErrorResponse(ErrorCode.NOT_FOUND, message, 404)
}

/**
 * Create unauthorized error response
 */
export function unauthorizedError(message: string = 'Authentication required'): NextResponse<ErrorResponse> {
  return createErrorResponse(ErrorCode.UNAUTHORIZED, message, 401)
}

/**
 * Create forbidden error response
 */
export function forbiddenError(message: string = 'Forbidden'): NextResponse<ErrorResponse> {
  return createErrorResponse(ErrorCode.FORBIDDEN, message, 403)
}

/**
 * Create conflict error response
 */
export function conflictError(message: string, details?: any): NextResponse<ErrorResponse> {
  return createErrorResponse(ErrorCode.CONFLICT, message, 409, details)
}
