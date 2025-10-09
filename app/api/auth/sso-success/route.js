import { NextResponse } from 'next/server'
import { verifyToken } from '../../../../lib/auth.js'
import { getBaseUrl, cookieOptions } from '../../../../lib/config.ts'

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

      // Set HttpOnly cookie using the new cookie name and options
      const opts = cookieOptions()
      response.cookies.set('aidin_token', token, {
        ...opts,
        maxAge: 60 * 60 * 24 * 7 // 7 days
      })

      return response

    } catch (tokenError) {
      return NextResponse.redirect(`${BASE_URL}/login?error=invalid_token`)
    }

  } catch (error) {
    return NextResponse.redirect(`${BASE_URL}/login?error=sso_error`)
  }
}