import { NextResponse } from 'next/server'
import { getCurrentUser, invalidateUserCache } from '@/lib/auth'
import { ApiError, ApiSuccess, withErrorHandler, requireRoles } from '@/lib/api-utils'
import { getUserModuleAccessSummary, setUserModuleAccess, removeUserModuleOverride } from '@/lib/module-access'
import { logEvent } from '@/lib/audit'

// GET /api/admin/user-modules?userId=xxx - Get module access summary for a user
export const GET = withErrorHandler(async (request) => {
  const user = await getCurrentUser(request)
  requireRoles(user, ['Admin'])

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  if (!userId) {
    return ApiError.badRequest('userId query parameter is required')
  }

  const moduleSummary = await getUserModuleAccessSummary(userId)

  return ApiSuccess.ok({ modules: moduleSummary })
})

// POST /api/admin/user-modules - Grant or revoke module access for a user
export const POST = withErrorHandler(async (request) => {
  const user = await getCurrentUser(request)
  requireRoles(user, ['Admin'])

  const data = await request.json()
  const { userId, moduleKey, hasAccess } = data

  if (!userId || !moduleKey || hasAccess === undefined) {
    return ApiError.badRequest('userId, moduleKey, and hasAccess are required')
  }

  const accessRecord = await setUserModuleAccess(userId, moduleKey, hasAccess, user.id)

  // Invalidate user cache so the changes take effect immediately
  invalidateUserCache(userId)

  // Log the access change
  await logEvent({
    action: hasAccess ? 'user.module.grant' : 'user.module.revoke',
    actorId: user.id,
    actorEmail: user.email,
    actorType: 'human',
    entityType: 'user',
    entityId: userId,
    ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    userAgent: request.headers.get('user-agent') || null,
    metadata: {
      moduleKey,
      hasAccess,
      grantedBy: user.email
    }
  })

  return ApiSuccess.ok({ accessRecord })
})

// DELETE /api/admin/user-modules - Remove user-specific module access override
export const DELETE = withErrorHandler(async (request) => {
  const user = await getCurrentUser(request)
  requireRoles(user, ['Admin'])

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  const moduleKey = searchParams.get('moduleKey')

  if (!userId || !moduleKey) {
    return ApiError.badRequest('userId and moduleKey query parameters are required')
  }

  await removeUserModuleOverride(userId, moduleKey)

  // Invalidate user cache so the changes take effect immediately
  invalidateUserCache(userId)

  // Log the override removal
  await logEvent({
    action: 'user.module.override.remove',
    actorId: user.id,
    actorEmail: user.email,
    actorType: 'human',
    entityType: 'user',
    entityId: userId,
    ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    userAgent: request.headers.get('user-agent') || null,
    metadata: {
      moduleKey,
      removedBy: user.email
    }
  })

  return ApiSuccess.ok({ message: 'User module override removed successfully' })
})
