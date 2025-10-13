import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { ApiError, ApiSuccess, withErrorHandler, requireRoles } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'

// GET /api/admin/modules - List all modules
export const GET = withErrorHandler(async (request) => {
  const user = await getCurrentUser(request)
  requireRoles(user, ['Admin'])

  const modules = await prisma.module.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      _count: {
        select: {
          userModuleAccess: true,
          roleModuleAccess: true
        }
      }
    }
  })

  return ApiSuccess.ok({ modules })
})

// POST /api/admin/modules - Create new module
export const POST = withErrorHandler(async (request) => {
  const user = await getCurrentUser(request)
  requireRoles(user, ['Admin'])

  const data = await request.json()

  const module = await prisma.module.create({
    data: {
      name: data.name,
      key: data.key,
      description: data.description,
      icon: data.icon,
      route: data.route,
      category: data.category || 'features',
      isCore: data.isCore || false,
      isActive: data.isActive !== undefined ? data.isActive : true,
      sortOrder: data.sortOrder || 0
    }
  })

  return ApiSuccess.created({ module })
})

// PATCH /api/admin/modules - Update module
export const PATCH = withErrorHandler(async (request) => {
  const user = await getCurrentUser(request)
  requireRoles(user, ['Admin'])

  const data = await request.json()
  const { moduleKey, ...updateData } = data

  if (!moduleKey) {
    return ApiError.badRequest('moduleKey is required')
  }

  // Don't allow updating the key itself
  delete updateData.key

  const module = await prisma.module.update({
    where: { key: moduleKey },
    data: updateData
  })

  return ApiSuccess.ok({ module })
})
