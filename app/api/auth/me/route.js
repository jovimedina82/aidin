import { NextResponse } from 'next/server'
import { getCurrentUser } from "@/lib/auth"
import { handleApiError, unauthorizedError } from '@/lib/http/errors'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const user = await getCurrentUser(request)

    if (!user) {
      return unauthorizedError('Authentication required')
    }

    // Return the user information
    const userResponse = {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles.map(r => r.role.name),
        isActive: user.isActive,
        avatar: user.avatar,
        azureId: user.azureId,
        createdAt: user.createdAt
      }
    }

    return NextResponse.json(userResponse)
  } catch (error) {
    return handleApiError(error)
  }
}