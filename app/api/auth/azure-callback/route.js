import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma.js'
import { generateToken } from '../../../../lib/auth.js'
import axios from 'axios'

export const dynamic = 'force-dynamic'

// Simple in-memory cache to prevent processing the same code multiple times
const processedCodes = new Set()

export async function GET(request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')
  const errorDescription = url.searchParams.get('error_description')

  // Always use production URL for helpdesk
  const BASE_URL = 'https://helpdesk.surterreproperties.com'

  // Prevent processing the same authorization code multiple times
  if (code && processedCodes.has(code)) {
    return NextResponse.redirect(`${BASE_URL}/dashboard`)
  }

  if (error) {
    return NextResponse.redirect(`${BASE_URL}/login?error=azure_error&message=${encodeURIComponent(errorDescription || error)}`)
  }

  if (!code) {
    return NextResponse.redirect(`${BASE_URL}/login?error=no_authorization_code`)
  }

  try {
    // Mark this code as being processed
    processedCodes.add(code)
    
    
    // Exchange code for token
    const tokenUrl = `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/oauth2/v2.0/token`

    const params = new URLSearchParams()
    params.append('client_id', process.env.AZURE_AD_CLIENT_ID)
    params.append('client_secret', process.env.AZURE_AD_CLIENT_SECRET)
    params.append('code', code)
    params.append('grant_type', 'authorization_code')
    params.append('redirect_uri', `${BASE_URL}/api/auth/azure-callback`)
    params.append('scope', 'openid profile email User.Read')


    const tokenResponse = await axios.post(tokenUrl, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })

    const { access_token } = tokenResponse.data

    // Get user info from Microsoft Graph
    const userResponse = await axios.get('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${access_token}`
      }
    })

    const azureUser = userResponse.data
    
    // Find user in our database
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { azureId: azureUser.id },
          { email: azureUser.mail || azureUser.userPrincipalName }
        ]
      },
      include: {
        roles: {
          include: {
            role: true
          }
        }
      }
    })

    if (!user) {
      return NextResponse.redirect(`${BASE_URL}/login?error=user_not_synced&email=${encodeURIComponent(azureUser.mail || azureUser.userPrincipalName)}`)
    }

    if (!user.isActive) {
      return NextResponse.redirect(`${BASE_URL}/login?error=account_inactive`)
    }


    // Update user's Azure ID and last login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        azureId: azureUser.id,
        lastLoginAt: new Date()
      }
    })

    // Generate JWT token for our auth system
    const token = generateToken({
      userId: user.id,  // IMPORTANT: Must be 'userId' not 'id' for getCurrentUser to work
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles.map(ur => ur.role.name)
    })


    // Redirect to sso-success page with token to set localStorage
    // This is needed because SSO callback can't directly set localStorage
    const successUrl = `${BASE_URL}/api/auth/sso-success?token=${encodeURIComponent(token)}`

    return NextResponse.redirect(successUrl)

  } catch (error) {
    console.error('Azure callback error:', {
      error: error.message,
      response: error.response?.data,
      stack: error.stack
    })

    // Clean up the code from cache if it exists
    if (code) {
      processedCodes.delete(code)
    }

    const errorMessage = error.response?.data?.error_description || error.message || 'SSO authentication failed'
    return NextResponse.redirect(`${BASE_URL}/login?error=sso_failed&message=${encodeURIComponent(errorMessage)}`)
  }
}