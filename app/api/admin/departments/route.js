import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import {
  ApiError,
  ApiSuccess,
  withErrorHandler,
  requireRoles
} from '@/lib/api-utils'

export const GET = withErrorHandler(async (request) => {
  const user = await getCurrentUser(request)
  requireRoles(user, ['Admin', 'Manager'])

  const departments = await prisma.department.findMany({
    include: {
      _count: {
        select: {
          users: true,
          keywords: true,
          knowledgeBase: true
        }
      }
    },
    orderBy: {
      name: 'asc'
    }
  })

  return ApiSuccess.ok({ departments })
})

export const POST = withErrorHandler(async (request) => {
  const user = await getCurrentUser(request)
  requireRoles(user, ['Admin'])

  const body = await request.json()
  const { name, description, color, isActive } = body

  if (!name?.trim()) {
    return ApiError.badRequest('Department name is required')
  }

  // Check if department with same name already exists
  const existingDepartment = await prisma.department.findFirst({
    where: {
      name: {
        equals: name.trim(),
        mode: 'insensitive'
      }
    }
  })

  if (existingDepartment) {
    return ApiError.badRequest('A department with this name already exists')
  }

  const department = await prisma.department.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      color: color || 'blue',
      isActive: isActive !== false
    },
    include: {
      _count: {
        select: {
          users: true,
          keywords: true,
          knowledgeBase: true
        }
      }
    }
  })

  return ApiSuccess.created(department)
})