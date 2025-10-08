'use client'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useAuth } from '../../../components/AuthProvider'
import ProtectedRoute from '../../../components/ProtectedRoute'
import Navbar from '../../../components/Navbar'
import VirtualAssistant from '../../../components/VirtualAssistant'
import AttachmentUpload from '../../../components/AttachmentUpload'
import TicketThread from '../../../components/TicketThread'
import AIDraftReview from '../../../components/AIDraftReview'

const ImageGallery = dynamic(() => import('../../../components/ImageGallery'), { ssr: false })
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import MentionTextarea from '../../../components/MentionTextarea'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  ArrowLeft,
  Clock,
  User,
  MessageCircle,
  Send,
  Settings,
  AlertCircle,
  CheckCircle,
  XCircle,
  Pause,
  Paperclip
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'

export default function TicketDetailPage({ params }) {
  const { makeAuthenticatedRequest, user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [submittingComment, setSubmittingComment] = useState(false)
  const [users, setUsers] = useState([])
  const [showAssistant, setShowAssistant] = useState(false)
  const [assistantMinimized, setAssistantMinimized] = useState(false)

  const isStaff = user?.roles?.some(role => ['Admin', 'Manager', 'Staff'].includes(role))
  const isAdmin = user?.roles?.some(role => ['Admin', 'Manager'].includes(role))
  const canEdit = isStaff || ticket?.requesterId === user?.id

  // Handle back navigation to previous view
  const handleBackNavigation = () => {
    const returnParams = searchParams.get('return')
    if (returnParams) {
      try {
        const decodedParams = decodeURIComponent(returnParams)
        const urlParams = new URLSearchParams(decodedParams)

        // Build the return URL with all the previous state
        const returnUrl = `/tickets?${urlParams.toString()}`
        router.push(returnUrl)
      } catch (error) {
        console.error('Failed to parse return parameters:', error)
        // Fallback to basic tickets page
        router.push('/tickets')
      }
    } else {
      // No return state, go to default tickets page
      router.push('/tickets')
    }
  }

  useEffect(() => {
    if (params.id) {
      fetchTicket()
      if (isStaff) {
        fetchUsers()
      }
    }
  }, [params.id, isStaff])

  const fetchTicket = async () => {
    try {
      const response = await makeAuthenticatedRequest(`/api/tickets/${params.id}`)
      if (response.ok) {
        const data = await response.json()
        setTicket(data)
      } else if (response.status === 404) {
        toast.error('Ticket not found')
        router.push('/tickets')
      } else if (response.status === 403) {
        toast.error('Access denied')
        router.push('/tickets')
      }
    } catch (error) {
      console.error('Failed to fetch ticket:', error)
      toast.error('Failed to load ticket')
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await makeAuthenticatedRequest('/api/users')
      if (response.ok) {
        const data = await response.json()
        // Filter to only show Staff, Manager, and Admin users
        const staffUsers = data.filter(user => {
          const userRoles = user.roles || []
          return userRoles.some(role => {
            const roleName = typeof role === 'string' ? role : (role.role?.name || role.name)
            return ['Staff', 'Manager', 'Admin'].includes(roleName)
          })
        })
        setUsers(staffUsers)
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    }
  }

  const handleAddComment = async (e) => {
    e.preventDefault()
    if (!newComment.trim()) return

    setSubmittingComment(true)
    try {
      const response = await makeAuthenticatedRequest(`/api/tickets/${params.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          content: newComment,
          isInternal: isInternal
        })
      })

      if (response.ok) {
        setNewComment('')
        setIsInternal(false)
        fetchTicket() // Refresh to get new comment
        toast.success('Comment added successfully')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to add comment')
      }
    } catch (error) {
      toast.error('Failed to add comment')
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleUpdateTicket = async (field, value) => {
    try {
      const response = await makeAuthenticatedRequest(`/api/tickets/${params.id}`, {
        method: 'PUT',
        body: JSON.stringify({ [field]: value })
      })

      if (response.ok) {
        const updatedTicket = await response.json()
        setTicket(updatedTicket)
        toast.success('Ticket updated successfully')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to update ticket')
      }
    } catch (error) {
      toast.error('Failed to update ticket')
    }
  }

  const updateTicketStatus = async (newStatus) => {
    try {
      const response = await makeAuthenticatedRequest(`/api/tickets/${params.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      })
      
      if (response.ok) {
        const updatedTicket = await response.json()
        setTicket(updatedTicket)
        toast.success(`Ticket marked as ${newStatus.toLowerCase().replace('_', ' ')}`)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to update ticket status')
      }
    } catch (error) {
      console.error('Failed to update ticket status:', error)
      toast.error('Failed to update ticket status')
    }
  }

  const getStatusIcon = (status) => {
    const icons = {
      NEW: <AlertCircle className="w-4 h-4 text-red-500" />,
      OPEN: <AlertCircle className="w-4 h-4 text-red-500" />,
      PENDING: <Clock className="w-4 h-4 text-blue-500" />,
      ON_HOLD: <Pause className="w-4 h-4 text-orange-500" />,
      SOLVED: <CheckCircle className="w-4 h-4 text-green-500" />
    }
    return icons[status] || icons.NEW
  }

  const getStatusBadge = (status) => {
    const statusConfig = {
      NEW: { label: 'New', className: 'bg-red-100 text-red-800 border-red-200' },
      OPEN: { label: 'Open', className: 'bg-red-100 text-red-800 border-red-200' },
      PENDING: { label: 'Pending', className: 'bg-blue-100 text-blue-800 border-blue-200' },
      ON_HOLD: { label: 'On Hold', className: 'bg-orange-100 text-orange-800 border-orange-200' },
      SOLVED: { label: 'Solved', className: 'bg-green-100 text-green-800 border-green-200' }
    }
    
    const config = statusConfig[status] || statusConfig.NEW
    return (
      <Badge variant="outline" className={config.className}>
        <div className="flex items-center space-x-1">
          {getStatusIcon(status)}
          <span>{config.label}</span>
        </div>
      </Badge>
    )
  }

  const assignToSelf = async () => {
    try {
      const isAdminTakeover = ticket.assignee && ticket.assigneeId !== user.id && isAdmin
      const previousAssignee = ticket.assignee
      
      const response = await makeAuthenticatedRequest(`/api/tickets/${params.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ 
          assigneeId: user.id,
          status: 'OPEN' // Change status to OPEN when taking the ticket
        })
      })
      
      if (response.ok) {
        const updatedTicket = await response.json()
        setTicket(updatedTicket)
        
        if (isAdminTakeover) {
          toast.success('Ticket reassigned to you (Admin takeover)! User will be notified.')
          
          // Add admin takeover comment
          await makeAuthenticatedRequest(`/api/tickets/${params.id}/comments`, {
            method: 'POST',
            body: JSON.stringify({
              content: `🛡️ **Admin Takeover by ${user.firstName} ${user.lastName}**\n\nThis ticket has been escalated and taken over by system administration. Previously assigned to: ${previousAssignee.firstName} ${previousAssignee.lastName}\n\nI'm now personally handling this issue and will provide advanced technical support.`,
              isPublic: true,
              isInternal: false
            })
          })
        } else {
          toast.success('Ticket assigned to you successfully! User will be notified.')
          
          // Add regular assignment comment
          await makeAuthenticatedRequest(`/api/tickets/${params.id}/comments`, {
            method: 'POST',
            body: JSON.stringify({
              content: `🔧 **Ticket taken by ${user.firstName} ${user.lastName}**\n\nI'm now working on this issue and will provide updates as I troubleshoot the problem.`,
              isPublic: true,
              isInternal: false
            })
          })
        }
        
        // Refresh ticket data
        fetchTicket()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to assign ticket')
      }
    } catch (error) {
      console.error('Failed to assign ticket:', error)
      toast.error('Failed to assign ticket to yourself')
    }
  }

  const escalateToAdmin = async () => {
    try {
      // Find an admin user to escalate to
      const usersResponse = await makeAuthenticatedRequest('/api/users')
      if (!usersResponse.ok) {
        toast.error('Failed to load users for escalation')
        return
      }

      const usersData = await usersResponse.json()
      // Handle both array format and object with users property
      const users = Array.isArray(usersData) ? usersData : usersData.users || []

      console.log('Users data for escalation:', users)

      const adminUser = users.find(u => {
        const roles = u.roles || []
        const hasAdminRole = roles.some(role => {
          // Handle both role.name and role.role.name formats
          const roleName = role.name || role.role?.name
          return roleName === 'Admin'
        })
        console.log(`User ${u.firstName} ${u.lastName} has admin role:`, hasAdminRole, 'roles:', roles)
        return hasAdminRole
      })

      console.log('Found admin user:', adminUser)

      if (!adminUser) {
        toast.error('No admin users found for escalation')
        return
      }

      const response = await makeAuthenticatedRequest(`/api/tickets/${params.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          assigneeId: adminUser.id,
          status: 'OPEN',
          priority: 'HIGH' // Escalated tickets get high priority
        })
      })

      if (response.ok) {
        const updatedTicket = await response.json()
        setTicket(updatedTicket)
        toast.success(`Ticket escalated to admin: ${adminUser.firstName} ${adminUser.lastName}`)

        // Add escalation comment
        await makeAuthenticatedRequest(`/api/tickets/${params.id}/comments`, {
          method: 'POST',
          body: JSON.stringify({
            content: `⬆️ **Ticket Escalated to Admin**\n\nThis ticket has been escalated to ${adminUser.firstName} ${adminUser.lastName} (System Admin) for advanced troubleshooting.\n\n**Reason**: Issue requires higher-level technical expertise or system administrative access.`,
            isPublic: true,
            isInternal: false
          })
        })

        // Refresh ticket data
        fetchTicket()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to escalate ticket')
      }
    } catch (error) {
      console.error('Failed to escalate ticket:', error)
      toast.error('Failed to escalate ticket to admin')
    }
  }

  const markAsNotATicket = async () => {
    const reason = prompt(
      'Why is this not a ticket? (Optional - helps AI learn)',
      'This email should not have been classified as a helpdesk ticket'
    )

    if (reason === null) {
      return // User cancelled
    }

    const confirmed = confirm(
      `Are you sure this is NOT a ticket?\n\n` +
      `This will:\n` +
      `• Delete ticket #${ticket.ticketNumber}\n` +
      `• Forward original email to help@surterreproperties.com\n` +
      `• Help train AI to avoid similar classifications\n\n` +
      `This action cannot be undone.`
    )

    if (!confirmed) {
      return
    }

    try {
      const response = await makeAuthenticatedRequest(`/api/tickets/${params.id}/mark-not-ticket`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      })

      if (response.ok) {
        toast.success('Ticket marked as "not a ticket" and removed')
        router.push('/tickets')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to mark as not a ticket')
      }
    } catch (error) {
      console.error('Failed to mark as not a ticket:', error)
      toast.error('Failed to mark as not a ticket')
    }
  }

  const getPriorityColor = (priority) => {
    const colors = {
      LOW: 'bg-green-100 text-green-800',
      NORMAL: 'bg-blue-100 text-blue-800',
      HIGH: 'bg-orange-100 text-orange-800',
      URGENT: 'bg-red-100 text-red-800'
    }
    return colors[priority] || 'bg-gray-100 text-gray-800'
  }

  const getStatusColor = (status) => {
    const colors = {
      NEW: 'bg-gray-100 text-gray-800',
      OPEN: 'bg-blue-100 text-blue-800',
      PENDING: 'bg-yellow-100 text-yellow-800',
      ON_HOLD: 'bg-orange-100 text-orange-800',
      SOLVED: 'bg-green-100 text-green-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-background">
          <Navbar />
          <main className="container mx-auto px-4 py-8">
            <div className="animate-pulse space-y-6">
              <div className="h-8 bg-muted rounded w-1/3"></div>
              <div className="h-64 bg-muted rounded"></div>
              <div className="h-32 bg-muted rounded"></div>
            </div>
          </main>
        </div>
      </ProtectedRoute>
    )
  }

  if (!ticket) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-background">
          <Navbar />
          <main className="container mx-auto px-4 py-8">
            <div className="text-center py-12">
              <h1 className="text-2xl font-bold mb-6">Ticket not found</h1>
              <Button
                onClick={handleBackNavigation}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 text-base shadow-lg border-0"
              >
                <ArrowLeft className="mr-3 h-5 w-5" />
                {searchParams.get('return') ? '← Back to Previous View' : '← Back to Tickets'}
              </Button>
            </div>
          </main>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Navbar />

        {/* Back Button Header - positioned below navbar */}
        <div className="pt-20">
          <div className="bg-gray-50 border-b border-gray-200 py-3">
            <div className="container mx-auto px-4">
              <button
                onClick={handleBackNavigation}
                className="inline-flex items-center text-gray-600 hover:text-gray-800 font-medium text-sm transition-colors"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {searchParams.get('return') ? 'Back to Previous View' : 'Back to Tickets'}
              </button>
            </div>
          </div>
        </div>

        <main className="container mx-auto px-4 py-8">

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Ticket Header */}
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          #{ticket.ticketNumber}
                        </span>
                        <Badge className={getPriorityColor(ticket.priority)}>
                          {ticket.priority}
                        </Badge>
                        {getStatusBadge(ticket.status)}
                      </div>
                      <h1 className="text-2xl font-bold">{ticket.title}</h1>
                      {ticket.category && (
                        <Badge variant="outline">{ticket.category}</Badge>
                      )}
                    </div>
                    
                    {/* Staff Actions */}
                    {isStaff && (
                      <div className="flex items-center space-x-3">
                        {/* Take it Button (for unassigned tickets) */}
                        {!ticket.assignee && !(isStaff && !isAdmin && ticket.requesterId === user?.id) && (
                          <Button
                            onClick={() => assignToSelf()}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <User className="w-4 h-4 mr-2" />
                            Take it!
                          </Button>
                        )}

                        {/* Message for staff who can't take their own tickets */}
                        {!ticket.assignee && isStaff && !isAdmin && ticket.requesterId === user?.id && (
                          <div className="text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded border border-amber-200">
                            Staff members cannot take tickets they created themselves. Please wait for another staff member, manager, or admin to assign this ticket.
                          </div>
                        )}
                        
                        {/* Admin Take Over Button (for tickets assigned to others) */}
                        {isAdmin && ticket.assignee && ticket.assigneeId !== user?.id && (
                          <Button 
                            onClick={() => assignToSelf()}
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                          >
                            <User className="w-4 h-4 mr-2" />
                            Take Over (Admin)
                          </Button>
                        )}
                        
                        {/* Escalate Button (for assigned tickets - agents only) */}
                        {!isAdmin && ticket.assignee && ticket.assigneeId === user?.id && (
                          <Button
                            onClick={() => escalateToAdmin()}
                            variant="outline"
                            className="border-orange-500 text-orange-600 hover:bg-orange-50"
                          >
                            <AlertCircle className="w-4 h-4 mr-2" />
                            Escalate to Admin
                          </Button>
                        )}

                        {/* Not a Ticket Button */}
                        <Button
                          onClick={() => markAsNotATicket()}
                          variant="outline"
                          className="border-red-500 text-red-600 hover:bg-red-50"
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Not a ticket?
                        </Button>

                        {/* Status Management Dropdown */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline">
                              <Settings className="w-4 h-4 mr-2" />
                              Change Status
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => updateTicketStatus('OPEN')}>
                              <AlertCircle className="w-4 h-4 mr-2 text-red-500" />
                              Mark as Open
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateTicketStatus('PENDING')}>
                              <Clock className="w-4 h-4 mr-2 text-blue-500" />
                              Mark as Pending
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateTicketStatus('ON_HOLD')}>
                              <Pause className="w-4 h-4 mr-2 text-orange-500" />
                              Put On Hold
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateTicketStatus('SOLVED')}>
                              <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                              Mark as Solved
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="prose max-w-none ticket-content">
                    <p className="whitespace-pre-wrap">{ticket.description}</p>
                  </div>

                  {/* Image Gallery for inline attachments */}
                  {ticket.attachments && Array.isArray(ticket.attachments) && ticket.attachments.length > 0 && (
                    <ImageGallery images={ticket.attachments.map((url) => ({
                      url,
                      thumb: url.includes('.webp') ? url.replace('.webp', '_thumb.webp') : url
                    }))} />
                  )}

                  <div className="flex items-center gap-4 mt-6 pt-6 border-t text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <User size={16} />
                      <span>Created by {ticket.requester?.firstName && ticket.requester?.lastName ? `${ticket.requester.firstName} ${ticket.requester.lastName}` : 'Unknown User'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock size={16} />
                      <span>{formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Attachments */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Paperclip size={20} />
                    Attachments
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <AttachmentUpload
                    ticketId={params.id}
                    existingAttachments={ticket.attachments || []}
                    onUploadComplete={() => fetchTicket()}
                    readOnly={!canEdit}
                  />
                </CardContent>
              </Card>

              {/* AI Draft Response Review */}
              <AIDraftReview ticket={ticket} onUpdate={fetchTicket} />

              {/* Comments */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageCircle size={20} />
                    Comments ({ticket.comments?.length || 0})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {ticket.comments?.map((comment) => (
                    <div key={comment.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {comment.user.firstName[0]}{comment.user.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <span className="font-medium">
                              {comment.user.firstName} {comment.user.lastName}
                            </span>
                            {comment.isInternal && (
                              <Badge variant="secondary" className="ml-2 text-xs">
                                Internal
                              </Badge>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <div className="ml-10 prose prose-sm max-w-none">
                        <MentionTextarea
                          value={comment.content}
                          renderMentions={true}
                          ticketId={params.id}
                          className="bg-transparent border-none p-0 resize-none min-h-0 shadow-none focus-visible:ring-0"
                          readOnly
                        />
                      </div>
                    </div>
                  ))}

                  {/* Add Comment Form */}
                  <div className="border-t pt-6">
                    <form onSubmit={handleAddComment} className="space-y-4">
                      <MentionTextarea
                        placeholder="Add a comment... (type @ to mention users)"
                        value={newComment}
                        onChange={setNewComment}
                        ticketId={params.id}
                        className="min-h-[100px]"
                      />
                      
                      <div className="flex items-center justify-between">
                        {isStaff && ticket?.requesterId !== user?.id && (
                          <div className="flex items-center space-x-2">
                            <Switch
                              id="internal"
                              checked={isInternal}
                              onCheckedChange={setIsInternal}
                            />
                            <Label htmlFor="internal" className="text-sm">
                              Internal note (not visible to requester)
                            </Label>
                          </div>
                        )}
                        
                        <Button type="submit" disabled={submittingComment || !newComment.trim()}>
                          {submittingComment ? (
                            'Adding...'
                          ) : (
                            <>
                              <Send className="mr-2 h-4 w-4" />
                              Add Comment
                            </>
                          )}
                        </Button>
                      </div>
                    </form>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Ticket Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Ticket Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Status</label>
                    {isStaff ? (
                      <Select
                        value={ticket.status}
                        onValueChange={(value) => handleUpdateTicket('status', value)}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NEW">New</SelectItem>
                          <SelectItem value="OPEN">Open</SelectItem>
                          <SelectItem value="PENDING">Pending</SelectItem>
                          <SelectItem value="ON_HOLD">On Hold</SelectItem>
                          <SelectItem value="SOLVED">Solved</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="mt-1">
                        <Badge className={getStatusColor(ticket.status)}>
                          {ticket.status}
                        </Badge>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium">Priority</label>
                    {isStaff ? (
                      <Select
                        value={ticket.priority}
                        onValueChange={(value) => handleUpdateTicket('priority', value)}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LOW">Low</SelectItem>
                          <SelectItem value="NORMAL">Normal</SelectItem>
                          <SelectItem value="HIGH">High</SelectItem>
                          <SelectItem value="URGENT">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="mt-1">
                        <Badge className={getPriorityColor(ticket.priority)}>
                          {ticket.priority}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {isStaff && (
                    <div>
                      <label className="text-sm font-medium">Assignee</label>
                      <Select
                        value={ticket.assigneeId || 'unassigned'}
                        onValueChange={(value) => 
                          handleUpdateTicket('assigneeId', value === 'unassigned' ? null : value)
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {users.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.firstName} {u.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium">Requester</label>
                    <div className="mt-1 flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">
                          {ticket.requester?.firstName?.[0] || '?'}{ticket.requester?.lastName?.[0] || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">
                        {ticket.requester?.firstName && ticket.requester?.lastName 
                          ? `${ticket.requester.firstName} ${ticket.requester.lastName}`
                          : 'Unknown User'
                        }
                      </span>
                    </div>
                  </div>

                  {ticket.assignee && (
                    <div>
                      <label className="text-sm font-medium">Assigned to</label>
                      <div className="mt-1 flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {ticket.assignee?.firstName?.[0] || '?'}{ticket.assignee?.lastName?.[0] || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">
                          {ticket.assignee?.firstName && ticket.assignee?.lastName 
                            ? `${ticket.assignee.firstName} ${ticket.assignee.lastName}`
                            : 'Unassigned'
                          }
                        </span>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium">Created</label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}
                    </p>
                  </div>

                  {ticket.resolvedAt && (
                    <div>
                      <label className="text-sm font-medium">Resolved</label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(ticket.resolvedAt), { addSuffix: true })}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Ticket Thread */}
              <Card>
                <CardHeader>
                  <CardTitle>Ticket Thread</CardTitle>
                  <CardDescription>
                    Link related tickets together to keep conversations organized
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <TicketThread ticket={ticket} onUpdate={fetchTicket} />
                </CardContent>
              </Card>
            </div>
          </div>
        </main>

        {/* Virtual Assistant - Available for All Users */}
        {showAssistant && (
          <VirtualAssistant
            ticket={ticket}
            isMinimized={assistantMinimized}
            onToggleMinimize={() => setAssistantMinimized(!assistantMinimized)}
            onClose={() => setShowAssistant(false)}
          />
        )}

        {/* Virtual Assistant Trigger Button - Available for All Users */}
        {!showAssistant && ticket && (
          <div className="fixed bottom-4 right-4 z-50">
            <Button
              onClick={() => setShowAssistant(true)}
              className="h-12 w-12 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700"
              title={`Get help with ticket #${ticket.ticketNumber}`}
            >
              <MessageCircle className="h-6 w-6 text-white" />
            </Button>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}