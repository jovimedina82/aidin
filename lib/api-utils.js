import { NextResponse } from 'next/server'

/**
 * Standardized API error responses
 */
export const ApiError = {
  /**
   * Unauthorized access (401)
   */
  unauthorized: (message = 'Unauthorized') =>
    NextResponse.json({ error: message }, { status: 401 }),

  /**
   * Forbidden access (403)
   */
  forbidden: (message = 'Forbidden') =>
    NextResponse.json({ error: message }, { status: 403 }),

  /**
   * Resource not found (404)
   */
  notFound: (message = 'Resource not found') =>
    NextResponse.json({ error: message }, { status: 404 }),

  /**
   * Bad request (400)
   */
  badRequest: (message = 'Bad request') =>
    NextResponse.json({ error: message }, { status: 400 }),

  /**
   * Validation error (422)
   */
  validation: (message = 'Validation failed', errors = null) =>
    NextResponse.json({
      error: message,
      ...(errors && { errors })
    }, { status: 422 }),

  /**
   * Internal server error (500)
   */
  internal: (message = 'Internal server error') =>
    NextResponse.json({ error: message }, { status: 500 }),

  /**
   * Conflict (409)
   */
  conflict: (message = 'Resource conflict') =>
    NextResponse.json({ error: message }, { status: 409 })
}

/**
 * Standardized API success responses
 */
export const ApiSuccess = {
  /**
   * Success with data (200)
   */
  ok: (data) => NextResponse.json(data),

  /**
   * Created resource (201)
   */
  created: (data) => NextResponse.json(data, { status: 201 }),

  /**
   * No content (204)
   */
  noContent: () => new NextResponse(null, { status: 204 }),

  /**
   * Success with message (200)
   */
  message: (message, data = null) =>
    NextResponse.json({
      message,
      ...(data && { data })
    })
}

/**
 * Handle common database errors
 */
export function handlePrismaError(error) {
  console.error('Prisma error:', error)

  // Unique constraint violation
  if (error.code === 'P2002') {
    const field = error.meta?.target?.[0] || 'field'
    return ApiError.conflict(`${field} already exists`)
  }

  // Record not found
  if (error.code === 'P2025') {
    return ApiError.notFound('Record not found')
  }

  // Foreign key constraint violation
  if (error.code === 'P2003') {
    return ApiError.badRequest('Invalid reference to related record')
  }

  // Default to internal server error
  return ApiError.internal('Database operation failed')
}

/**
 * Validate request body fields
 */
export function validateRequired(data, requiredFields) {
  const missing = requiredFields.filter(field => !data[field])

  if (missing.length > 0) {
    return {
      isValid: false,
      error: ApiError.badRequest(`Missing required fields: ${missing.join(', ')}`)
    }
  }

  return { isValid: true }
}

/**
 * Check if user has required roles
 */
export function hasRole(user, roles) {
  if (!user?.roles) return false

  const userRoles = user.roles.map(role =>
    typeof role === 'string' ? role : (role.role?.name || role.name)
  )

  return roles.some(role => userRoles.includes(role))
}

/**
 * Require authentication middleware
 */
export function requireAuth(user) {
  if (!user) {
    throw new Error('UNAUTHORIZED')
  }
  return user
}

/**
 * Require specific roles middleware
 */
export function requireRoles(user, roles) {
  requireAuth(user)

  if (!hasRole(user, roles)) {
    throw new Error('FORBIDDEN')
  }

  return user
}

/**
 * Async error handler for API routes
 */
export function withErrorHandler(handler) {
  return async (request, context) => {
    try {
      return await handler(request, context)
    } catch (error) {
      console.error('API Error:', error)

      // Handle custom auth/permission errors
      if (error.message === 'UNAUTHORIZED') {
        return ApiError.unauthorized()
      }

      if (error.message === 'FORBIDDEN') {
        return ApiError.forbidden()
      }

      // Handle Prisma errors
      if (error.code?.startsWith('P')) {
        return handlePrismaError(error)
      }

      // Default error
      return ApiError.internal('An unexpected error occurred')
    }
  }
}

/**
 * Parse query parameters with defaults
 */
export function parseQueryParams(searchParams, defaults = {}) {
  const params = {}

  for (const [key, defaultValue] of Object.entries(defaults)) {
    const value = searchParams.get(key)

    if (value !== null) {
      // Handle different types
      if (typeof defaultValue === 'number') {
        params[key] = parseInt(value) || defaultValue
      } else if (typeof defaultValue === 'boolean') {
        params[key] = value === 'true'
      } else {
        params[key] = value
      }
    } else {
      params[key] = defaultValue
    }
  }

  return params
}

/**
 * Build Prisma where clause from filters
 */
export function buildWhereClause(filters) {
  const where = {}

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      where[key] = value
    }
  })

  return where
}