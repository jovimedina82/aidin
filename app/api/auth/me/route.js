import { NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth.js'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    console.log('🔍 Auth/me: Starting auth check...')
    const user = await getCurrentUser(request)
    console.log('🔍 Auth/me: User found:', user ? `${user.email} (${user.id})` : 'null')

    if (!user) {
      console.log('❌ Auth/me: No user found')
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

    console.log('✅ Auth/me: Returning user data:', userResponse.user.email)
    return NextResponse.json(userResponse)
  } catch (error) {
    console.error('❌ Auth/me: Error occurred:', error)
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
  }
}