import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import {
  ApiError,
  ApiSuccess,
  withErrorHandler,
  requireRoles,
  handlePrismaError,
  validateRequired
} from '@/lib/api-utils'

export const GET = withErrorHandler(async (request) => {
  const user = await getCurrentUser(request)
  requireRoles(user, ['Admin', 'Manager', 'Staff'])

  const users = await prisma.user.findMany({
    include: {
      roles: {
        include: {
          role: true
        }
      },
      departments: {
        include: {
          department: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  return ApiSuccess.ok(users)
})

export const POST = withErrorHandler(async (request) => {
  const currentUser = await getCurrentUser(request)
  requireRoles(currentUser, ['Admin'])

  const data = await request.json()

  // Validate required fields
  const validation = validateRequired(data, ['email', 'firstName', 'lastName'])
  if (!validation.isValid) {
    throw new Error('VALIDATION_ERROR')
  }

  const result = await prisma.$transaction(async (prisma) => {
    const user = await prisma.user.create({
      data: {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        password: data.password,
        phone: data.phone,
        userType: data.userType || 'Client',
        isActive: data.isActive ?? true
      },
      include: {
        roles: {
          include: {
            role: true
          }
        },
        departments: {
          include: {
            department: true
          }
        }
      }
    })

    // Create department assignments
    if (data.departmentIds && Array.isArray(data.departmentIds)) {
      await Promise.all(
        data.departmentIds.map(departmentId =>
          prisma.userDepartment.create({
            data: {
              userId: user.id,
              departmentId: departmentId
            }
          })
        )
      )
    } else if (data.departmentId) {
      // Handle single department for backward compatibility
      await prisma.userDepartment.create({
        data: {
          userId: user.id,
          departmentId: data.departmentId
        }
      })
    }

    return user
  })

  return ApiSuccess.created(result)
})