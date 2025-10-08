import { NextResponse } from 'next/server'
import { verifyToken } from '../../../../lib/auth.js'
import { getBaseUrl } from '../../../../lib/config.ts'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const url = new URL(request.url)
    const token = url.searchParams.get('token')

    // Get base URL from environment or request origin
    const BASE_URL = getBaseUrl(request)

    if (!token) {
      return NextResponse.redirect(`${BASE_URL}/login?error=no_token`)
    }

    try {
      // Verify the token is valid
      const decoded = verifyToken(token)

      // Set the auth cookie and redirect immediately to dashboard
      const response = NextResponse.redirect(`${BASE_URL}/dashboard`, 302)

      // Set HttpOnly cookie
      const cookieValue = process.env.NODE_ENV === 'production'
        ? `authToken=${token}; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}; Path=/; Domain=.surterreproperties.com`
        : `authToken=${token}; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}; Path=/`

      response.headers.set('Set-Cookie', cookieValue)

      return response

    } catch (tokenError) {
      return NextResponse.redirect(`${BASE_URL}/login?error=invalid_token`)
    }

  } catch (error) {
    return NextResponse.redirect(`${BASE_URL}/login?error=sso_error`)
  }
}