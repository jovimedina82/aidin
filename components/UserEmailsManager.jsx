'use client'
import { useState, useEffect } from 'react'
import { useAuth } from './AuthProvider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Mail, Plus, Trash2, CheckCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'

export default function UserEmailsManager() {
  const { makeAuthenticatedRequest, user } = useAuth()
  const [emails, setEmails] = useState([])
  const [loading, setLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailToDelete, setEmailToDelete] = useState(null)
  const [primaryEmail, setPrimaryEmail] = useState('')

  useEffect(() => {
    if (user) {
      fetchEmails()
    }
  }, [user])

  const fetchEmails = async () => {
    try {
      setLoading(true)
      const response = await makeAuthenticatedRequest('/api/user-emails')

      if (response.ok) {
        const data = await response.json()
        setPrimaryEmail(data.primaryEmail)
        setEmails(data.alternateEmails || [])
      }
    } catch (error) {
      console.error('Failed to fetch emails:', error)
      toast.error('Failed to load email addresses')
    } finally {
      setLoading(false)
    }
  }

  const handleAddEmail = async () => {
    if (!newEmail.trim()) {
      toast.error('Please enter an email address')
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newEmail)) {
      toast.error('Please enter a valid email address')
      return
    }

    try {
      const response = await makeAuthenticatedRequest('/api/user-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmail,
          emailType: 'personal'
        })
      })

      if (response.ok) {
        toast.success('Email address added successfully')
        setNewEmail('')
        setIsAddDialogOpen(false)
        fetchEmails()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to add email address')
      }
    } catch (error) {
      console.error('Failed to add email:', error)
      toast.error('Failed to add email address')
    }
  }

  const handleDeleteEmail = async (emailId) => {
    try {
      const response = await makeAuthenticatedRequest(
        `/api/user-emails?id=${emailId}`,
        { method: 'DELETE' }
      )

      if (response.ok) {
        toast.success('Email address removed successfully')
        setEmailToDelete(null)
        fetchEmails()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to remove email address')
      }
    } catch (error) {
      console.error('Failed to remove email:', error)
      toast.error('Failed to remove email address')
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Addresses
            </CardTitle>
            <CardDescription>
              Manage your email addresses for ticket notifications
            </CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Email
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Alternate Email</DialogTitle>
                <DialogDescription>
                  Add an additional email address to receive ticket notifications.
                  This could be your personal Gmail, Yahoo, or other email account.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="text-sm font-medium">Email Address</label>
                  <Input
                    type="email"
                    placeholder="your.email@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAddEmail()
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    You'll receive ticket notifications on this email
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setNewEmail('')
                    setIsAddDialogOpen(false)
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleAddEmail}>
                  Add Email
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-12 bg-muted rounded"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Primary Email */}
            <div className="flex items-center justify-between p-3 border rounded-lg bg-blue-50 border-blue-200">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-blue-600" />
                <div>
                  <div className="font-medium text-sm">{primaryEmail}</div>
                  <div className="text-xs text-muted-foreground">
                    Primary email from Microsoft Entra
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-blue-600">Primary</Badge>
                <Badge variant="outline" className="bg-green-50 border-green-200 text-green-700">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Verified
                </Badge>
              </div>
            </div>

            {/* Alternate Emails */}
            {emails.length > 0 ? (
              emails.map((email) => (
                <div
                  key={email.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium text-sm">{email.email}</div>
                      <div className="text-xs text-muted-foreground">
                        {email.emailType === 'personal' ? 'Personal email' :
                         email.emailType === 'work' ? 'Work email' : 'Alternate email'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {email.isVerified ? (
                      <Badge variant="outline" className="bg-green-50 border-green-200 text-green-700">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Verified
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-yellow-50 border-yellow-200 text-yellow-700">
                        <XCircle className="h-3 w-3 mr-1" />
                        Unverified
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEmailToDelete(email)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No alternate email addresses</p>
                <p className="text-xs mt-1">
                  Add your personal email to receive notifications on multiple addresses
                </p>
              </div>
            )}

            {/* Info box */}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-800">
                <strong>💡 Tip:</strong> When you create tickets from external emails (Gmail, Yahoo, etc.),
                the system automatically links them to your Surterre Properties account.
                All your emails will receive ticket notifications.
              </p>
            </div>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!emailToDelete} onOpenChange={() => setEmailToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Email Address?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove <strong>{emailToDelete?.email}</strong>?
                You will no longer receive ticket notifications on this email address.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleDeleteEmail(emailToDelete?.id)}
                className="bg-red-600 hover:bg-red-700"
              >
                Remove Email
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
