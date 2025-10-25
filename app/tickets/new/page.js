'use client'
import { useState, useEffect } from 'react'
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
import { ArrowLeft, Loader2, Zap, Paperclip, X, File, Image } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

// Helper function to check if user has elevated privileges
const canCreateOnBehalfOf = (user) => {
  if (!user || !user.roles) return false
  const roleNames = user.roles.map(r => r.role?.name || r.name)
  return roleNames.some(role => ['Staff', 'Manager', 'Admin'].includes(role))
}

export default function NewTicketPage() {
  const { user, makeAuthenticatedRequest, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [selectedRequesterId, setSelectedRequesterId] = useState(null)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'NORMAL'
  })

  const showOnBehalfOf = canCreateOnBehalfOf(user)

  // Fetch users when component mounts (if user has permission)
  useEffect(() => {
    if (showOnBehalfOf && users.length === 0) {
      fetchUsers()
    }
  }, [showOnBehalfOf])

  const fetchUsers = async () => {
    setLoadingUsers(true)
    try {
      const response = await makeAuthenticatedRequest('/api/users')
      if (response.ok) {
        const data = await response.json()
        // Sort users alphabetically by name
        const sortedUsers = (data.data || data).sort((a, b) => {
          const nameA = `${a.firstName} ${a.lastName}`.toLowerCase()
          const nameB = `${b.firstName} ${b.lastName}`.toLowerCase()
          return nameA.localeCompare(nameB)
        })
        setUsers(sortedUsers)
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setLoadingUsers(false)
    }
  }

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || [])
    const validFiles = files.filter(file => {
      const maxSize = 25 * 1024 * 1024 // 25MB
      if (file.size > maxSize) {
        toast.error(`${file.name} is too large (max 25MB)`)
        return false
      }
      return true
    })
    setSelectedFiles(prev => [...prev, ...validFiles])
    e.target.value = '' // Reset input
  }

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const getFileIcon = (file) => {
    if (file.type.startsWith('image/')) {
      return <Image className="w-4 h-4 text-purple-600" />
    }
    return <File className="w-4 h-4 text-gray-600" />
  }

  const uploadAttachments = async (ticketId) => {
    if (selectedFiles.length === 0) return

    const uploadPromises = selectedFiles.map(async (file) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('ticketId', ticketId)

      const response = await makeAuthenticatedRequest('/api/attachments', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error(`Failed to upload ${file.name}`)
      }
    })

    await Promise.all(uploadPromises)
  }

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
      // Build request payload
      const payload = {
        ...formData
      }

      // Add requesterId if creating on behalf of someone
      if (showOnBehalfOf && selectedRequesterId) {
        payload.requesterId = selectedRequesterId
      }

      const response = await makeAuthenticatedRequest('/api/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
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

      // Upload attachments if any
      if (selectedFiles.length > 0) {
        try {
          await uploadAttachments(data.id)
          toast.success(`Ticket created successfully! #${data.ticketNumber} with ${selectedFiles.length} attachment(s)`)
        } catch (error) {
          toast.warning(`Ticket #${data.ticketNumber} created, but some attachments failed to upload`)
        }
      } else {
        toast.success(`Ticket created successfully! #${data.ticketNumber}`)
      }

      router.push(`/tickets/${data.id}`)
    } catch (error) {
      // console.error('Ticket creation error:', error)
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
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description *</Label>
                    <Textarea
                      id="description"
                      placeholder="Provide detailed information about your issue, including steps to reproduce, error messages, etc."
                      value={formData.description}
                      onChange={(e) => handleChange('description', e.target.value)}
                      className="min-h-[120px]"
                      required
                    />
                  </div>

                  {showOnBehalfOf && (
                    <div className="space-y-2">
                      <Label htmlFor="onBehalfOf">On behalf of (optional)</Label>
                      <Select value={selectedRequesterId || 'self'} onValueChange={(value) => setSelectedRequesterId(value === 'self' ? null : value)}>
                        <SelectTrigger>
                          <SelectValue placeholder={loadingUsers ? "Loading users..." : "Create for myself"} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="self">Create for myself</SelectItem>
                          {users.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.firstName} {u.lastName} ({u.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Select a user to create this ticket on their behalf
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select value={formData.priority} onValueChange={(value) => handleChange('priority', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">Low - General questions, minor issues</SelectItem>
                        <SelectItem value="NORMAL">Normal - Regular issues</SelectItem>
                        <SelectItem value="HIGH">High - Significant impact on work</SelectItem>
                        <SelectItem value="URGENT">Urgent - Critical issues, system down</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* File Attachments */}
                  <div className="space-y-2">
                    <Label>Attachments (optional)</Label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition-colors">
                      <input
                        type="file"
                        id="file-input"
                        className="hidden"
                        multiple
                        onChange={handleFileSelect}
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                      />
                      <label htmlFor="file-input" className="cursor-pointer">
                        <Paperclip className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm text-gray-600 mb-1">
                          Click to attach files or images
                        </p>
                        <p className="text-xs text-gray-500">
                          Max 25MB per file
                        </p>
                      </label>
                    </div>

                    {/* Selected Files List */}
                    {selectedFiles.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {selectedFiles.map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200"
                          >
                            <div className="flex items-center space-x-2 flex-1 min-w-0">
                              {getFileIcon(file)}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {file.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {formatFileSize(file.size)}
                                </p>
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFile(index)}
                              className="flex-shrink-0"
                            >
                              <X className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
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
