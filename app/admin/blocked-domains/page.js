'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import Navbar from '@/components/Navbar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Shield, Plus, Trash2, AlertCircle, CheckCircle, Ban } from 'lucide-react'
import { toast } from 'sonner'

export default function BlockedDomainsPage() {
  const { user, makeAuthenticatedRequest } = useAuth()
  const [domains, setDomains] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newDomain, setNewDomain] = useState('')
  const [newReason, setNewReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Check if user is admin
  const userRoleNames = user?.roles?.map(role =>
    typeof role === 'string' ? role : (role.role?.name || role.name)
  ) || []
  const isAdmin = userRoleNames.some(role => ['Admin', 'Manager'].includes(role))

  useEffect(() => {
    if (user) {
      fetchDomains()
    }
  }, [user])

  const fetchDomains = async () => {
    try {
      setLoading(true)
      const response = await makeAuthenticatedRequest('/api/admin/blocked-domains')

      if (response.ok) {
        const data = await response.json()
        setDomains(data.domains || [])
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to fetch blocked domains')
      }
    } catch (error) {
      // console.error('Failed to fetch blocked domains:', error)
      toast.error('Failed to fetch blocked domains')
    } finally {
      setLoading(false)
    }
  }

  const handleAddDomain = async (e) => {
    e.preventDefault()

    if (!newDomain.trim()) {
      toast.error('Domain is required')
      return
    }

    try {
      setSubmitting(true)
      const response = await makeAuthenticatedRequest('/api/admin/blocked-domains', {
        method: 'POST',
        body: JSON.stringify({
          domain: newDomain.trim(),
          reason: newReason.trim()
        })
      })

      if (response.ok) {
        toast.success(`Domain "${newDomain}" has been blocked`)
        setNewDomain('')
        setNewReason('')
        setShowAddForm(false)
        fetchDomains()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to block domain')
      }
    } catch (error) {
      // console.error('Failed to block domain:', error)
      toast.error('Failed to block domain')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUnblockDomain = async (domainId, domainName) => {
    const confirmed = confirm(`Are you sure you want to unblock "${domainName}"?\n\nEmails from this domain will be able to create tickets again.`)

    if (!confirmed) return

    try {
      const response = await makeAuthenticatedRequest(`/api/admin/blocked-domains/${domainId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success(`Domain "${domainName}" has been unblocked`)
        fetchDomains()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to unblock domain')
      }
    } catch (error) {
      // console.error('Failed to unblock domain:', error)
      toast.error('Failed to unblock domain')
    }
  }

  if (!isAdmin) {
    return (
      <>
        <Navbar />
        <div className="container mx-auto px-4 py-8 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <AlertCircle className="h-6 w-6 text-red-600" />
                <span>Access Denied</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p>You don't have permission to access this page. Only admins can manage blocked domains.</p>
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <div className="container mx-auto px-4 py-8 pt-4 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-[#3d6964] p-3 rounded-lg">
                <Ban className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Blocked Senders</h1>
                <p className="text-gray-600 mt-1">
                  Manage email senders that are blocked from creating tickets
                </p>
              </div>
            </div>
            <Button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-[#3d6964] hover:bg-[#2d5954] text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Block Sender
            </Button>
          </div>
        </div>

        {/* Stats Card */}
        <Card className="mb-6 border-[#3d6964]/20">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <div className="bg-red-100 p-3 rounded-lg">
                <Shield className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Blocked Senders</p>
                <p className="text-2xl font-bold text-gray-900">{domains.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Add Domain Form */}
        {showAddForm && (
          <Card className="mb-6 border-[#3d6964]/20">
            <CardHeader>
              <CardTitle className="text-lg">Block New Sender</CardTitle>
              <CardDescription>
                Add an email sender to prevent them from creating tickets
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddDomain} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="domain">Domain *</Label>
                  <Input
                    id="domain"
                    type="text"
                    placeholder="example.com"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    required
                    className="focus:border-[#3d6964] focus:ring-[#3d6964]"
                  />
                  <p className="text-xs text-gray-500">
                    Enter the domain without "http://" or "@" (e.g., "vendor.com")
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reason">Reason (Optional)</Label>
                  <Textarea
                    id="reason"
                    placeholder="Why is this domain being blocked?"
                    value={newReason}
                    onChange={(e) => setNewReason(e.target.value)}
                    rows={3}
                    className="focus:border-[#3d6964] focus:ring-[#3d6964]"
                  />
                </div>

                <div className="flex space-x-3">
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="bg-[#3d6964] hover:bg-[#2d5954] text-white"
                  >
                    {submitting ? 'Blocking...' : 'Block Sender'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowAddForm(false)
                      setNewDomain('')
                      setNewReason('')
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Blocked Senders List */}
        <Card className="border-[#3d6964]/20">
          <CardHeader>
            <CardTitle>Blocked Senders</CardTitle>
            <CardDescription>
              Emails from these senders will not create tickets
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-gray-500">
                Loading blocked domains...
              </div>
            ) : domains.length === 0 ? (
              <div className="text-center py-12">
                <Ban className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-2">No blocked senders yet</p>
                <p className="text-sm text-gray-400">
                  Click "Block Sender" to add a sender to the blocklist
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {domains.map((domain) => (
                  <div
                    key={domain.id}
                    className="flex items-start justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <Badge variant="destructive" className="bg-red-600">
                          <Ban className="h-3 w-3 mr-1" />
                          Blocked
                        </Badge>
                        <span className="font-semibold text-gray-900">
                          {domain.domain}
                        </span>
                      </div>

                      {domain.reason && (
                        <p className="text-sm text-gray-600 mb-2">
                          <strong>Reason:</strong> {domain.reason}
                        </p>
                      )}

                      <div className="text-xs text-gray-500">
                        Blocked by{' '}
                        {domain.blockedByUser
                          ? `${domain.blockedByUser.firstName} ${domain.blockedByUser.lastName}`
                          : 'Unknown'}{' '}
                        on {new Date(domain.blockedAt).toLocaleDateString()}
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUnblockDomain(domain.id, domain.domain)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Unblock
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Box */}
        <Card className="mt-6 bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-semibold mb-1">How Sender Blocking Works</p>
                <ul className="list-disc list-inside space-y-1 text-blue-800">
                  <li>Emails from blocked senders are rejected at the API level</li>
                  <li>No tickets are created for blocked senders</li>
                  <li>Blocked emails are logged for AI training purposes</li>
                  <li>You can unblock a sender at any time to allow emails again</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
