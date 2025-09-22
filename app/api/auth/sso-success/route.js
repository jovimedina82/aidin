import { NextResponse } from 'next/server'
import { verifyToken } from '../../../../lib/auth.js'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const url = new URL(request.url)
    const token = url.searchParams.get('token')

    if (!token) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/login?error=no_token`)
    }

    try {
      // Verify the token is valid
      const decoded = verifyToken(token)

      // Create response that redirects to dashboard
      const response = NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/dashboard`)

      // Set the auth token as an HTTP-only cookie for security
      response.cookies.set('authToken', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/'
      })

      // Also set it in localStorage via a simple HTML page
      const htmlResponse = new Response(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Signing you in...</title>
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
            <h2>Signing you in...</h2>
            <p>Please wait while we complete your login.</p>
          </div>
          <script>
            // Store the token and user data
            localStorage.setItem('authToken', '${token}');
            
            // Get user data from the token
            const tokenParts = '${token}'.split('.');
            const payload = JSON.parse(atob(tokenParts[1]));
            
            const userData = {
              id: payload.userId || payload.id,  // Handle both userId and id for compatibility
              email: payload.email,
              firstName: payload.firstName,
              lastName: payload.lastName,
              roles: payload.roles,
              isActive: true
            };
            
            localStorage.setItem('user', JSON.stringify(userData));
            
            if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
              console.log('SSO Login successful for:', payload.email);
            }
            
            // Redirect to dashboard after a short delay
            setTimeout(() => {
              window.location.href = '/dashboard';
            }, 1500);
          </script>
        </body>
        </html>
      `, {
        headers: {
          'Content-Type': 'text/html',
          'Set-Cookie': `authToken=${token}; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}; Path=/`
        }
      })

      return htmlResponse

    } catch (tokenError) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/login?error=invalid_token`)
    }

  } catch (error) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/login?error=sso_error`)
  }
}