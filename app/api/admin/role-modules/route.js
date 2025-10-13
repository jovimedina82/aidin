import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { ApiError, ApiSuccess, withErrorHandler, requireRoles } from '@/lib/api-utils'
import { getRoleModules, setRoleModuleAccess } from '@/lib/module-access'
import { prisma } from '@/lib/prisma'
import { logEvent } from '@/lib/audit'

// GET /api/admin/role-modules?roleId=xxx - Get modules accessible by a role
export const GET = withErrorHandler(async (request) => {
  const user = await getCurrentUser(request)
  requireRoles(user, ['Admin'])

  const { searchParams } = new URL(request.url)
  const roleId = searchParams.get('roleId')

  if (!roleId) {
    return ApiError.badRequest('roleId query parameter is required')
  }

  const modules = await getRoleModules(roleId)

  return ApiSuccess.ok({ modules })
})

// POST /api/admin/role-modules - Grant or revoke module access for a role
export const POST = withErrorHandler(async (request) => {
  const user = await getCurrentUser(request)
  requireRoles(user, ['Admin'])

  const data = await request.json()
  const { roleId, moduleKey, hasAccess } = data

  if (!roleId || !moduleKey || hasAccess === undefined) {
    return ApiError.badRequest('roleId, moduleKey, and hasAccess are required')
  }

  // Get role name for logging
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: { name: true }
  })

  if (!role) {
    return ApiError.notFound('Role not found')
  }

  const accessRecord = await setRoleModuleAccess(roleId, moduleKey, hasAccess)

  // Log the access change
  await logEvent({
    action: hasAccess ? 'role.module.grant' : 'role.module.revoke',
    actorId: user.id,
    actorEmail: user.email,
    actorType: 'human',
    entityType: 'role',
    entityId: roleId,
    ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    userAgent: request.headers.get('user-agent') || null,
    metadata: {
      roleName: role.name,
      moduleKey,
      hasAccess,
      changedBy: user.email
    }
  })

  return ApiSuccess.ok({ accessRecord })
})
