'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useAuth } from '../../../components/AuthProvider'
import ProtectedRoute from '../../../components/ProtectedRoute'
import Navbar from '../../../components/Navbar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Loader2, Zap } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

const ImageDropPaste = dynamic(() => import('../../../components/ImageDropPaste'), { ssr: false })

export default function NewTicketPage() {
  const { user, makeAuthenticatedRequest, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'NORMAL'
  })

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.title.trim() || !formData.description.trim()) {
      toast.error('Please fill in all required fields')
      return
    }

    // Check if user is authenticated
    if (!user) {
      toast.error('You must be logged in to create a ticket')
      router.push('/login')
      return
    }

    setLoading(true)

    try {
      const response = await makeAuthenticatedRequest('/api/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (!response.ok) {
        // If we get a 401, redirect to login
        if (response.status === 401) {
          toast.error('Session expired. Please login again.')
          router.push('/login')
          return
        }
        throw new Error(data.error || 'Failed to create ticket')
      }

      toast.success(`Ticket created successfully! #${data.ticketNumber}`)
      router.push(`/tickets/${data.id}`)
    } catch (error) {
      console.error('Ticket creation error:', error)
      toast.error(error.message || 'Failed to create ticket')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // Show loading state while auth is being checked
  if (authLoading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Navbar />

        <main className="container mx-auto px-4 py-8">
          {/* Debug info - only in development */}
          {process.env.NODE_ENV !== 'production' && (
            <div className="mb-4 p-2 bg-yellow-100 rounded text-xs">
              Auth Status: {user ? `Logged in as ${user.email}` : 'Not authenticated'} |
              Token: {typeof window !== 'undefined' && localStorage.getItem('authToken') ? 'Present' : 'Missing'}
            </div>
          )}

          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/tickets')}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Tickets
            </Button>
          </div>

          <div className="max-w-2xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Create New Ticket
                </CardTitle>
                <CardDescription>
                  Describe your issue or request in detail. Our AI will automatically categorize and prioritize your ticket.
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      placeholder="Brief description of your issue"
                      value={formData.title}
                      onChange={(e) => handleChange('title', e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Be specific and concise about the problem you're experiencing
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="description">Description *</Label>
                    <ImageDropPaste
                      targetTextAreaSelector="#description"
                      className="mb-3"
                    />
                    <Textarea
                      id="description"
                      placeholder="Provide detailed information about your issue, including:
• What you were trying to do
• What happened instead
• Any error messages you saw
• Steps to reproduce the problem
• Your operating system and browser (if relevant)

You can also paste or drag & drop images directly into this field!"
                      value={formData.description}
                      onChange={(e) => handleChange('description', e.target.value)}
                      className="min-h-[200px]"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      The more details you provide, the faster we can help you
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select value={formData.priority} onValueChange={(value) => handleChange('priority', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">
                          <div>
                            <div className="font-medium">Low</div>
                            <div className="text-xs text-muted-foreground">General questions, minor issues</div>
                          </div>
                        </SelectItem>
                        <SelectItem value="NORMAL">
                          <div>
                            <div className="font-medium">Normal</div>
                            <div className="text-xs text-muted-foreground">Regular issues that don't block work</div>
                          </div>
                        </SelectItem>
                        <SelectItem value="HIGH">
                          <div>
                            <div className="font-medium">High</div>
                            <div className="text-xs text-muted-foreground">Issues that significantly impact productivity</div>
                          </div>
                        </SelectItem>
                        <SelectItem value="URGENT">
                          <div>
                            <div className="font-medium">Urgent</div>
                            <div className="text-xs text-muted-foreground">Critical issues, system down, security concerns</div>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="bg-muted/50 p-4 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Zap className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <h4 className="font-medium text-sm">AI-Powered Processing</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          When you submit this ticket, our AI will automatically:
                        </p>
                        <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                          <li>• Categorize your issue based on the description</li>
                          <li>• Suggest the appropriate priority level</li>
                          <li>• Generate response suggestions for our support team</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => router.push('/tickets')}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={loading} className="flex-1">
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create Ticket
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  )
}