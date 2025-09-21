'use client'
import { useState } from 'react'
import { useAuth } from '../../components/AuthProvider'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Loader2, Building2 } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

export default function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await login(formData.email, formData.password)
    
    if (result.success) {
      router.push('/dashboard')
    } else {
      setError(result.error)
    }
    
    setLoading(false)
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleAzureSignIn = async () => {
    setLoading(true)
    setError('')
    
    try {
      // Build Azure AD authorization URL directly
      const authUrl = new URL(`https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_AZURE_AD_TENANT_ID || 'a4000698-9e71-4f9a-8f4e-b64d8f8cbca7'}/oauth2/v2.0/authorize`)
      
      authUrl.searchParams.set('client_id', process.env.NEXT_PUBLIC_AZURE_AD_CLIENT_ID || '5e06ba03-616f-43e2-b4e2-a97b22669e3a')
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('redirect_uri', `${window.location.origin}/api/auth/azure-callback`)
      authUrl.searchParams.set('scope', 'openid profile email User.Read')
      authUrl.searchParams.set('state', 'azure-sso')
      
      // Redirect to Azure AD
      window.location.href = authUrl.toString()
    } catch (error) {
      setError('Failed to sign in with Azure AD. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ backgroundColor: '#3d6964' }}>
      {/* Animated watermark background */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/2 left-0 transform -translate-y-1/2 animate-float-single-slow"
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
          <div className="text-black font-bold text-lg mb-2">HELPDESK</div>
          <CardTitle className="text-2xl">Welcome Back</CardTitle>
          <CardDescription>
            Sign in to your Aidin account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Azure AD SSO Button */}
          <div className="space-y-4">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleAzureSignIn}
              disabled={loading}
            >
              <Building2 className="mr-2 h-4 w-4" />
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in with Surterre Properties email'
              )}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with email
                </span>
              </div>
            </div>
          </div>

          {/* Regular Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                required
              />
            </div>
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign In
            </Button>
          </form>
          
          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Don't have an account? </span>
            <Link href="/register" className="text-primary hover:underline">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}