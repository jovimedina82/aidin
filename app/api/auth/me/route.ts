import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { handleApi, errors } from '@/lib/errors'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export const GET = handleApi(async (request: Request) => {
  const user = await getCurrentUser(request)

  if (!user) {
    logger.warn('Unauthorized access attempt to /api/auth/me')
    throw errors.unauthorized()
  }

  logger.debug({ userId: user.id }, 'User info retrieved')

  // Return the user information
  const userResponse = {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles.map((r) => r.role.name),
      isActive: user.isActive,
      avatar: user.avatar,
      azureId: user.azureId,
      createdAt: user.createdAt,
    },
  }

  return NextResponse.json(userResponse)
})
