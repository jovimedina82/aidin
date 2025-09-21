'use client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Ticket, Users, BarChart3, Zap, Shield, Clock } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

export default function HomePage() {
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(to bottom, #3d6964, #2d5248)' }}>
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          {/* Logo and Branding */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-32 h-32 rounded-full overflow-hidden bg-white flex items-center justify-center mb-4">
              <Image
                src="/images/aidin-logo.png"
                alt="Aidin Logo"
                width={120}
                height={120}
                className="object-contain"
              />
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-white mb-2">AIDIN</div>
              <div className="text-xl text-white/90 tracking-[0.2em] font-medium">HELPDESK</div>
            </div>
          </div>

          <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
            Streamline your staff support with our comprehensive helpdesk solution.
            Powered by AI for smart categorization, priority assignment, and response suggestions.
          </p>
          <div className="flex justify-center">
            <Button asChild size="lg" variant="outline" className="bg-white text-[#3d6964] border-white hover:bg-white/90">
              <Link href="/login">Sign In</Link>
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          <Card>
            <CardHeader>
              <Ticket className="h-8 w-8 mb-2" style={{ color: '#3d6964' }} />
              <CardTitle>Smart Ticket Management</CardTitle>
              <CardDescription>
                AI-powered ticket categorization, priority assignment, and automated workflows
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Automatic categorization</li>
                <li>• Priority suggestion</li>
                <li>• SLA tracking</li>
                <li>• Email integration</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Users className="h-8 w-8 mb-2" style={{ color: '#3d6964' }} />
              <CardTitle>Role-Based Access</CardTitle>
              <CardDescription>
                Comprehensive user management with role-based permissions and team assignments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Admin, Manager, Staff roles</li>
                <li>• Team-based assignments</li>
                <li>• Audit logging</li>
                <li>• Secure authentication</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <BarChart3 className="h-8 w-8 mb-2" style={{ color: '#3d6964' }} />
              <CardTitle>Analytics & Reporting</CardTitle>
              <CardDescription>
                Comprehensive insights into ticket volume, resolution times, and team performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Real-time dashboards</li>
                <li>• SLA compliance tracking</li>
                <li>• Performance metrics</li>
                <li>• Custom reports</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Zap className="h-8 w-8 mb-2" style={{ color: '#3d6964' }} />
              <CardTitle>AI-Powered Assistance</CardTitle>
              <CardDescription>
                Leverage artificial intelligence for smarter support and faster resolutions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Response suggestions</li>
                <li>• Auto-categorization</li>
                <li>• Priority detection</li>
                <li>• Pattern analysis</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Shield className="h-8 w-8 mb-2" style={{ color: '#3d6964' }} />
              <CardTitle>Security & Compliance</CardTitle>
              <CardDescription>
                Enterprise-grade security with comprehensive audit trails and data protection
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• End-to-end encryption</li>
                <li>• Audit trails</li>
                <li>• Data compliance</li>
                <li>• Access controls</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Clock className="h-8 w-8 mb-2" style={{ color: '#3d6964' }} />
              <CardTitle>SLA Management</CardTitle>
              <CardDescription>
                Advanced SLA tracking with business hours, holidays, and breach notifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Business hours support</li>
                <li>• Breach detection</li>
                <li>• Automated alerts</li>
                <li>• Custom calendars</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-8 border-t border-white/10">
        <div className="container mx-auto px-4">
          <div className="text-center text-white/50 text-sm">
            <p className="mb-1">© {new Date().getFullYear()} AIDIN Helpdesk. All rights reserved.</p>
            <p>Developed by Jovi Medina with the Support of Surterre Properties.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}