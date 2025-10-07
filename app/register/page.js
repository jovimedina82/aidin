'use client'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Building2 } from 'lucide-react'
import Image from 'next/image'

export default function RegisterPage() {
  const router = useRouter()

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
          <CardTitle className="text-2xl">Registration Disabled</CardTitle>
          <CardDescription>
            User accounts are managed through Single Sign-On
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Self-registration is not available. All user accounts are automatically created when you sign in with your Surterre Properties Microsoft account.
            </AlertDescription>
          </Alert>

          <div className="bg-muted p-4 rounded-lg">
            <div className="flex items-start gap-3">
              <Building2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium mb-2">For Surterre Properties Employees:</p>
                <p className="text-muted-foreground mb-3">
                  Simply sign in with your company Microsoft account. Your helpdesk account will be created automatically on first login.
                </p>
                <Button
                  onClick={() => router.push('/login')}
                  className="w-full"
                  style={{ backgroundColor: '#3d6964' }}
                >
                  Go to Sign In
                </Button>
              </div>
            </div>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            <p>Need help or have questions?</p>
            <p className="mt-1">
              Contact IT support at{' '}
              <a href="mailto:helpdesk@surterreproperties.com" className="text-primary hover:underline">
                helpdesk@surterreproperties.com
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
