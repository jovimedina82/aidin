'use client'
import { useState, useEffect } from 'react'
import { useAuth } from './AuthProvider'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Plus, Loader2, Paperclip, X, File, Image } from 'lucide-react'
import { useApiCall } from '@/hooks/useAsyncOperation'
import { useForm } from '@/hooks/useForm'
import { toast } from 'sonner'

const INITIAL_VALUES = {
  title: '',
  description: '',
  priority: 'NORMAL'
}

// Helper function to check if user has elevated privileges
const canCreateOnBehalfOf = (user) => {
  if (!user || !user.roles) return false
  const roleNames = user.roles.map(r => r.role?.name || r.name)
  return roleNames.some(role => ['Staff', 'Manager', 'Admin'].includes(role))
}

const VALIDATION_RULES = {
  title: {
    required: true,
    minLength: 3,
    maxLength: 200,
    message: 'Title must be between 3 and 200 characters'
  },
  description: {
    required: true,
    minLength: 10,
    maxLength: 2000,
    message: 'Description must be between 10 and 2000 characters'
  }
}

export default function CreateTicketDialog({ onTicketCreated }) {
  const { makeAuthenticatedRequest, user } = useAuth()
  const [open, setOpen] = useState(false)
  const [users, setUsers] = useState([])
  const [selectedRequesterId, setSelectedRequesterId] = useState(null)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState([])

  const apiCall = useApiCall(makeAuthenticatedRequest)
  const form = useForm(INITIAL_VALUES, VALIDATION_RULES)
  const showOnBehalfOf = canCreateOnBehalfOf(user)

  // Fetch users when dialog opens (if user has permission)
  useEffect(() => {
    if (open && showOnBehalfOf && users.length === 0) {
      fetchUsers()
    }
  }, [open, showOnBehalfOf])

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

    if (!form.validate()) {
      return
    }

    try {
      // Build request payload
      const payload = {
        ...form.values
      }

      // Add requesterId if creating on behalf of someone
      if (showOnBehalfOf && selectedRequesterId) {
        payload.requesterId = selectedRequesterId
      }

      const ticket = await apiCall.call('/api/tickets', {
        method: 'POST',
        body: JSON.stringify(payload)
      }, {
        showSuccessToast: selectedFiles.length === 0,
        successMessage: 'Ticket created successfully!',
        onSuccess: async (data) => {
          // Upload attachments if any
          if (selectedFiles.length > 0) {
            try {
              await uploadAttachments(data.id)
              toast.success(`Ticket created with ${selectedFiles.length} attachment(s)!`)
            } catch (error) {
              toast.warning('Ticket created, but some attachments failed to upload')
            }
          }

          form.reset()
          setSelectedRequesterId(null)
          setSelectedFiles([])
          setOpen(false)
          onTicketCreated?.(data)
        }
      })
    } catch (error) {
      // Error handling is done by useApiCall
    }
  }

  const handlePriorityChange = (value) => {
    form.setValue('priority', value)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Ticket
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Ticket</DialogTitle>
          <DialogDescription>
            Describe your issue or request in detail. Our AI will automatically categorize and prioritize your ticket.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="Brief description of your issue"
              {...form.getFieldProps('title')}
              className={form.errors.title && form.touched.title ? 'border-red-500' : ''}
            />
            {form.errors.title && form.touched.title && (
              <p className="text-sm text-red-600">{form.errors.title}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder="Provide detailed information about your issue, including steps to reproduce, error messages, etc."
              {...form.getFieldProps('description')}
              className={`min-h-[120px] ${form.errors.description && form.touched.description ? 'border-red-500' : ''}`}
            />
            {form.errors.description && form.touched.description && (
              <p className="text-sm text-red-600">{form.errors.description}</p>
            )}
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
              <p className="text-xs text-gray-500">
                Select a user to create this ticket on their behalf
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select value={form.values.priority} onValueChange={handlePriorityChange}>
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={apiCall.loading}>
              {apiCall.loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Ticket
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}