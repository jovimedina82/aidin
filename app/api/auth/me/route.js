import { NextResponse } from 'next/server'
import { getCurrentUser } from "@/lib/auth"

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const user = await getCurrentUser(request)

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Return the user information
    const userResponse = {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles.map(r => r.role.name),
        isActive: user.isActive
      }
    }

    return NextResponse.json(userResponse)
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Auth/me error:', error)
    }
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
  }
}