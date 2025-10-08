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

    // Create HTML response that sets localStorage and redirects
    const htmlResponse = new Response(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Dev Login...</title>
        <style>
          body {
            font-family: system-ui, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: #f5f5f5;
          }
          .spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3498db;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin-bottom: 20px;
          }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          .container { text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="spinner"></div>
          <h2>Dev Login (Bypass)</h2>
          <p>Logging in as ${devUser.email}...</p>
        </div>
        <script>
          // Store the token
          localStorage.setItem('authToken', '${token}');

          // Store user data
          const userData = {
            id: '${devUser.id}',
            email: '${devUser.email}',
            firstName: '${devUser.firstName || ''}',
            lastName: '${devUser.lastName || ''}',
            roles: ${JSON.stringify(devUser.roles.map(ur => ur.role.name))},
            isActive: true
          };

          localStorage.setItem('user', JSON.stringify(userData));

          console.log('Dev bypass login successful:', '${devUser.email}');

          // Redirect to dashboard
          setTimeout(() => {
            window.location.href = '${base}/dashboard';
          }, 1000);
        </script>
      </body>
      </html>
    `, {
      headers: {
        'Content-Type': 'text/html',
        // Dev-only cookie (no domain, no secure)
        'Set-Cookie': `authToken=${token}; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}; Path=/`
      }
    })

    return htmlResponse

  } catch (error) {
    console.error('Dev login error:', error)
    return new NextResponse('Dev login failed', { status: 500 })
  }
}
