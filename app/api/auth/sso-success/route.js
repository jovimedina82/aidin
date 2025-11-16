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

      if (!decoded) {
        console.error('SSO Success: Token verification returned null')
        return NextResponse.redirect(`${BASE_URL}/login?error=invalid_token`)
      }

      // Set the auth cookie and redirect immediately to dashboard
      const response = NextResponse.redirect(`${BASE_URL}/dashboard`, 302)

      // Set HttpOnly cookie using the new cookie name and options
      const opts = cookieOptions()
      response.cookies.set('aidin_token', token, {
        ...opts,
        maxAge: 60 * 60 * 24 * 7 // 7 days
      })

      console.log('SSO Success: Cookie set for user', decoded.email || decoded.userId)
      return response

    } catch (tokenError) {
      console.error('SSO Success: Token verification error', tokenError)
      return NextResponse.redirect(`${BASE_URL}/login?error=invalid_token`)
    }

  } catch (error) {
    return NextResponse.redirect(`${BASE_URL}/login?error=sso_error`)
  }
}