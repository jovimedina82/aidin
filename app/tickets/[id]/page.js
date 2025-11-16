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
import { EmailMessageViewer } from '../../../components/EmailMessageViewer'
import { TicketMessageViewer } from '../../../components/TicketMessageViewer'
import { Button } from '@/components/ui/button'
import MentionTextarea from '../../../components/MentionTextarea'
import RichTextEditor from '../../../components/RichTextEditor'
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
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ArrowLeft,
  Clock,
  User,
  MessageCircle,
  AlertCircle,
  CheckCircle,
  XCircle,
  Pause,
  Sparkles,
  Mail,
  Tag,
  MoreHorizontal,
  Paperclip,
  Edit2,
  Plus,
  Lock,
  UserCheck,
  UserPlus,
  UserMinus,
  RefreshCw,
  Activity
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { formatDistanceToNow, format } from 'date-fns'
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
  const [isChangeRequesterDialogOpen, setIsChangeRequesterDialogOpen] = useState(false)
  const [allUsers, setAllUsers] = useState([])
  const [requesterSearchTerm, setRequesterSearchTerm] = useState('')
  const [activityTimeline, setActivityTimeline] = useState([])
  const [selectedFiles, setSelectedFiles] = useState([])
  const [ccRecipients, setCcRecipients] = useState([])
  const [newCcEmail, setNewCcEmail] = useState('')
  const [newCcName, setNewCcName] = useState('')
  const [addingCc, setAddingCc] = useState(false)
  const [surveyRecipient, setSurveyRecipient] = useState('') // Email address of who gets the "Mark as Solved" button

  const userRoleNames = user?.roles?.map(role =>
    typeof role === 'string' ? role : (role.role?.name || role.name)
  ) || []
  const isStaff = userRoleNames.some(role => ['Admin', 'Manager', 'Staff'].includes(role))
  const isAdmin = userRoleNames.some(role => ['Admin', 'Manager'].includes(role))
  const canEdit = isStaff || ticket?.requesterId === user?.id

  // Build list of all emails involved in the conversation (for survey recipient dropdown)
  const allEmailsInvolved = ticket && ticket.requester ? [
    {
      email: ticket.requester.email,
      name: `${ticket.requester.firstName} ${ticket.requester.lastName}`,
      label: `${ticket.requester.firstName} ${ticket.requester.lastName} (Requester)`
    },
    ...ccRecipients.map(cc => ({
      email: cc.email,
      name: cc.name || cc.email,
      label: `${cc.name || cc.email}${cc.source === 'original' ? ' (CC from email)' : ' (CC added manually)'}`
    }))
  ] : []

  const handleBackNavigation = () => {
    const returnParams = searchParams.get('return')
    if (returnParams) {
      try {
        const decodedParams = decodeURIComponent(returnParams)
        const urlParams = new URLSearchParams(decodedParams)
        const returnUrl = `/tickets?${urlParams.toString()}`
        router.push(returnUrl)
      } catch (error) {
        // console.error('Failed to parse return parameters:', error)
        router.push('/tickets')
      }
    } else {
      router.push('/tickets')
    }
  }

  useEffect(() => {
    if (params.id) {
      fetchTicket()
      fetchCcRecipients()
      if (isStaff) {
        fetchUsers()
      }
    }
  }, [params.id, isStaff])

  // Auto-refresh comments every 5 seconds
  useEffect(() => {
    if (!params.id) return

    const interval = setInterval(() => {
      fetchTicket()
    }, 5000) // Poll every 5 seconds

    return () => clearInterval(interval)
  }, [params.id])

  const fetchTicket = async () => {
    try {
      const response = await makeAuthenticatedRequest(`/api/tickets/${params.id}`)
      if (response.ok) {
        const data = await response.json()
        setTicket(data)
        // Initialize survey recipient to requester's email if not already set
        if (!surveyRecipient && data.requester?.email) {
          setSurveyRecipient(data.requester.email)
        }
        // Fetch activity timeline
        fetchActivity()
      } else if (response.status === 404) {
        toast.error('Ticket not found')
        router.push('/tickets')
      } else if (response.status === 403) {
        toast.error('Access denied')
        router.push('/tickets')
      }
    } catch (error) {
      // console.error('Failed to fetch ticket:', error)
      toast.error('Failed to load ticket')
    } finally {
      setLoading(false)
    }
  }

  const fetchActivity = async () => {
    try {
      const response = await makeAuthenticatedRequest(`/api/tickets/${params.id}/activity`)
      if (response.ok) {
        const data = await response.json()
        setActivityTimeline(data.timeline || [])
      }
    } catch (error) {
      // console.error('Failed to fetch activity:', error)
    }
  }

  const fetchCcRecipients = async () => {
    try {
      const response = await makeAuthenticatedRequest(`/api/tickets/${params.id}/cc`)
      if (response.ok) {
        const data = await response.json()
        setCcRecipients(data.cc || [])
      }
    } catch (error) {
      console.error('Failed to fetch CC recipients:', error)
    }
  }

  const handleAddCc = async (e) => {
    e.preventDefault()
    if (!newCcEmail.trim()) {
      toast.error('Please enter an email address')
      return
    }

    setAddingCc(true)
    try {
      const response = await makeAuthenticatedRequest(`/api/tickets/${params.id}/cc`, {
        method: 'POST',
        body: JSON.stringify({
          email: newCcEmail.trim(),
          name: newCcName.trim() || null
        })
      })

      if (response.ok) {
        toast.success('CC recipient added')
        setNewCcEmail('')
        setNewCcName('')
        fetchCcRecipients()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to add CC recipient')
      }
    } catch (error) {
      toast.error('Failed to add CC recipient')
    } finally {
      setAddingCc(false)
    }
  }

  const handleRemoveCc = async (email) => {
    try {
      const response = await makeAuthenticatedRequest(`/api/tickets/${params.id}/cc`, {
        method: 'DELETE',
        body: JSON.stringify({ email })
      })

      if (response.ok) {
        toast.success('CC recipient removed')
        fetchCcRecipients()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to remove CC recipient')
      }
    } catch (error) {
      toast.error('Failed to remove CC recipient')
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await makeAuthenticatedRequest('/api/users')
      if (response.ok) {
        const data = await response.json()
        const staffUsers = data.filter(user => {
          const userRoles = user.roles || []
          return userRoles.some(role => {
            const roleName = typeof role === 'string' ? role : (role.role?.name || role.name)
            return ['Staff', 'Manager', 'Admin'].includes(roleName)
          })
        })
        setUsers(staffUsers)
        // Store all users for requester change dialog
        setAllUsers(data)
      }
    } catch (error) {
      // console.error('Failed to fetch users:', error)
    }
  }

  const handleChangeRequester = async (newRequesterId) => {
    if (!newRequesterId) {
      toast.error('Please select a requester')
      return
    }

    try {
      const response = await makeAuthenticatedRequest(`/api/tickets/${params.id}`, {
        method: 'PUT',
        body: JSON.stringify({ requesterId: newRequesterId })
      })

      if (response.ok) {
        const updatedTicket = await response.json()
        setTicket(updatedTicket)
        setIsChangeRequesterDialogOpen(false)
        setRequesterSearchTerm('')
        toast.success('Requester updated successfully')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to update requester')
      }
    } catch (error) {
      toast.error('Failed to update requester')
    }
  }

  const handleAddComment = async (e) => {
    e.preventDefault()

    // Check if content is empty (strip HTML tags to check for actual content)
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = newComment
    const textContent = tempDiv.textContent || tempDiv.innerText || ''

    if (!textContent.trim()) {
      toast.error('Please enter a comment')
      return
    }

    setSubmittingComment(true)
    try {
      const response = await makeAuthenticatedRequest(`/api/tickets/${params.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          content: newComment,
          isInternal: isInternal,
          isHTML: true, // Flag to indicate this is HTML content
          surveyRecipient: surveyRecipient || ticket.requester?.email // Pass selected survey recipient
        })
      })

      if (response.ok) {
        const commentData = await response.json()

        // Upload attachments if any, linked to this comment
        if (selectedFiles.length > 0) {
          try {
            const uploadPromises = selectedFiles.map(async (file) => {
              const formData = new FormData()
              formData.append('file', file)
              formData.append('ticketId', params.id)
              formData.append('commentId', commentData.id) // Link to the comment

              const uploadResponse = await makeAuthenticatedRequest('/api/attachments', {
                method: 'POST',
                body: formData
              })

              if (!uploadResponse.ok) {
                throw new Error(`Failed to upload ${file.name}`)
              }
            })

            await Promise.all(uploadPromises)
            toast.success(`Comment added with ${selectedFiles.length} attachment(s)!`)
          } catch (uploadError) {
            console.error('Attachment upload error:', uploadError)
            toast.warning('Comment added, but some attachments failed to upload')
          }
        } else {
          toast.success('Comment added successfully')
        }

        setNewComment('')
        setIsInternal(false)
        setSelectedFiles([])
        fetchTicket()
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

  const handleUpdateTicket = async (field, value) => {
    // Show confirmation dialog for status and assignee changes
    if (field === 'status' || field === 'assigneeId') {
      let confirmMessage = ''

      if (field === 'status') {
        const statusLabels = {
          'NEW': 'New',
          'OPEN': 'Open',
          'PENDING': 'Pending',
          'ON_HOLD': 'On Hold',
          'SOLVED': 'Solved'
        }
        confirmMessage = `Are you sure you want to change the status to "${statusLabels[value] || value}"?`
      } else if (field === 'assigneeId') {
        if (value === null) {
          confirmMessage = 'Are you sure you want to unassign this ticket?'
        } else {
          const assignee = users.find(u => u.id === value)
          const assigneeName = assignee ? `${assignee.firstName} ${assignee.lastName}` : 'this person'
          confirmMessage = `Are you sure you want to assign this ticket to ${assigneeName}?`
        }
      }

      if (!confirm(confirmMessage)) {
        return // User cancelled, don't proceed
      }
    }

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
      // console.error('Failed to update ticket status:', error)
      toast.error('Failed to update ticket status')
    }
  }

  const assignToSelf = async () => {
    try {
      const isAdminTakeover = ticket.assignee && ticket.assigneeId !== user.id && isAdmin
      const previousAssignee = ticket.assignee

      const response = await makeAuthenticatedRequest(`/api/tickets/${params.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          assigneeId: user.id,
          status: 'OPEN'
        })
      })

      if (response.ok) {
        const updatedTicket = await response.json()
        setTicket(updatedTicket)

        if (isAdminTakeover) {
          toast.success('Ticket reassigned to you (Admin takeover)! User will be notified.')

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

          await makeAuthenticatedRequest(`/api/tickets/${params.id}/comments`, {
            method: 'POST',
            body: JSON.stringify({
              content: `🔧 **Ticket taken by ${user.firstName} ${user.lastName}**\n\nI'm now working on this issue and will provide updates as I troubleshoot the problem.`,
              isPublic: true,
              isInternal: false
            })
          })
        }

        fetchTicket()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to assign ticket')
      }
    } catch (error) {
      // console.error('Failed to assign ticket:', error)
      toast.error('Failed to assign ticket to yourself')
    }
  }

  const escalateToAdmin = async () => {
    try {
      const usersResponse = await makeAuthenticatedRequest('/api/users')
      if (!usersResponse.ok) {
        toast.error('Failed to load users for escalation')
        return
      }

      const usersData = await usersResponse.json()
      const users = Array.isArray(usersData) ? usersData : usersData.users || []

      const adminUser = users.find(u => {
        const roles = u.roles || []
        return roles.some(role => {
          const roleName = role.name || role.role?.name
          return roleName === 'Admin'
        })
      })

      if (!adminUser) {
        toast.error('No admin users found for escalation')
        return
      }

      const response = await makeAuthenticatedRequest(`/api/tickets/${params.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          assigneeId: adminUser.id,
          status: 'OPEN',
          priority: 'HIGH'
        })
      })

      if (response.ok) {
        const updatedTicket = await response.json()
        setTicket(updatedTicket)
        toast.success(`Ticket escalated to admin: ${adminUser.firstName} ${adminUser.lastName}`)

        await makeAuthenticatedRequest(`/api/tickets/${params.id}/comments`, {
          method: 'POST',
          body: JSON.stringify({
            content: `⬆️ **Ticket Escalated to Admin**\n\nThis ticket has been escalated to ${adminUser.firstName} ${adminUser.lastName} (System Admin) for advanced troubleshooting.\n\n**Reason**: Issue requires higher-level technical expertise or system administrative access.`,
            isPublic: true,
            isInternal: false
          })
        })

        fetchTicket()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to escalate ticket')
      }
    } catch (error) {
      // console.error('Failed to escalate ticket:', error)
      toast.error('Failed to escalate ticket to admin')
    }
  }

  const markAsSolved = async () => {
    try {
      const response = await makeAuthenticatedRequest(`/api/tickets/${params.id}/mark-solved`, {
        method: 'POST'
      })

      if (response.ok) {
        toast.success('✅ Ticket marked as solved! Thank you for confirming.')
        fetchTicket()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to mark ticket as solved')
      }
    } catch (error) {
      // console.error('Failed to mark ticket as solved:', error)
      toast.error('Failed to mark ticket as solved')
    }
  }

  const markAsNotATicket = async () => {
    // Extract email domain from requester
    const requesterEmail = ticket.requester?.email || ''
    const emailDomain = requesterEmail.includes('@') ? requesterEmail.split('@')[1] : ''

    // console.log('🚫 Not a ticket clicked:', { requesterEmail, emailDomain })

    // Ask if user wants to block this sender
    let blockDomain = false
    if (emailDomain) {
      blockDomain = confirm(
        `⛔ BLOCK SENDER: "${emailDomain}"?\n\n` +
        `Click OK to permanently block this sender:\n` +
        `✓ Future emails from ${emailDomain} will be AUTOMATICALLY REJECTED\n` +
        `✓ No tickets will be created for this sender\n` +
        `✓ This ticket will be deleted\n` +
        `✓ You can unblock them later in Admin > Blocked Senders\n\n` +
        `Click CANCEL to just delete this ticket without blocking the sender.`
      )
      // console.log('Block sender decision:', blockDomain)
    }

    const reason = prompt(
      'Why is this not a ticket? (Optional - helps AI learn)',
      'This email should not have been classified as a helpdesk ticket'
    )

    if (reason === null) {
      // console.log('User cancelled - no reason provided')
      return
    }

    const confirmed = confirm(
      `⚠️ FINAL CONFIRMATION\n\n` +
      `Delete ticket #${ticket.ticketNumber}?\n\n` +
      `This will:\n` +
      `• Delete this ticket permanently\n` +
      `• Forward original email to help@surterreproperties.com\n` +
      `• Help train AI to avoid similar classifications\n` +
      (blockDomain ? `• ⛔ BLOCK ALL FUTURE EMAILS from ${emailDomain}\n` : '') +
      `\n❌ This action CANNOT be undone!`
    )

    if (!confirmed) {
      // console.log('User cancelled final confirmation')
      return
    }

    try {
      // console.log('Sending mark-not-ticket request:', {
      //   reason,
      //   blockDomain,
      //   emailDomain: blockDomain ? emailDomain : null
      // })

      const response = await makeAuthenticatedRequest(`/api/tickets/${params.id}/mark-not-ticket`, {
        method: 'POST',
        body: JSON.stringify({
          reason,
          blockDomain: blockDomain,
          emailDomain: blockDomain ? emailDomain : null
        })
      })

      if (response.ok) {
        if (blockDomain) {
          toast.success(`✅ Ticket removed and sender "${emailDomain}" has been blocked!`)
          // console.log('✅ Sender blocked successfully:', emailDomain)
        } else {
          toast.success('✅ Ticket marked as "not a ticket" and removed')
          // console.log('✅ Ticket removed (sender not blocked)')
        }
        router.push('/tickets')
      } else {
        const error = await response.json()
        // console.error('API error:', error)
        toast.error(error.error || 'Failed to mark as not a ticket')
      }
    } catch (error) {
      // console.error('Failed to mark as not a ticket:', error)
      toast.error('Failed to mark as not a ticket')
    }
  }

  const getStatusBadgeStyle = (status) => {
    const styles = {
      NEW: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      OPEN: 'bg-red-50 text-red-700 border-red-200',
      PENDING: 'bg-blue-50 text-blue-700 border-blue-200',
      ON_HOLD: 'bg-orange-50 text-orange-700 border-orange-200',
      SOLVED: 'bg-green-50 text-green-700 border-green-200'
    }
    return styles[status] || styles.NEW
  }

  const getPriorityBadgeStyle = (priority) => {
    const styles = {
      LOW: 'bg-gray-50 text-gray-600 border-gray-200',
      NORMAL: 'bg-blue-50 text-blue-600 border-blue-200',
      HIGH: 'bg-orange-50 text-orange-600 border-orange-200',
      URGENT: 'bg-red-50 text-red-600 border-red-200'
    }
    return styles[priority] || styles.NORMAL
  }

  // Strip quoted email content from HTML
  const stripQuotedContent = (html) => {
    if (!html) return html

    // Create a temporary div to parse HTML
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    // Remove blockquote elements (quoted content)
    const blockquotes = doc.querySelectorAll('blockquote')
    blockquotes.forEach(bq => bq.remove())

    // Remove elements with common quote indicators
    const quoteIndicators = [
      '[id*="lineBreakAtBeginningOfMessage"]',
      '[class*="gmail_quote"]',
      '[class*="quoted"]',
      '[class*="Apple-interchange-newline"]'
    ]
    quoteIndicators.forEach(selector => {
      const elements = doc.querySelectorAll(selector)
      elements.forEach(el => el.remove())
    })

    // Get the text content to find quoted patterns
    let textContent = doc.body.innerHTML

    // AGGRESSIVE: Look for ticket footer and cut everything after it
    // This is typically where quoted content starts in our email notifications
    const ticketFooterMatch = textContent.match(/Ticket\s+(?:#?[A-Z]+)?[0-9]+\s*[•●]\s*AidIN\s+Helpdesk/i)
    if (ticketFooterMatch && ticketFooterMatch.index) {
      // Cut everything from the ticket footer onwards (this is all quoted content)
      textContent = textContent.substring(0, ticketFooterMatch.index)
    }

    // Alternative: Look for "test user replied:" or similar patterns and cut from there
    const repliedPatternMatch = textContent.match(/(test\s+user|.+?)\s+replied:/i)
    if (repliedPatternMatch && repliedPatternMatch.index) {
      textContent = textContent.substring(0, repliedPatternMatch.index)
    }

    // Look for "Hello [name]," pattern which usually starts quoted content
    const helloPatternMatch = textContent.match(/Hello\s+[^,]+,/i)
    if (helloPatternMatch && helloPatternMatch.index > 0) {
      // Only cut if it's not at the very beginning (first 20 chars)
      // This prevents removing legitimate greetings in new messages
      if (helloPatternMatch.index > 20) {
        textContent = textContent.substring(0, helloPatternMatch.index)
      }
    }

    // Common email quote patterns to remove
    const quotePatterns = [
      // "On [date], [name] wrote:" pattern
      /On .+? wrote:/gi,
      // Email headers (From:, To:, Sent:, Subject:)
      /From:.+?(?=<br|<p|$)/gis,
      /To:.+?(?=<br|<p|$)/gis,
      /Sent:.+?(?=<br|<p|$)/gis,
      /Subject:.+?(?=<br|<p|$)/gis,
      // "Issue Resolved?" and similar prompts
      /Issue Resolved\?/gi,
      /✓ Yes, Mark as Solved/gi,
      /No login required/gi,
      /View Full Ticket →/gi,
      /View Full Ticket/gi,
      // Horizontal separators
      /_{3,}/g,
      /-{3,}/g,
      /={3,}/g,
      // Lines starting with ">" (email quote marker)
      /^&gt;.+$/gm,
      />>.+$/gm
    ]

    // Apply all patterns
    quotePatterns.forEach(pattern => {
      textContent = textContent.replace(pattern, '')
    })

    // Try to find where the actual new content ends and quoted content begins
    // Look for common separators or patterns that indicate quoted content
    const separatorPatterns = [
      /<hr[^>]*>/gi,
      /<div[^>]*class="[^"]*quote[^"]*"[^>]*>/gi,
      /<div[^>]*style="[^"]*border-left[^"]*"[^>]*>/gi
    ]

    separatorPatterns.forEach(pattern => {
      const match = textContent.match(pattern)
      if (match && match.index) {
        // Keep only content before the separator
        textContent = textContent.substring(0, match.index)
      }
    })

    // Clean up multiple consecutive <br> tags
    textContent = textContent.replace(/(<br\s*\/?>\s*){3,}/gi, '<br><br>')

    // Clean up empty paragraphs
    textContent = textContent.replace(/<p>\s*<\/p>/gi, '')

    // Return cleaned HTML
    return textContent.trim()
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          <main className="pt-20">
            <div className="animate-pulse p-8">
              <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
          </main>
        </div>
      </ProtectedRoute>
    )
  }

  if (!ticket) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          <main className="pt-20 p-8">
            <div className="text-center py-12">
              <h1 className="text-2xl font-semibold mb-6">Ticket not found</h1>
              <Button onClick={handleBackNavigation} variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Tickets
              </Button>
            </div>
          </main>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Navbar />

        {/* Global styles for rich text content display */}
        <style jsx global>{`
          .rich-text-content h1 {
            font-size: 2em;
            font-weight: bold;
            margin-top: 0.67em;
            margin-bottom: 0.67em;
          }

          .rich-text-content h2 {
            font-size: 1.5em;
            font-weight: bold;
            margin-top: 0.83em;
            margin-bottom: 0.83em;
          }

          .rich-text-content h3 {
            font-size: 1.17em;
            font-weight: bold;
            margin-top: 1em;
            margin-bottom: 1em;
          }

          .rich-text-content ul,
          .rich-text-content ol {
            padding-left: 1.5em;
            margin: 0.5em 0;
          }

          .rich-text-content ul {
            list-style-type: disc;
          }

          .rich-text-content ol {
            list-style-type: decimal;
          }

          .rich-text-content li {
            margin: 0.25em 0;
          }

          .rich-text-content code {
            background-color: #f3f4f6;
            padding: 0.2em 0.4em;
            border-radius: 3px;
            font-family: monospace;
            font-size: 0.9em;
          }

          .rich-text-content pre {
            background-color: #1f2937;
            color: #f3f4f6;
            padding: 1em;
            border-radius: 6px;
            overflow-x: auto;
            margin: 0.5em 0;
          }

          .rich-text-content pre code {
            background: none;
            padding: 0;
            color: inherit;
          }

          .rich-text-content a {
            color: #2563eb;
            text-decoration: underline;
          }

          .rich-text-content a:hover {
            color: #1e40af;
          }

          .rich-text-content strong {
            font-weight: bold;
          }

          .rich-text-content em {
            font-style: italic;
          }

          .rich-text-content u {
            text-decoration: underline;
          }

          .rich-text-content p {
            margin: 0.5em 0;
          }
        `}</style>

        {/* Zendesk-style Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-[1600px] mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              {/* Back button and ticket number */}
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleBackNavigation}
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="flex items-center space-x-3">
                  <h1 className="text-xl font-semibold text-gray-900">
                    #{ticket.ticketNumber}
                  </h1>
                  <Badge variant="outline" className={`${getStatusBadgeStyle(ticket.status)} text-xs font-medium`}>
                    {ticket.status.replace('_', ' ')}
                  </Badge>
                  <Badge variant="outline" className={`${getPriorityBadgeStyle(ticket.priority)} text-xs font-medium`}>
                    {ticket.priority}
                  </Badge>
                </div>
              </div>

              {/* Action buttons */}
              {isStaff && (
                <div className="flex items-center space-x-2">
                  {!ticket.assignee && !(isStaff && !isAdmin && ticket.requesterId === user?.id) && (
                    <Button
                      onClick={assignToSelf}
                      size="sm"
                      className="bg-[#3d6964] hover:bg-[#2d5954] text-white"
                    >
                      Take it
                    </Button>
                  )}

                  {isAdmin && ticket.assignee && ticket.assigneeId !== user?.id && (
                    <Button
                      onClick={assignToSelf}
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      Take Over
                    </Button>
                  )}

                  {!isAdmin && ticket.assignee && ticket.assigneeId === user?.id && (
                    <Button
                      onClick={escalateToAdmin}
                      size="sm"
                      variant="outline"
                      className="border-orange-300 text-orange-600 hover:bg-orange-50"
                    >
                      Escalate
                    </Button>
                  )}

                  {/* Not a Ticket Button - Prominent */}
                  <Button
                    onClick={markAsNotATicket}
                    size="sm"
                    variant="outline"
                    className="border-red-300 text-red-600 hover:bg-red-50"
                  >
                    <XCircle className="h-4 w-4 mr-1.5" />
                    Not a ticket?
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => updateTicketStatus('OPEN')}>
                        Mark as Open
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateTicketStatus('PENDING')}>
                        Mark as Pending
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateTicketStatus('ON_HOLD')}>
                        Put On Hold
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateTicketStatus('SOLVED')}>
                        Mark as Solved
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Zendesk-style Three Column Layout */}
        <div className="max-w-[1600px] mx-auto px-6 py-6">
          <div className="grid grid-cols-12 gap-6">

            {/* Left Sidebar - Ticket Properties (Zendesk style) - STICKY */}
            <div className="col-span-3">
              <div className="sticky top-24 bg-white rounded-lg border border-gray-200 p-5 space-y-5 max-h-[calc(100vh-7rem)] overflow-y-auto">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Ticket Properties</h3>

                {/* Requester */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-gray-600">REQUESTER</label>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => setIsChangeRequesterDialogOpen(true)}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-xs bg-gray-200 text-gray-600">
                        {ticket.requester?.firstName?.[0] || '?'}{ticket.requester?.lastName?.[0] || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {ticket.requester?.firstName && ticket.requester?.lastName
                          ? `${ticket.requester.firstName} ${ticket.requester.lastName}`
                          : 'Unknown User'
                        }
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {ticket.requester?.email || 'No email'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Assignee */}
                {isStaff && (
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-2">ASSIGNEE</label>
                    <Select
                      value={ticket.assigneeId || 'unassigned'}
                      onValueChange={(value) =>
                        handleUpdateTicket('assigneeId', value === 'unassigned' ? null : value)
                      }
                    >
                      <SelectTrigger className="h-9 text-sm border-gray-300">
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

                {/* Status */}
                {isStaff && (
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-2">STATUS</label>
                    <Select
                      value={ticket.status}
                      onValueChange={(value) => handleUpdateTicket('status', value)}
                    >
                      <SelectTrigger className="h-9 text-sm border-gray-300">
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
                  </div>
                )}

                {/* Priority */}
                {isStaff && (
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-2">PRIORITY</label>
                    <Select
                      value={ticket.priority}
                      onValueChange={(value) => handleUpdateTicket('priority', value)}
                    >
                      <SelectTrigger className="h-9 text-sm border-gray-300">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">Low</SelectItem>
                        <SelectItem value="NORMAL">Normal</SelectItem>
                        <SelectItem value="HIGH">High</SelectItem>
                        <SelectItem value="URGENT">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Category */}
                {ticket.category && (
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-2">TYPE</label>
                    <div className="flex items-center space-x-2 text-sm text-gray-900">
                      <Tag className="h-3.5 w-3.5 text-gray-400" />
                      <span>{ticket.category}</span>
                    </div>
                  </div>
                )}

                {/* Created */}
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-2">CREATED</label>
                  <p className="text-sm text-gray-900">
                    {format(new Date(ticket.createdAt), 'MMM d, yyyy h:mm a')}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}
                  </p>
                </div>

                {/* Updated */}
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-2">UPDATED</label>
                  <p className="text-sm text-gray-900">
                    {format(new Date(ticket.updatedAt), 'MMM d, yyyy h:mm a')}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatDistanceToNow(new Date(ticket.updatedAt), { addSuffix: true })}
                  </p>
                </div>

                {/* Linked Tickets */}
                <div className="mt-5 pt-5 border-t border-gray-200">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Linked Tickets</h3>
                  <TicketThread ticket={ticket} onUpdate={fetchTicket} />
                </div>
              </div>
            </div>

            {/* Center - Main Content Area (Messages) */}
            <div className="col-span-6 space-y-6">
              {/* Original Requester Message - Blue Background */}
              <div className="bg-blue-100 rounded-lg p-6 shadow-sm">
                <div className="mb-3">
                  <p className="text-sm font-semibold text-gray-900">
                    {ticket.requester?.firstName && ticket.requester?.lastName
                      ? `${ticket.requester.firstName} ${ticket.requester.lastName}`
                      : 'Unknown User'
                    } (Requester)
                  </p>
                  <p className="text-xs text-gray-700">
                    {format(new Date(ticket.createdAt), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>

                <div className="text-sm text-gray-900">
                  {ticket.inboundMessages && ticket.inboundMessages.length > 0 ? (
                    <EmailMessageViewer
                      message={ticket.inboundMessages[0]}
                      ticketId={ticket.id}
                    />
                  ) : (
                    <div className="prose prose-sm max-w-none">
                      {ticket.ticketMessages && ticket.ticketMessages.length > 0 && ticket.ticketMessages[0].html ? (
                        <TicketMessageViewer
                          html={ticket.ticketMessages[0].html}
                          className="text-sm text-gray-900 leading-relaxed"
                        />
                      ) : (
                        <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">{ticket.description}</p>
                      )}

                      {ticket.attachments && Array.isArray(ticket.attachments) && ticket.attachments.length > 0 && (() => {
                        // Filter only image attachments that belong to the original ticket (no commentId)
                        const imageAttachments = ticket.attachments.filter(attachment => {
                          const mimeType = typeof attachment === 'object' ? attachment.mimeType : ''
                          const belongsToOriginal = !attachment.commentId // Only show attachments without commentId
                          return mimeType && mimeType.startsWith('image/') && belongsToOriginal
                        })

                        if (imageAttachments.length === 0) return null

                        return (
                          <div className="mt-4">
                            <ImageGallery images={imageAttachments.map((attachment) => {
                              // Use the download API route to serve images
                              const url = `/api/attachments/${attachment.id}/download`
                              return {
                                url,
                                thumb: url,
                                alt: attachment.fileName || 'attachment'
                              }
                            })} />
                          </div>
                        )
                      })()}
                    </div>
                  )}
                </div>
              </div>

              {/* AI Draft Response */}
              {ticket.aiDraftResponse ? (
                <AIDraftReview ticket={ticket} onUpdate={fetchTicket} />
              ) : isStaff && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-5">
                  <div className="flex items-start space-x-3">
                    <Sparkles className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-gray-900 mb-1">AI-Powered Draft Response</h4>
                      <p className="text-xs text-gray-600 mb-3">
                        Let AI analyze this ticket and generate a professional draft response to help you respond faster.
                      </p>
                      <Button
                        onClick={async () => {
                          try {
                            const response = await makeAuthenticatedRequest(`/api/tickets/${ticket.id}/generate-draft`, {
                              method: 'POST'
                            })
                            if (response.ok) {
                              toast.success('AI draft generated successfully')
                              fetchTicket()
                            } else {
                              const error = await response.json()
                              toast.error(error.error || 'Failed to generate draft')
                            }
                          } catch (error) {
                            toast.error('Failed to generate draft')
                          }
                        }}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                        Generate AI Draft
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Conversation Thread - Color Coded by Role */}
              {(() => {
                // Merge comments and ticketMessages into a single sorted array
                const allMessages = []

                // Add ticket comments
                if (ticket.comments) {
                  ticket.comments.forEach(comment => {
                    allMessages.push({
                      id: comment.id,
                      type: 'comment',
                      createdAt: comment.createdAt,
                      isInternal: !comment.isPublic, // Convert isPublic to isInternal
                      isPublic: comment.isPublic,
                      user: comment.user,
                      content: comment.content,
                      attachments: comment.attachments || [] // Include attachments
                    })
                  })
                }

                // Add ticket messages (email replies)
                if (ticket.ticketMessages) {
                  ticket.ticketMessages.forEach(msg => {
                    // Skip the first message if it's the original email (shown above)
                    const isFirstMessage = ticket.ticketMessages.indexOf(msg) === 0 && msg.kind === 'email'
                    if (!isFirstMessage) {
                      allMessages.push({
                        id: msg.id,
                        type: 'email',
                        createdAt: msg.createdAt,
                        authorEmail: msg.authorEmail,
                        authorName: msg.authorName,
                        html: msg.html,
                        text: msg.text,
                        subject: msg.subject
                      })
                    }
                  })
                }

                // Sort by created date
                allMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

                return allMessages.length > 0 && (
                  <div className="space-y-4">
                    {allMessages.map((message) => {
                      // Determine if this is from the requester
                      const isRequester = message.type === 'comment'
                        ? message.user.id === ticket.requesterId
                        : message.authorEmail === ticket.requester?.email

                      const bgColor = message.isInternal
                        ? 'bg-yellow-50'
                        : isRequester
                          ? 'bg-blue-100'  // Blue for requester
                          : 'bg-green-100'  // Green for staff/managers/admins

                      return (
                        <div key={message.id} className={`${bgColor} rounded-lg p-6 shadow-sm`}>
                          <div className="mb-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="flex items-center space-x-2">
                                  <p className="text-sm font-semibold text-gray-900">
                                    {message.type === 'comment'
                                      ? `${message.user.firstName} ${message.user.lastName}`
                                      : message.authorName
                                    }
                                    {isRequester ? ' (Requester)' : ' (Staff)'}
                                  </p>
                                  {message.isInternal && (
                                    <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-800 border-yellow-300">
                                      Internal Note
                                    </Badge>
                                  )}
                                  {message.type === 'email' && (
                                    <Badge variant="outline" className="text-xs bg-blue-100 text-blue-800 border-blue-300">
                                      Email Reply
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-gray-700">
                                  {format(new Date(message.createdAt), 'MMM d, yyyy h:mm a')}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="prose prose-sm max-w-none text-sm text-gray-900 leading-relaxed">
                            {message.type === 'comment' ? (
                              // Check if content contains HTML tags
                              message.content && (message.content.includes('<p>') || message.content.includes('<h1>') || message.content.includes('<strong>') || message.content.includes('<em>') || message.content.includes('<ul>')) ? (
                                <div dangerouslySetInnerHTML={{ __html: message.content }} className="rich-text-content" />
                              ) : (
                                <MentionTextarea
                                  value={message.content}
                                  renderMentions={true}
                                  ticketId={params.id}
                                  className="bg-transparent border-none p-0 resize-none min-h-0 shadow-none focus-visible:ring-0 text-gray-900"
                                  readOnly
                                />
                              )
                            ) : message.html ? (
                              <TicketMessageViewer html={stripQuotedContent(message.html)} />
                            ) : (
                              <p className="whitespace-pre-wrap">{message.text}</p>
                            )}
                          </div>

                          {/* Display attachments for this comment */}
                          {message.type === 'comment' && message.attachments && message.attachments.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-300">
                              <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">
                                Attachments ({message.attachments.length})
                              </h4>
                              <div className="space-y-2">
                                {message.attachments.map((attachment) => (
                                  <a
                                    key={attachment.id}
                                    href={`/api/attachments/${attachment.id}/download`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center space-x-2 p-2 bg-white bg-opacity-50 rounded border border-gray-300 hover:bg-opacity-75 transition-colors"
                                  >
                                    <Paperclip className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-gray-900 truncate">
                                        {attachment.fileName}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {attachment.fileSize ? formatFileSize(attachment.fileSize) : ''}
                                      </p>
                                    </div>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Show "Mark as Solved" button for requesters after staff responses */}
                          {!isRequester && !message.isInternal && ticket.requesterId === user?.id && ticket.status !== 'SOLVED' && (
                            <div className="mt-4 pt-4 border-t border-gray-300">
                              <div className="flex items-center justify-between">
                                <p className="text-sm text-gray-700">Did this resolve your issue?</p>
                                <Button
                                  onClick={markAsSolved}
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                >
                                  <CheckCircle className="h-4 w-4 mr-1.5" />
                                  Mark as Solved
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })()}

              {/* Add Comment - Zendesk Style */}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <form onSubmit={handleAddComment}>
                  {/* Zendesk-style tabs */}
                  {isStaff && ticket?.requesterId !== user?.id ? (
                    <div className="flex border-b border-gray-200">
                      <button
                        type="button"
                        onClick={() => setIsInternal(false)}
                        className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${
                          !isInternal
                            ? 'bg-white text-gray-900 border-b-2 border-[#3d6964]'
                            : 'bg-gray-50 text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        <ArrowLeft className="h-4 w-4 rotate-180" />
                        <span>Public reply</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsInternal(true)}
                        className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${
                          isInternal
                            ? 'bg-yellow-50 text-gray-900 border-b-2 border-yellow-500'
                            : 'bg-gray-50 text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <span>Internal note</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex border-b border-gray-200">
                      <div className="flex items-center space-x-2 px-4 py-3 text-sm font-medium bg-white text-gray-900 border-b-2 border-[#3d6964]">
                        <ArrowLeft className="h-4 w-4 rotate-180" />
                        <span>Public reply</span>
                      </div>
                    </div>
                  )}

                  {/* Comment textarea with rich text editor */}
                  <div className="p-6 pb-4">
                    <RichTextEditor
                      content={newComment}
                      onChange={setNewComment}
                      placeholder={isInternal ? "Add an internal note with formatted text..." : "Type your public reply with formatted text..."}
                      className="min-h-[150px]"
                    />
                  </div>

                  {/* File Attachments */}
                  <div className="px-6 pb-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <input
                        type="file"
                        id="comment-file-input"
                        className="hidden"
                        multiple
                        onChange={handleFileSelect}
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                      />
                      <label htmlFor="comment-file-input" className="cursor-pointer">
                        <div className="flex items-center space-x-1 text-sm text-gray-600 hover:text-gray-900 transition-colors">
                          <Paperclip className="w-4 h-4" />
                          <span>Attach files</span>
                        </div>
                      </label>
                      {selectedFiles.length > 0 && (
                        <span className="text-xs text-gray-500">
                          ({selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected)
                        </span>
                      )}
                    </div>

                    {/* Selected Files List */}
                    {selectedFiles.length > 0 && (
                      <div className="space-y-2">
                        {selectedFiles.map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200"
                          >
                            <div className="flex items-center space-x-2 flex-1 min-w-0">
                              <Paperclip className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {file.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {formatFileSize(file.size)}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFile(index)}
                              className="flex-shrink-0 text-red-500 hover:text-red-700 transition-colors p-1"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Survey Recipient Selector - Only for staff and public replies */}
                  {isStaff && !isInternal && allEmailsInvolved.length > 0 && (
                    <div className="px-6 pb-4 border-t border-gray-200 pt-4">
                      <div className="flex items-center gap-3">
                        <label className="text-xs font-medium text-gray-700 whitespace-nowrap">
                          Send "Mark as Solved" button to:
                        </label>
                        <Select
                          value={surveyRecipient}
                          onValueChange={(value) => setSurveyRecipient(value)}
                        >
                          <SelectTrigger className="h-8 text-sm border-gray-300 flex-1">
                            <SelectValue placeholder="Select recipient..." />
                          </SelectTrigger>
                          <SelectContent>
                            {allEmailsInvolved.map((recipient) => (
                              <SelectItem key={recipient.email} value={recipient.email}>
                                {recipient.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Only the selected person will receive the one-click "Mark as Solved" button in the email notification.
                      </p>
                    </div>
                  )}

                  {/* Submit button */}
                  <div className="px-6 pb-6 flex items-center justify-between">
                    <div className="text-xs text-gray-500">
                      {isInternal ? (
                        <span className="flex items-center space-x-1">
                          <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full"></span>
                          <span>This note will only be visible to staff members</span>
                        </span>
                      ) : (
                        <span>This reply will be sent to the requester</span>
                      )}
                    </div>
                    <Button
                      type="submit"
                      disabled={submittingComment || (() => {
                        const tempDiv = document.createElement('div')
                        tempDiv.innerHTML = newComment
                        const textContent = tempDiv.textContent || tempDiv.innerText || ''
                        return !textContent.trim()
                      })()}
                      className="bg-[#3d6964] hover:bg-[#2d5954] text-white"
                    >
                      {submittingComment ? 'Submitting...' : 'Submit'}
                    </Button>
                  </div>
                </form>
              </div>
            </div>

            {/* Right Sidebar - User Info & History - STICKY */}
            <div className="col-span-3">
              <div className="sticky top-24 space-y-4 max-h-[calc(100vh-7rem)] overflow-y-auto">
              {/* Requester Details */}
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Requester Details</h3>
                <div className="flex items-start space-x-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="text-base bg-[#3d6964] text-white">
                      {ticket.requester?.firstName?.[0] || '?'}{ticket.requester?.lastName?.[0] || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-gray-900 mb-0.5">
                      {ticket.requester?.firstName && ticket.requester?.lastName
                        ? `${ticket.requester.firstName} ${ticket.requester.lastName}`
                        : 'Unknown User'
                      }
                    </h4>
                    <p className="text-xs text-gray-600 break-all">
                      {ticket.requester?.email || 'No email'}
                    </p>
                    {ticket.requester?.roles && ticket.requester.roles.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {ticket.requester.roles.map((role, idx) => {
                          const roleName = typeof role === 'string' ? role : (role.role?.name || role.name)
                          return (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {roleName}
                            </Badge>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Assignee Details */}
              {ticket.assignee && (
                <div className="bg-white rounded-lg border border-gray-200 p-5">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Assignee Details</h3>
                  <div className="flex items-start space-x-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="text-base bg-[#3d6964] text-white">
                        {ticket.assignee?.firstName?.[0] || '?'}{ticket.assignee?.lastName?.[0] || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-gray-900 mb-0.5">
                        {ticket.assignee?.firstName && ticket.assignee?.lastName
                          ? `${ticket.assignee.firstName} ${ticket.assignee.lastName}`
                          : 'Unassigned'
                        }
                      </h4>
                      <p className="text-xs text-gray-600 break-all">
                        {ticket.assignee?.email || ''}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Attachments */}
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Attachments</h3>
                <AttachmentUpload
                  ticketId={params.id}
                  existingAttachments={ticket.attachments || []}
                  onUploadComplete={() => fetchTicket()}
                  readOnly={!canEdit}
                />
              </div>

              {/* CC Recipients */}
              {isStaff && (
                <div className="bg-white rounded-lg border border-gray-200 p-5">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                    CC Recipients ({ccRecipients.length})
                  </h3>

                  {/* Add CC Form */}
                  <form onSubmit={handleAddCc} className="mb-4 space-y-2">
                    <Input
                      type="email"
                      placeholder="Email address"
                      value={newCcEmail}
                      onChange={(e) => setNewCcEmail(e.target.value)}
                      className="text-sm"
                    />
                    <Input
                      type="text"
                      placeholder="Name (optional)"
                      value={newCcName}
                      onChange={(e) => setNewCcName(e.target.value)}
                      className="text-sm"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      disabled={addingCc || !newCcEmail.trim()}
                      className="w-full bg-[#3d6964] hover:bg-[#2d5954]"
                    >
                      {addingCc ? 'Adding...' : 'Add CC'}
                    </Button>
                  </form>

                  {/* CC Recipients List */}
                  <div className="space-y-2">
                    {ccRecipients.length === 0 ? (
                      <p className="text-xs text-gray-500 text-center py-2">No CC recipients</p>
                    ) : (
                      ccRecipients.map((cc) => (
                        <div
                          key={cc.id}
                          className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200"
                        >
                          <div className="flex-1 min-w-0">
                            {cc.name && (
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {cc.name}
                              </p>
                            )}
                            <p className="text-xs text-gray-600 truncate">
                              {cc.email}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {cc.source === 'original' ? 'From email' : 'Added manually'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveCc(cc.email)}
                            className="flex-shrink-0 text-red-500 hover:text-red-700 transition-colors p-1 ml-2"
                            title="Remove CC"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Activity Timeline */}
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Activity</h3>
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gray-200"></div>

                  {/* Timeline events */}
                  <div className="space-y-4">
                    {activityTimeline.length > 0 ? (
                      activityTimeline.map((event, index) => {
                        // Map icon names to components
                        const IconComponent = {
                          plus: Plus,
                          message: MessageCircle,
                          lock: Lock,
                          paperclip: Paperclip,
                          'user-check': UserCheck,
                          'user-plus': UserPlus,
                          'user-minus': UserMinus,
                          'refresh-cw': RefreshCw,
                          user: User,
                          'check-circle': CheckCircle,
                          activity: Activity
                        }[event.icon] || Activity

                        return (
                          <div key={index} className="relative pl-6 pb-4 last:pb-0">
                            {/* Icon circle */}
                            <div className="absolute left-0 top-0 flex items-center justify-center w-[15px] h-[15px] bg-white border-2 border-gray-300 rounded-full">
                              <IconComponent className="h-2 w-2 text-gray-600" strokeWidth={3} />
                            </div>

                            {/* Event content */}
                            <div className="text-xs">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <p className="font-medium text-gray-900 leading-tight">{event.title}</p>
                                  <p className="text-gray-600 mt-0.5 leading-tight">{event.description}</p>
                                  <p className="text-gray-400 mt-1">
                                    {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="relative pl-6">
                        <div className="absolute left-0 top-0 flex items-center justify-center w-[15px] h-[15px] bg-white border-2 border-gray-300 rounded-full">
                          <Activity className="h-2 w-2 text-gray-600" strokeWidth={3} />
                        </div>
                        <p className="text-xs text-gray-500">Loading activity...</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              </div>
            </div>
          </div>
        </div>

        {/* Virtual Assistant */}
        {showAssistant && (
          <VirtualAssistant
            ticket={ticket}
            isMinimized={assistantMinimized}
            onToggleMinimize={() => setAssistantMinimized(!assistantMinimized)}
            onClose={() => setShowAssistant(false)}
          />
        )}

        {!showAssistant && ticket && (
          <div className="fixed bottom-6 right-6 z-50">
            <Button
              onClick={() => setShowAssistant(true)}
              className="h-14 w-14 rounded-full shadow-lg bg-[#3d6964] hover:bg-[#2d5954]"
              title={`Get AI help with ticket #${ticket.ticketNumber}`}
            >
              <MessageCircle className="h-6 w-6 text-white" />
            </Button>
          </div>
        )}

        {/* Change Requester Dialog */}
        <Dialog open={isChangeRequesterDialogOpen} onOpenChange={setIsChangeRequesterDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Change Ticket Requester</DialogTitle>
              <DialogDescription>
                Select a different user to be the requester for this ticket.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Search Users</label>
                <Input
                  placeholder="Search by name or email..."
                  value={requesterSearchTerm}
                  onChange={(e) => setRequesterSearchTerm(e.target.value)}
                />
              </div>
              <div className="max-h-64 overflow-y-auto border rounded-md">
                {allUsers
                  .filter(u =>
                    u.id !== ticket?.requesterId &&
                    (
                      `${u.firstName} ${u.lastName}`.toLowerCase().includes(requesterSearchTerm.toLowerCase()) ||
                      u.email?.toLowerCase().includes(requesterSearchTerm.toLowerCase())
                    )
                  )
                  .map(u => (
                    <button
                      key={u.id}
                      onClick={() => handleChangeRequester(u.id)}
                      className="w-full p-3 hover:bg-gray-50 border-b last:border-b-0 text-left transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs bg-gray-200 text-gray-600">
                            {u.firstName?.[0] || '?'}{u.lastName?.[0] || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {u.firstName} {u.lastName}
                          </p>
                          <p className="text-xs text-gray-500">{u.email}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                {allUsers.filter(u =>
                  u.id !== ticket?.requesterId &&
                  (
                    `${u.firstName} ${u.lastName}`.toLowerCase().includes(requesterSearchTerm.toLowerCase()) ||
                    u.email?.toLowerCase().includes(requesterSearchTerm.toLowerCase())
                  )
                ).length === 0 && (
                  <div className="p-4 text-center text-sm text-gray-500">
                    No users found
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsChangeRequesterDialogOpen(false)
                  setRequesterSearchTerm('')
                }}
              >
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  )
}
