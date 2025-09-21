'use client'
import { useState } from 'react'
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
import { Plus, Loader2 } from 'lucide-react'
import { useApiCall } from '@/hooks/useAsyncOperation'
import { useForm } from '@/hooks/useForm'

const INITIAL_VALUES = {
  title: '',
  description: '',
  priority: 'NORMAL'
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
  const { makeAuthenticatedRequest } = useAuth()
  const [open, setOpen] = useState(false)

  const apiCall = useApiCall(makeAuthenticatedRequest)
  const form = useForm(INITIAL_VALUES, VALIDATION_RULES)

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!form.validate()) {
      return
    }

    try {
      const ticket = await apiCall.call('/api/tickets', {
        method: 'POST',
        body: JSON.stringify(form.values)
      }, {
        showSuccessToast: true,
        successMessage: 'Ticket created successfully!',
        onSuccess: (data) => {
          form.reset()
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
          Create Ticket
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
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