import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import {
  ApiError,
  ApiSuccess,
  withErrorHandler,
  requireRoles
} from '@/lib/api-utils'

export const PUT = withErrorHandler(async (request, { params }) => {
  const user = await getCurrentUser(request)
  requireRoles(user, ['Admin'])

  const { id } = params
  const body = await request.json()
  const { name, description, color, isActive } = body
  console.log('DEBUG: Department PUT - Received id:', id, 'Type:', typeof id)

  if (!name?.trim()) {
    return ApiError.badRequest('Department name is required')
  }

  // Check if department exists
  const existingDepartment = await prisma.department.findUnique({
    where: { id: id }
  })

  if (!existingDepartment) {
    return ApiError.notFound('Department not found')
  }

  // Check if another department with same name exists (excluding current department)
  const duplicateDepartment = await prisma.department.findFirst({
    where: {
      name: {
        equals: name.trim()
      },
      id: {
        not: id
      }
    }
  })

  if (duplicateDepartment) {
    return ApiError.badRequest('A department with this name already exists')
  }

  const department = await prisma.department.update({
    where: { id: id },
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

  return ApiSuccess.ok(department)
})

export const DELETE = withErrorHandler(async (request, { params }) => {
  const user = await getCurrentUser(request)
  requireRoles(user, ['Admin'])

  const { id } = params
  console.log('DEBUG: Department DELETE - Received id:', id, 'Type:', typeof id)

  // Check if department exists
  const existingDepartment = await prisma.department.findUnique({
    where: { id: id },
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

  if (!existingDepartment) {
    return ApiError.notFound('Department not found')
  }

  // Check if department has dependencies
  if (existingDepartment._count.users > 0) {
    return ApiError.badRequest('Cannot delete department with assigned users')
  }

  if (existingDepartment._count.keywords > 0) {
    return ApiError.badRequest('Cannot delete department with associated keywords')
  }

  if (existingDepartment._count.knowledgeBase > 0) {
    return ApiError.badRequest('Cannot delete department with knowledge base articles')
  }

  await prisma.department.delete({
    where: { id: id }
  })

  return ApiSuccess.ok({ message: 'Department deleted successfully' })
})