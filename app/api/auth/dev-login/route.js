import { NextResponse } from 'next/server'
import { getBaseUrl } from '@/lib/config'
import { generateToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * Dev-only login bypass for local development
 * Only works when AUTH_DEV_BYPASS=true and NODE_ENV=development
 */
export async function GET(request) {
  const dev = process.env.NODE_ENV === 'development'
  const bypass = String(process.env.AUTH_DEV_BYPASS || 'false').toLowerCase() === 'true'

  if (!(dev && bypass)) {
    return new NextResponse('Forbidden - Dev bypass not enabled', { status: 403 })
  }

  try {
    // Find the first active admin user for dev login
    const devUser = await prisma.user.findFirst({
      where: {
        isActive: true,
        roles: {
          some: {
            role: {
              name: 'ADMIN'
            }
          }
        }
      },
      include: {
        roles: {
          include: {
            role: true
          }
        }
      }
    })

    if (!devUser) {
      return new NextResponse('No admin user found for dev bypass', { status: 404 })
    }

    // Generate JWT token
    const token = generateToken({
      userId: devUser.id,
      email: devUser.email,
      firstName: devUser.firstName,
      lastName: devUser.lastName,
      roles: devUser.roles.map(ur => ur.role.name)
    })

    // Get sanitized base URL
    const base = getBaseUrl(request)

    // Create redirect response with cookie (no localStorage needed, using HttpOnly cookie only)
    const response = NextResponse.redirect(`${base}/dashboard`, 302)

    // Set HttpOnly cookie
    response.headers.set('Set-Cookie', `authToken=${token}; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}; Path=/`)

    return response

  } catch (error) {
    console.error('Dev login error:', error)
    return new NextResponse('Dev login failed', { status: 500 })
  }
}
