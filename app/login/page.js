'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Building2, Shield } from 'lucide-react'
import Image from 'next/image'

export default function LoginPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Redirect to dashboard if already authenticated (but only after auth check completes)
  useEffect(() => {
    if (!authLoading && user) {
      // Small delay to prevent redirect loops
      const timer = setTimeout(() => {
        router.replace('/dashboard')
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [user, authLoading, router])

  const handleAzureSignIn = async () => {
    setLoading(true)
    setError('')

    try {
      // Get tenant ID - if undefined in env, will fail gracefully
      const tenantId = process.env.NEXT_PUBLIC_AZURE_TENANT_ID || process.env.NEXT_PUBLIC_AZURE_AD_TENANT_ID

      if (!tenantId || tenantId === 'undefined') {
        setError('Azure authentication is not configured. Please contact IT support or use dev bypass if available.')
        setLoading(false)
        return
      }

      // Build Azure AD authorization URL
      const authUrl = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`)

      const clientId = process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || process.env.NEXT_PUBLIC_AZURE_AD_CLIENT_ID
      if (!clientId) {
        setError('Azure client ID is not configured.')
        setLoading(false)
        return
      }

      authUrl.searchParams.set('client_id', clientId)
      authUrl.searchParams.set('response_type', 'code')

      // Use page origin, sanitized for 0.0.0.0
      const origin = window.location.origin
        .replace('0.0.0.0', 'localhost')
        .replace('::', 'localhost')

      authUrl.searchParams.set('redirect_uri', `${origin}/api/auth/azure-callback`)
      authUrl.searchParams.set('scope', 'openid profile email User.Read')
      authUrl.searchParams.set('state', 'azure-sso')
      authUrl.searchParams.set('prompt', 'select_account')

      // Redirect to Azure AD
      window.location.href = authUrl.toString()
    } catch (error) {
      console.error('Azure sign-in error:', error)
      setError('Failed to initiate sign-in. Please try again.')
      setLoading(false)
    }
  }

  const handleDevLogin = () => {
    window.location.href = '/api/auth/dev-login'
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ backgroundColor: '#3d6964' }}>
      {/* Animated watermark background */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/2 left-0 transform -translate-y-1/2 animate-float-extra-slow"
          style={{
            opacity: 0.05,
            filter: 'invert(1) brightness(1.1)',
            clipPath: 'polygon(50% 0%, 10% 95%, 90% 95%)'
          }}
        >
          <Image
            src="/images/aidin-logo.png"
            alt="Aidin Watermark"
            width={400}
            height={400}
            className="object-contain"
          />
        </div>
      </div>

      <Card className="w-full max-w-md relative z-10">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-white flex items-center justify-center">
              <Image
                src="/images/aidin-logo.png"
                alt="Aidin Logo"
                width={92}
                height={92}
                className="object-contain"
              />
            </div>
          </div>
          <div className="text-black font-bold text-lg mb-2">AIDIN HELPDESK</div>
          <CardTitle className="text-2xl">Welcome Back</CardTitle>
          <CardDescription>
            Sign in with your Surterre Properties account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* SSO Sign In Button */}
          <div className="space-y-6">
            <Button
              type="button"
              className="w-full h-12 text-base"
              onClick={handleAzureSignIn}
              disabled={loading}
              style={{ backgroundColor: '#3d6964' }}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <Building2 className="mr-2 h-5 w-5" />
                  Sign in with Surterre Email
                </>
              )}
            </Button>

            {/* Dev Bypass Button - Only in development with AUTH_DEV_BYPASS=true */}
            {process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_AUTH_DEV_BYPASS === 'true' && (
              <Button
                type="button"
                variant="outline"
                className="w-full h-12 text-base"
                onClick={handleDevLogin}
              >
                🔓 Dev Login (Bypass)
              </Button>
            )}

            {/* Information Box */}
            <div className="bg-muted p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium mb-1">Secure Single Sign-On</p>
                  <p className="text-muted-foreground">
                    Use your Surterre Properties Microsoft account to access the helpdesk.
                    This ensures secure authentication through your organization's Active Directory.
                  </p>
                </div>
              </div>
            </div>

            {/* Help Text */}
            <div className="text-center text-sm text-muted-foreground">
              <p>Having trouble signing in?</p>
              <p className="mt-1">
                Contact IT support at{' '}
                <a href="mailto:helpdesk@surterreproperties.com" className="text-primary hover:underline">
                  helpdesk@surterreproperties.com
                </a>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
