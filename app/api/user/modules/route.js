import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { ApiError, ApiSuccess, withErrorHandler } from '@/lib/api-utils'
import { getUserModules } from '@/lib/module-access'

// GET /api/user/modules - Get modules accessible by the current user
export const GET = withErrorHandler(async (request) => {
  const user = await getCurrentUser(request)

  if (!user) {
    return ApiError.unauthorized('Authentication required')
  }

  const modules = await getUserModules(user)

  return ApiSuccess.ok({ modules })
})
