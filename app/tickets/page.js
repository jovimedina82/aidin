'use client'
import { useState, useEffect, Suspense } from 'react'
import { useAuth } from '../../components/AuthProvider'
import DashboardLayout from '../../components/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
import {
  Search,
  Filter,
  Plus,
  Ticket,
  Clock,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  UserX,
  Archive,
  MoreVertical,
  User,
  Calendar,
  MessageCircle,
  Pause,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Download,
  FileText
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

function TicketsPageContent() {
  const { makeAuthenticatedRequest, user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tickets, setTickets] = useState([])
  const [stats, setStats] = useState({
    unsolved: 0,
    unassigned: 0,
    pending: 0,
    solved: 0,
    total: 0
  })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentView, setCurrentView] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('created')
  const [sortOrder, setSortOrder] = useState('desc')
  const [personalViewOrder, setPersonalViewOrder] = useState([])
  const [companyViewOrder, setCompanyViewOrder] = useState([])
  const [draggedIndex, setDraggedIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const [draggedSection, setDraggedSection] = useState(null)
  const [expandedStaff, setExpandedStaff] = useState(new Set())
  const [staff, setStaff] = useState([])

  // Role-based permissions
  // Handle both role formats: string array or object array
  const userRoles = user?.roles || []
  const roleNames = userRoles.map(role =>
    typeof role === 'string' ? role : (role.role?.name || role.name)
  )
  const isAdmin = roleNames.includes('Admin')
  const isManager = roleNames.includes('Manager')
  const isStaff = roleNames.includes('Staff') || isManager || isAdmin

  // Column sorting handler
  const handleColumnSort = (columnType) => {
    if (columnType === 'created') {
      if (sortBy === 'created') {
        // Toggle sort order if already sorting by created date
        setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')
      } else {
        // Set to created date with default desc order (newest first)
        setSortBy('created')
        setSortOrder('desc')
      }
    } else if (columnType === 'requester') {
      if (sortBy === 'requester') {
        // Toggle sort order if already sorting by requester
        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
      } else {
        // Set to requester with default asc order (A-Z first)
        setSortBy('requester')
        setSortOrder('asc')
      }
    }
  }

  // Get sort indicator for column headers
  const getSortIndicator = (columnType) => {
    if (sortBy === columnType) {
      return sortOrder === 'desc' ? <ChevronDown className="w-4 h-4 ml-1" /> : <ChevronUp className="w-4 h-4 ml-1" />
    }
    return null
  }

  // Sidebar views configuration organized by sections
  const personalViews = [
    {
      id: 'personal-new',
      label: 'New',
      count: 0,
      icon: AlertTriangle,
      filter: { status: 'NEW', personalOnly: true },
      section: 'personal'
    },
    {
      id: 'personal-open',
      label: 'Open',
      count: 0,
      icon: AlertCircle,
      filter: { status: 'OPEN', personalOnly: true },
      section: 'personal'
    },
    {
      id: 'personal-pending',
      label: 'Pending',
      count: 0,
      icon: Clock,
      filter: { status: 'PENDING', personalOnly: true },
      section: 'personal'
    },
    {
      id: 'personal-on-hold',
      label: 'On-hold',
      count: 0,
      icon: Pause,
      filter: { status: 'ON_HOLD', personalOnly: true },
      section: 'personal'
    },
    {
      id: 'personal-solved',
      label: 'Recently Solved',
      count: 0,
      icon: CheckCircle,
      filter: { status: 'SOLVED', recentOnly: true, personalOnly: true },
      section: 'personal'
    },
    {
      id: 'personal-solved-history',
      label: 'Historic Solved',
      count: 0,
      icon: Archive,
      filter: { status: 'SOLVED', historyOnly: true, personalOnly: true },
      section: 'personal'
    }
  ]

  const companyViews = [
    {
      id: 'unassigned',
      label: 'Unassigned',
      count: 0,
      icon: UserX,
      filter: { assigneeId: null, excludeStatuses: ['SOLVED', 'CLOSED'] },
      section: 'company'
    },
    {
      id: 'company-new',
      label: 'New',
      count: 0,
      icon: AlertTriangle,
      filter: { status: 'NEW', assigneeId: null },
      section: 'company'
    },
    {
      id: 'company-open',
      label: 'Open',
      count: 0,
      icon: AlertCircle,
      filter: { status: 'OPEN', requiresAssignee: true },
      section: 'company'
    },
    {
      id: 'company-pending',
      label: 'Pending',
      count: 1,
      icon: Clock,
      filter: { status: 'PENDING', requiresAssignee: true },
      section: 'company'
    },
    {
      id: 'company-on-hold',
      label: 'On-Hold',
      count: 0,
      icon: Pause,
      filter: { status: 'ON_HOLD', requiresAssignee: true },
      section: 'company'
    },
    {
      id: 'company-solved',
      label: 'Recently Solved',
      count: 0,
      icon: CheckCircle,
      filter: { status: 'SOLVED', recentOnly: true, requiresAssignee: true },
      section: 'company'
    },
    {
      id: 'all-unsolved',
      label: 'All Unsolved',
      count: 2,
      icon: AlertTriangle,
      filter: { status: ['NEW', 'OPEN', 'PENDING', 'ON_HOLD'] },
      section: 'company'
    },
    {
      id: 'solved-history',
      label: 'Historic Solved',
      count: 0,
      icon: Archive,
      filter: { status: 'SOLVED', historyOnly: true, requiresAssignee: true },
      section: 'company'
    }
  ]

  const views = [...personalViews, ...companyViews]

  useEffect(() => {
    fetchStats()
    fetchTickets()
    if (isAdmin) {
      fetchStaff()
    }
  }, [currentView])

  useEffect(() => {
    fetchTickets()
  }, [sortBy, sortOrder])

  useEffect(() => {
    // Set initial state from URL params (for back navigation)
    const view = searchParams.get('view')
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const sort = searchParams.get('sort')
    const expanded = searchParams.get('expanded')

    if (view) setCurrentView(view)
    if (status) setStatusFilter(status)
    if (search) setSearchTerm(search)
    if (sort) {
      // Only restore sort from URL if it's a valid value, otherwise default to 'created'
      if (['created', 'updated', 'priority', 'status'].includes(sort)) {
        setSortBy(sort)
      } else {
        setSortBy('created')
      }
    }

    // Restore expanded agents state
    if (expanded) {
      try {
        const expandedArray = JSON.parse(expanded)
        setExpandedStaff(new Set(expandedArray))
      } catch (error) {
        console.error('Failed to parse expanded agents:', error)
      }
    }
  }, [searchParams])

  useEffect(() => {
    // Load user preferences from database
    loadUserPreferences()
  }, [])

  const loadUserPreferences = async () => {
    try {
      const response = await makeAuthenticatedRequest('/api/user-preferences')
      if (response.ok) {
        const data = await response.json()

        if (data.personalViewOrder) {
          setPersonalViewOrder(data.personalViewOrder)
        } else {
          setPersonalViewOrder(personalViews.map(v => v.id))
        }

        if (data.companyViewOrder) {
          setCompanyViewOrder(data.companyViewOrder)
        } else {
          setCompanyViewOrder(companyViews.map(v => v.id))
        }
      } else {
        // Use default order if no preferences found
        setPersonalViewOrder(personalViews.map(v => v.id))
        setCompanyViewOrder(companyViews.map(v => v.id))
      }
    } catch (error) {
      console.error('Failed to load user preferences:', error)
      // Use default order on error
      setPersonalViewOrder(personalViews.map(v => v.id))
      setCompanyViewOrder(companyViews.map(v => v.id))
    }
  }

  const saveUserPreferences = async (personalOrder = null, companyOrder = null) => {
    try {
      await makeAuthenticatedRequest('/api/user-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalViewOrder: personalOrder || personalViewOrder,
          companyViewOrder: companyOrder || companyViewOrder
        })
      })
    } catch (error) {
      console.error('Failed to save user preferences:', error)
    }
  }

  const resetUserPreferences = async () => {
    try {
      await makeAuthenticatedRequest('/api/user-preferences', {
        method: 'DELETE'
      })

      // Reset to default order
      const defaultPersonalOrder = personalViews.map(v => v.id)
      const defaultCompanyOrder = companyViews.map(v => v.id)

      setPersonalViewOrder(defaultPersonalOrder)
      setCompanyViewOrder(defaultCompanyOrder)
    } catch (error) {
      console.error('Failed to reset user preferences:', error)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await makeAuthenticatedRequest('/api/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  const fetchStaff = async () => {
    try {
      const response = await makeAuthenticatedRequest('/api/users')
      if (response.ok) {
        const data = await response.json()
        // Filter for agents and admins only
        const agentUsers = data.users?.filter(user => {
          const userRoles = user.roles || []
          const roleNames = userRoles.map(role =>
            typeof role === 'string' ? role : (role.role?.name || role.name)
          )
          return roleNames.includes('Staff') || roleNames.includes('Admin')
        }) || []
        setStaff(agentUsers)
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error)
    }
  }

  const fetchTickets = async () => {
    try {
      setLoading(true)

      const params = new URLSearchParams()

      // Apply view-specific filters
      const activeView = views.find(v => v.id === currentView)
      if (activeView?.filter) {
        const filter = activeView.filter
        if (filter.status) {
          if (Array.isArray(filter.status)) {
            filter.status.forEach(status => params.append('status', status))
          } else {
            params.append('status', filter.status)
          }
        }
        if (filter.excludeStatuses) {
          filter.excludeStatuses.forEach(status => params.append('excludeStatus', status))
        }
        if (filter.assigneeId !== undefined) {
          if (filter.assigneeId === null) {
            params.append('unassigned', 'true')
          } else {
            params.append('assigneeId', filter.assigneeId)
          }
        }
      }

      // Add sorting parameters
      if (sortBy === 'updated') {
        params.append('sortBy', 'updatedAt')
        params.append('sortOrder', sortOrder)
      } else if (sortBy === 'created') {
        params.append('sortBy', 'createdAt')
        params.append('sortOrder', sortOrder)
      } else if (sortBy === 'priority') {
        params.append('sortBy', 'priority')
        params.append('sortOrder', sortOrder)
      } else if (sortBy === 'status') {
        params.append('sortBy', 'status')
        params.append('sortOrder', sortOrder)
      } else if (sortBy === 'requester') {
        params.append('sortBy', 'requester')
        params.append('sortOrder', sortOrder)
      } else {
        params.append('sortBy', 'createdAt')
        params.append('sortOrder', sortOrder)
      }

      console.log('Fetching tickets with params:', params.toString())
      console.log('Current view:', currentView)

      const response = await makeAuthenticatedRequest(`/api/tickets?${params.toString()}`)

      console.log('Response status:', response.status)

      if (response.ok) {
        const data = await response.json()
        console.log('Tickets received:', data.tickets?.length || 0, 'tickets')
        console.log('First 3 tickets:', data.tickets?.slice(0, 3).map(t => ({ id: t.id, ticketNumber: t.ticketNumber, title: t.title, status: t.status })))
        setTickets(data.tickets || [])
      } else {
        console.error('Failed to fetch tickets - Response not ok:', response.status)
        const errorText = await response.text()
        console.error('Error response:', errorText)
      }
    } catch (error) {
      console.error('Failed to fetch tickets:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateTicketStatus = async (ticketId, newStatus) => {
    try {
      const response = await makeAuthenticatedRequest(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      })

      if (response.ok) {
        // Refresh tickets and stats
        fetchTickets()
        fetchStats()
      }
    } catch (error) {
      console.error('Failed to update ticket status:', error)
    }
  }

  const handleDragStart = (e, index, section) => {
    setDraggedIndex(index)
    setDraggedSection(section)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', e.target.outerHTML)
  }

  const handleDragOver = (e, index, section) => {
    e.preventDefault()
    // Only allow drag within the same section
    if (draggedSection !== section) {
      e.dataTransfer.dropEffect = 'none'
      return
    }
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }

  const handleDrop = (e, dropIndex, section) => {
    e.preventDefault()
    setDragOverIndex(null)

    // Only allow drop within the same section
    if (draggedSection !== section || draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null)
      setDraggedSection(null)
      return
    }

    if (section === 'personal') {
      const orderedViews = getOrderedPersonalViews()
      const newOrder = orderedViews.map(view => view.id)
      const draggedItemId = newOrder[draggedIndex]
      newOrder.splice(draggedIndex, 1)
      newOrder.splice(dropIndex, 0, draggedItemId)
      setPersonalViewOrder(newOrder)
      saveUserPreferences(newOrder, null)
    } else if (section === 'company') {
      const orderedViews = getOrderedCompanyViews()
      const newOrder = orderedViews.map(view => view.id)
      const draggedItemId = newOrder[draggedIndex]
      newOrder.splice(draggedIndex, 1)
      newOrder.splice(dropIndex, 0, draggedItemId)
      setCompanyViewOrder(newOrder)
      saveUserPreferences(null, newOrder)
    }

    setDraggedIndex(null)
    setDraggedSection(null)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
    setDraggedSection(null)
  }

  // Get personal views in the user's preferred order
  const getOrderedPersonalViews = () => {
    if (personalViewOrder.length === 0) return personalViews

    const orderedViews = []
    // Add views in saved order
    personalViewOrder.forEach(id => {
      const view = personalViews.find(v => v.id === id)
      if (view) orderedViews.push(view)
    })

    // Add any new views that weren't in the saved order
    personalViews.forEach(view => {
      if (!personalViewOrder.includes(view.id)) {
        orderedViews.push(view)
      }
    })

    return orderedViews
  }

  // Get company views in the user's preferred order (Staff only)
  const getOrderedCompanyViews = () => {
    if (!isStaff) return []
    if (companyViewOrder.length === 0) return companyViews

    const orderedViews = []
    // Add views in saved order
    companyViewOrder.forEach(id => {
      const view = companyViews.find(v => v.id === id)
      if (view) orderedViews.push(view)
    })

    // Add any new views that weren't in the saved order
    companyViews.forEach(view => {
      if (!companyViewOrder.includes(view.id)) {
        orderedViews.push(view)
      }
    })

    return orderedViews
  }

  // Helper functions for hierarchical view
  const toggleStaffExpansion = (staffId) => {
    const newExpanded = new Set(expandedStaff)
    if (newExpanded.has(staffId)) {
      newExpanded.delete(staffId)
    } else {
      newExpanded.add(staffId)
    }
    setExpandedStaff(newExpanded)
  }

  const groupTicketsByStaff = (tickets, excludeUnassigned = false) => {
    const grouped = {}


    // Group tickets by assignee (tickets are already sorted from the API)
    tickets.forEach(ticket => {
      const assigneeKey = ticket.assigneeId || 'unassigned'


      // Skip unassigned tickets for solved views (they shouldn't exist)
      if (excludeUnassigned && assigneeKey === 'unassigned') {
        return
      }

      if (!grouped[assigneeKey]) {
        grouped[assigneeKey] = {
          tickets: [],
          assignee: ticket.assignee // Store the assignee data
        }
      }
      grouped[assigneeKey].tickets.push(ticket)
    })

    // Sort tickets within each group to maintain the original sort order
    Object.keys(grouped).forEach(agentKey => {
      grouped[agentKey].tickets.sort((a, b) => {
        if (sortBy === 'created') {
          return sortOrder === 'desc'
            ? new Date(b.createdAt) - new Date(a.createdAt)
            : new Date(a.createdAt) - new Date(b.createdAt)
        } else if (sortBy === 'updated') {
          return sortOrder === 'desc'
            ? new Date(b.updatedAt) - new Date(a.updatedAt)
            : new Date(a.updatedAt) - new Date(b.updatedAt)
        } else if (sortBy === 'priority') {
          const priorityOrder = { 'URGENT': 4, 'HIGH': 3, 'NORMAL': 2, 'LOW': 1 }
          return sortOrder === 'desc'
            ? (priorityOrder[b.priority] || 2) - (priorityOrder[a.priority] || 2)
            : (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2)
        } else if (sortBy === 'status') {
          return sortOrder === 'asc'
            ? a.status.localeCompare(b.status)
            : b.status.localeCompare(a.status)
        } else if (sortBy === 'requester') {
          const aName = `${a.requester?.firstName || ''} ${a.requester?.lastName || ''}`.trim()
          const bName = `${b.requester?.firstName || ''} ${b.requester?.lastName || ''}`.trim()
          return sortOrder === 'asc'
            ? aName.localeCompare(bName)
            : bName.localeCompare(aName)
        }
        return new Date(b.createdAt) - new Date(a.createdAt) // Default fallback
      })
    })

    return grouped
  }

  const getStaffName = (staffKey, assigneeData, allGroupedTickets) => {
    if (staffKey === 'unassigned') return 'Unassigned'

    let baseName = ''
    if (assigneeData) {
      baseName = `${assigneeData.firstName} ${assigneeData.lastName}`
    } else {
      // Fallback to staff array lookup
      const staffMember = staff.find(a => a.id === staffKey)
      baseName = staffMember ? `${staffMember.firstName} ${staffMember.lastName}` : `Deleted User (${staffKey.slice(-8)})`
    }

    // Check for duplicate names and add numbers if needed
    if (allGroupedTickets) {
      const sameNameStaff = []

      // Find all agents with the same base name
      Object.keys(allGroupedTickets).forEach(key => {
        if (key === 'unassigned') return

        let otherName = ''
        const ticketGroup = allGroupedTickets[key]

        // Get name from the assignee in the group
        if (ticketGroup?.assignee) {
          otherName = `${ticketGroup.assignee.firstName} ${ticketGroup.assignee.lastName}`
        } else {
          // Fallback to staff array lookup
          const staffMember = staff.find(a => a.id === key)
          otherName = staffMember ? `${staffMember.firstName} ${staffMember.lastName}` : `Deleted User (${key.slice(-8)})`
        }

        if (otherName === baseName) {
          sameNameStaff.push(key)
        }
      })

      // If there are duplicates, add numbers
      if (sameNameStaff.length > 1) {
        const sortedStaff = sameNameStaff.sort()
        const index = sortedStaff.indexOf(staffKey)
        return `${baseName} ${index + 1}`
      }
    }

    return baseName
  }

  const shouldShowHierarchicalView = () => {
    // Enable hierarchical grouping for company views (Open, Pending, On-Hold, Recently Solved)
    const companyViews = [
      'company-open',
      'company-pending',
      'company-on-hold',
      'company-solved',
      'all-unsolved'
    ]
    return companyViews.includes(currentView)
  }

  // Helper function to check if a ticket was solved within the last month
  const isSolvedRecently = (ticket) => {
    if (ticket.status !== 'SOLVED') return false
    const oneMonthAgo = new Date()
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
    const updatedAt = new Date(ticket.updatedAt)
    return updatedAt >= oneMonthAgo
  }

  // Helper function to check if a ticket is in solved history (older than 1 month)
  const isSolvedHistory = (ticket) => {
    if (ticket.status !== 'SOLVED') return false
    const oneMonthAgo = new Date()
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
    const updatedAt = new Date(ticket.updatedAt)
    return updatedAt < oneMonthAgo
  }

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = !searchTerm ||
      ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.ticketNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ticket.requester?.firstName + ' ' + ticket.requester?.lastName).toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ticket.assignee?.firstName + ' ' + ticket.assignee?.lastName).toLowerCase().includes(searchTerm.toLowerCase())

    // Apply status filter
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter

    // Apply view-specific filtering
    const activeView = views.find(v => v.id === currentView)
    let matchesView = true

    if (activeView?.filter) {
      const filter = activeView.filter

      // Handle assignee filtering (specific assignee or null for unassigned)
      if (filter.assigneeId !== undefined) {
        matchesView = matchesView && (ticket.assigneeId === filter.assigneeId)
      }

      // Handle personal only filter (tickets created by or assigned to the user)
      if (filter.personalOnly && user) {
        matchesView = matchesView && (ticket.requesterId === user.id || ticket.assigneeId === user.id)
      }

      // Handle requires assignee filter (must have an assignee) - only if assigneeId is not explicitly set
      if (filter.requiresAssignee && filter.assigneeId === undefined) {
        matchesView = matchesView && (ticket.assigneeId !== null)
      }

      // Handle status filtering from view
      if (filter.status) {
        if (Array.isArray(filter.status)) {
          matchesView = matchesView && filter.status.includes(ticket.status)
        } else {
          matchesView = matchesView && ticket.status === filter.status
        }
      }

      // Handle recent solved tickets filter
      if (filter.recentOnly && ticket.status === 'SOLVED') {
        matchesView = matchesView && isSolvedRecently(ticket)
      }

      // Handle solved history filter
      if (filter.historyOnly && ticket.status === 'SOLVED') {
        matchesView = matchesView && isSolvedHistory(ticket)
      }
    }

    // For all other views, exclude solved tickets older than 1 month
    // unless we're specifically viewing solved history
    if (currentView !== 'solved-history' && currentView !== 'personal-solved-history' && ticket.status === 'SOLVED' && !isSolvedRecently(ticket)) {
      matchesView = false
    }

    return matchesSearch && matchesStatus && matchesView
  })

  // Debug logging for count mismatch investigation
  useEffect(() => {
    if (isSolvedView()) {
      console.log('=== SOLVED VIEW DEBUG INFO ===')
      console.log('Current View:', currentView)
      console.log('Total tickets from API:', tickets.length)
      console.log('Search term:', searchTerm)
      console.log('Status filter:', statusFilter)
      console.log('Filtered tickets count:', filteredTickets.length)
      console.log('First 3 filtered tickets:', filteredTickets.slice(0, 3).map(t => ({
        id: t.id,
        ticketNumber: t.ticketNumber,
        title: t.title,
        status: t.status,
        assignee: t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : 'Unassigned'
      })))
    }
  }, [filteredTickets, currentView, searchTerm, statusFilter])

  const generatePDFReport = async () => {
    const pdf = new jsPDF()
    const pageWidth = pdf.internal.pageSize.width
    const pageHeight = pdf.internal.pageSize.height

    // Minimalist header design
    let logoHeight = 0
    try {
      const logoResponse = await fetch('/images/aidin-logo.png')
      const logoBlob = await logoResponse.blob()
      const logoBase64 = await new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.readAsDataURL(logoBlob)
      })

      // Calculate logo dimensions to maintain aspect ratio
      const img = new Image()
      img.src = logoBase64
      await new Promise(resolve => {
        img.onload = resolve
      })

      const aspectRatio = img.width / img.height
      logoHeight = 20
      const logoWidth = logoHeight * aspectRatio

      // Add logo maintaining aspect ratio
      pdf.addImage(logoBase64, 'PNG', 25, 20, logoWidth, logoHeight)
    } catch (error) {
      console.error('Error loading logo:', error)
    }

    // Clean, minimalist title
    pdf.setFontSize(24)
    pdf.setTextColor(0, 0, 0) // Black
    pdf.text('Aidin Helpdesk', 25, 50)

    pdf.setFontSize(16)
    pdf.setTextColor(100, 100, 100) // Gray
    pdf.text('Tickets Report', 25, 58)

    // Subtle separator line
    pdf.setDrawColor(200, 200, 200)
    pdf.setLineWidth(0.5)
    pdf.line(25, 65, pageWidth - 25, 65)

    // Report metadata - clean and simple
    pdf.setFontSize(9)
    pdf.setTextColor(120, 120, 120)
    const currentDate = new Date().toLocaleDateString('en-US')
    const currentTime = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })

    pdf.text(`Generated: ${currentDate} ${currentTime}`, 25, 72)
    pdf.text(`By: ${user?.firstName} ${user?.lastName}`, 25, 76)

    // Simple filter info
    const activeView = views.find(v => v.id === currentView)
    const filterText = `${activeView?.label || 'All'} (${filteredTickets.length} ticket${filteredTickets.length !== 1 ? 's' : ''})`
    pdf.text(`Filter: ${filterText}`, 25, 80)

    if (statusFilter !== 'all') {
      pdf.text(`Status: ${statusFilter}`, 25, 84)
    }

    // Group tickets by assignee for better organization
    const groupedTickets = filteredTickets.reduce((groups, ticket) => {
      const assigneeKey = ticket.assignee
        ? `${ticket.assignee.firstName} ${ticket.assignee.lastName}`
        : 'Unassigned'

      if (!groups[assigneeKey]) {
        groups[assigneeKey] = []
      }
      groups[assigneeKey].push(ticket)
      return groups
    }, {})

    let currentY = 95

    // Create sections for each user/assignee
    Object.entries(groupedTickets).forEach(([assigneeName, tickets], groupIndex) => {
      // Add space between groups
      if (groupIndex > 0) {
        currentY += 15
      }

      // Check if we need a new page
      if (currentY > pageHeight - 100) {
        pdf.addPage()
        currentY = 30
      }

      // Minimalist user section header
      pdf.setFontSize(12)
      pdf.setTextColor(0, 0, 0) // Black
      pdf.text(`${assigneeName} (${tickets.length} ticket${tickets.length !== 1 ? 's' : ''})`, 25, currentY)

      // Simple underline
      pdf.setDrawColor(220, 220, 220)
      pdf.setLineWidth(0.3)
      pdf.line(25, currentY + 2, pageWidth - 25, currentY + 2)

      currentY += 12

      // Prepare table data for this user
      const tableData = tickets.map((ticket) => [
        ticket.ticketNumber,
        ticket.title.length > 30 ? ticket.title.substring(0, 30) + '...' : ticket.title,
        ticket.status,
        ticket.priority || 'NORMAL',
        `${ticket.requester?.firstName} ${ticket.requester?.lastName}`,
        new Date(ticket.createdAt).toLocaleDateString(),
        ticket.category
      ])

      // Minimalist table configuration
      const tableConfig = {
        head: [['Ticket #', 'Subject', 'Status', 'Priority', 'Requester', 'Created', 'Category']],
        body: tableData,
        startY: currentY,
        styles: {
          fontSize: 8,
          cellPadding: 2,
          textColor: [0, 0, 0], // Black text
          lineColor: [230, 230, 230], // Light gray lines
          lineWidth: 0.1,
        },
        headStyles: {
          fillColor: [245, 245, 245], // Very light gray header
          textColor: [0, 0, 0], // Black text
          fontStyle: 'bold',
          fontSize: 9,
        },
        alternateRowStyles: {
          fillColor: [250, 250, 250], // Minimal alternate row color
        },
        columnStyles: {
          0: { cellWidth: 20 }, // Ticket #
          1: { cellWidth: 35 }, // Subject
          2: { cellWidth: 18 }, // Status
          3: { cellWidth: 18 }, // Priority
          4: { cellWidth: 25 }, // Requester
          5: { cellWidth: 20 }, // Created
          6: { cellWidth: 25 }, // Category
        },
        margin: { left: 25, right: 25 },
        theme: 'plain',
      }

      // Add table for this user
      autoTable(pdf, tableConfig)

      // Update currentY to the position after the table
      currentY = pdf.lastAutoTable.finalY + 10
    })

    // Minimalist footer for all pages
    const pageCount = pdf.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i)

      // Simple footer
      const footerY = pageHeight - 15
      pdf.setFontSize(7)
      pdf.setTextColor(150, 150, 150) // Light gray

      // Left side - confidentiality notice
      pdf.text('Aidin Helpdesk - Confidential', 25, footerY)

      // Right side - page numbers
      pdf.text(`Page ${i} of ${pageCount}`, pageWidth - 25, footerY, { align: 'right' })

      // Add minimal header for continuation pages
      if (i > 1) {
        pdf.setFontSize(10)
        pdf.setTextColor(120, 120, 120)
        pdf.text('Aidin Helpdesk - Tickets Report', 25, 15)

        // Simple line
        pdf.setDrawColor(220, 220, 220)
        pdf.setLineWidth(0.3)
        pdf.line(25, 20, pageWidth - 25, 20)
      }
    }

    // Save the PDF
    const fileName = `Aidin-Tickets-Report-${currentDate.replace(/\//g, '-')}.pdf`
    pdf.save(fileName)
  }

  const getStatusBadge = (status) => {
    const statusConfig = {
      NEW: { label: 'New', className: 'bg-red-100 text-red-800 border-red-200' },
      OPEN: { label: 'Open', className: 'bg-blue-100 text-blue-800 border-blue-200' },
      PENDING: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      ON_HOLD: { label: 'On Hold', className: 'bg-orange-100 text-orange-800 border-orange-200' },
      SOLVED: { label: 'Solved', className: 'bg-green-100 text-green-800 border-green-200' },
      CLOSED: { label: 'Closed', className: 'bg-gray-100 text-gray-800 border-gray-200' }
    }

    const config = statusConfig[status] || statusConfig.NEW
    return (
      <Badge variant="outline" className={config.className}>
        {config.label}
      </Badge>
    )
  }

  const getStatusBackgroundColor = (status) => {
    const statusBackgroundColors = {
      NEW: 'bg-red-50/50',
      OPEN: 'bg-blue-50/50',
      PENDING: 'bg-yellow-50/50',
      ON_HOLD: 'bg-orange-50/50',
      SOLVED: 'bg-green-50/50',
      CLOSED: 'bg-gray-50/50'
    }
    return statusBackgroundColors[status] || statusBackgroundColors.NEW
  }

  const getPriorityBadge = (priority) => {
    const priorityConfig = {
      LOW: { className: 'bg-green-100 text-green-800' },
      NORMAL: { className: 'bg-blue-100 text-blue-800' },
      HIGH: { className: 'bg-orange-100 text-orange-800' },
      URGENT: { className: 'bg-red-100 text-red-800' }
    }

    const config = priorityConfig[priority] || priorityConfig.NORMAL
    return (
      <Badge className={config.className}>
        {priority}
      </Badge>
    )
  }

  const isSolvedView = () => {
    return currentView === 'personal-solved' || currentView === 'company-solved' || currentView === 'solved-history'
  }

  const isSimplifiedView = () => {
    return isSolvedView() || currentView === 'unassigned' || currentView === 'company-new' || currentView === 'personal-new' || currentView === 'personal-open' || currentView === 'personal-pending' || currentView === 'personal-on-hold'
  }

  const calculateTTR = (createdAt, resolvedAt) => {
    if (!resolvedAt) return 'N/A'

    const created = new Date(createdAt)
    const resolved = new Date(resolvedAt)
    const diffMs = resolved - created

    if (diffMs < 0) return 'N/A'

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

    if (diffDays > 0) {
      return `${diffDays}d ${diffHours}h`
    } else if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`
    } else {
      return `${diffMinutes}m`
    }
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="w-64 rounded-lg shadow p-4 h-fit" style={{ backgroundColor: '#3d6964' }}>
            <div className="p-4">
              {/* Personal Work Section */}
              <div className="mb-6">
                {/* Header - Staff Only */}
                {isStaff && (
                  <div className="flex items-center mb-3">
                    <div className="h-px bg-gray-600 flex-1"></div>
                    <span className="px-3 text-white/60 text-xs font-medium uppercase tracking-wide">Your Personal Work</span>
                    <div className="h-px bg-gray-600 flex-1"></div>
                  </div>
                )}

                <div className="space-y-1">
                  {getOrderedPersonalViews().map((view, index) => {
                    const Icon = view.icon
                    const isActive = currentView === view.id
                    const isDragging = draggedIndex === index && draggedSection === 'personal'
                    const isDragOver = dragOverIndex === index && draggedSection === 'personal'

                    return (
                      <button
                        key={view.id}
                        draggable={true}
                        onDragStart={(e) => handleDragStart(e, index, 'personal')}
                        onDragOver={(e) => handleDragOver(e, index, 'personal')}
                        onDrop={(e) => handleDrop(e, index, 'personal')}
                        onDragEnd={handleDragEnd}
                        onClick={() => setCurrentView(view.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors cursor-move ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'text-white/70 hover:bg-white/10 hover:text-white'
                        } ${
                          isDragging ? 'opacity-50 scale-95' : ''
                        } ${
                          isDragOver && !isDragging ? 'bg-gray-600 border-2 border-dashed border-blue-400' : ''
                        }`}
                        title="Drag to reorder within Personal Work section"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center space-x-2">
                            <div className="flex flex-col space-y-0.5">
                              <div className="w-1 h-1 bg-current rounded-full opacity-60"></div>
                              <div className="w-1 h-1 bg-current rounded-full opacity-60"></div>
                              <div className="w-1 h-1 bg-current rounded-full opacity-60"></div>
                            </div>
                            <Icon className="w-4 h-4" />
                          </div>
                          <span>{view.label}</span>
                        </div>
                        <span className="text-xs bg-white/20 text-white px-2 py-1 rounded-full">
                          {view.count}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Company Section - Staff Only */}
              {isStaff && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center flex-1">
                      <div className="h-px bg-gray-600 flex-1"></div>
                      <span className="px-3 text-white/60 text-xs font-medium uppercase tracking-wide">Your Company</span>
                      <div className="h-px bg-gray-600 flex-1"></div>
                    </div>
                    <button
                      onClick={resetUserPreferences}
                      className="ml-2 px-2 py-1 text-xs text-white/60 hover:text-white hover:bg-white/10 rounded border border-white/20 hover:border-white/40 transition-colors"
                      title="Reset view order to default"
                    >
                      Reset
                    </button>
                  </div>

                  <div className="space-y-1">
                    {getOrderedCompanyViews().map((view, index) => {
                      const Icon = view.icon
                      const isActive = currentView === view.id
                      const isDragging = draggedIndex === index && draggedSection === 'company'
                      const isDragOver = dragOverIndex === index && draggedSection === 'company'

                      return (
                        <button
                          key={view.id}
                          draggable={true}
                          onDragStart={(e) => handleDragStart(e, index, 'company')}
                          onDragOver={(e) => handleDragOver(e, index, 'company')}
                          onDrop={(e) => handleDrop(e, index, 'company')}
                          onDragEnd={handleDragEnd}
                          onClick={() => setCurrentView(view.id)}
                          className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors cursor-move ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : 'text-white/70 hover:bg-white/10 hover:text-white'
                          } ${
                            isDragging ? 'opacity-50 scale-95' : ''
                          } ${
                            isDragOver && !isDragging ? 'bg-gray-600 border-2 border-dashed border-blue-400' : ''
                          }`}
                          title="Drag to reorder within Company section"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="flex items-center space-x-2">
                              <div className="flex flex-col space-y-0.5">
                                <div className="w-1 h-1 bg-current rounded-full opacity-60"></div>
                                <div className="w-1 h-1 bg-current rounded-full opacity-60"></div>
                                <div className="w-1 h-1 bg-current rounded-full opacity-60"></div>
                              </div>
                              <Icon className="w-4 h-4" />
                            </div>
                            <span>{view.label}</span>
                          </div>
                          <span className="text-xs bg-white/20 text-white px-2 py-1 rounded-full">
                            {view.count}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Ticket Statistics - Staff Only */}
              {isStaff && (
                <div className="mt-8">
                  <h3 className="text-white text-sm font-medium mb-4">Ticket statistics</h3>
                  <div className="text-xs text-white/70 mb-2">This week</div>
                  <div className="text-center">
                    <div>
                      <div className="text-3xl font-bold text-green-400">
                        {stats.total > 0 ? Math.round((stats.solved / stats.total) * 100) : 0}%
                      </div>
                      <div className="text-xs text-white/70">Effectiveness</div>
                      <div className="text-xs text-white/70 mt-1">
                        {stats.solved} / {stats.total} tickets solved
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Open Tickets - Staff Only */}
              {isStaff && (
                <div className="mt-8">
                  <h3 className="text-white text-sm font-medium mb-4">Open tickets</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-white/60">Your groups</span>
                      <span className="text-blue-400">{stats.unassigned}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {/* Filters */}
            <div className="bg-white rounded-lg shadow mb-6">
              <div className="p-4 border-b">
                {isSimplifiedView() ? (
                  // Simplified filters for solved views and unassigned tickets - only search and save report
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {isStaff && (
                        <h2 className="text-lg font-medium">
                          {(() => {
                            // Calculate the actual displayed count after all filtering
                            if (shouldShowHierarchicalView()) {
                              const issolvedView = currentView === 'company-solved' || currentView === 'solved-history'
                              const groupedTickets = groupTicketsByStaff(filteredTickets, issolvedView)
                              return Object.values(groupedTickets).reduce((total, staffData) => total + staffData.tickets.length, 0)
                            } else {
                              return filteredTickets.length
                            }
                          })()} tickets
                        </h2>
                      )}


                      {/* Add Status filter for unassigned view only - Staff Only */}
                      {isStaff && currentView === 'unassigned' && (
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-500">Status</span>
                          <Select value={statusFilter} onValueChange={(value) => {
                            setStatusFilter(value)
                          }}>
                            <SelectTrigger className="w-32">
                              <SelectValue placeholder="All Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Status</SelectItem>
                              <SelectItem value="NEW">New</SelectItem>
                              <SelectItem value="OPEN">Open</SelectItem>
                              <SelectItem value="PENDING">Pending</SelectItem>
                              <SelectItem value="ON_HOLD">On Hold</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="flex items-center space-x-2">
                        <Input
                          placeholder={isSolvedView() ? "Search tickets... (e.g., Maria)" : "Search unassigned tickets..."}
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-64"
                        />
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={generatePDFReport}
                      className="bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Save Report
                    </Button>
                  </div>
                ) : (
                  // Full filters for non-solved views
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {isStaff && (
                        <h2 className="text-lg font-medium">{filteredTickets.length} tickets</h2>
                      )}

                      {/* Search textbox for company views */}
                      {(currentView === 'company-open' || currentView === 'company-pending' || currentView === 'company-on-hold') && (
                        <div className="flex items-center space-x-2">
                          <Search className="w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Search tickets..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      )}

                      {isStaff && currentView !== 'company-open' && currentView !== 'company-pending' && currentView !== 'company-on-hold' && (
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-500">Status</span>
                          <Select value={statusFilter} onValueChange={(value) => {
                            setStatusFilter(value)
                          }}>
                            <SelectTrigger className="w-32">
                              <SelectValue placeholder="All Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Status</SelectItem>
                              <SelectItem value="NEW">New</SelectItem>
                              <SelectItem value="OPEN">Open</SelectItem>
                              <SelectItem value="PENDING">Pending</SelectItem>
                              <SelectItem value="ON_HOLD">On Hold</SelectItem>
                              <SelectItem value="SOLVED">Solved</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="flex items-center space-x-4">
                        {isStaff && currentView !== 'unassigned' && (
                          <>
                            <span className="text-sm text-gray-500">Assignee</span>
                            <Select value={currentView.includes('unassigned') ? 'unassigned' : currentView.includes('your-work') ? 'me' : 'all'} onValueChange={(value) => {
                              if (value === 'unassigned') {
                                setCurrentView('unassigned')
                              } else if (value === 'me') {
                                setCurrentView('your-work')
                              } else {
                                setCurrentView('unsolved')
                              }
                            }}>
                              <SelectTrigger className="w-32">
                                <SelectValue placeholder="Assignee" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="unassigned">Unassigned</SelectItem>
                                <SelectItem value="me">Assigned to me</SelectItem>
                              </SelectContent>
                            </Select>
                          </>
                        )}

                        {isStaff && (
                          <>
                            <span className="text-sm text-gray-500">Sort by</span>
                            <Select value={sortBy === 'requester' ? `requester_${sortOrder}` : sortBy} onValueChange={(value) => {
                              if (value === 'requester_asc') {
                                setSortBy('requester')
                                setSortOrder('asc')
                              } else if (value === 'requester_desc') {
                                setSortBy('requester')
                                setSortOrder('desc')
                              } else {
                                setSortBy(value)
                                // Set appropriate default sortOrder for other fields
                                if (value === 'created' || value === 'updated') {
                                  setSortOrder('desc')
                                } else {
                                  setSortOrder('asc')
                                }
                              }
                              // Trigger refetch when sort changes
                              setTimeout(() => fetchTickets(), 100)
                            }}>
                              <SelectTrigger className="w-40">
                                <SelectValue placeholder="Sort by..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="updated">Newest updated</SelectItem>
                                <SelectItem value="created">Newest created</SelectItem>
                                <SelectItem value="priority">Priority</SelectItem>
                                <SelectItem value="status">Status</SelectItem>
                                <SelectItem value="requester_asc">Requester A-Z</SelectItem>
                                <SelectItem value="requester_desc">Requester Z-A</SelectItem>
                              </SelectContent>
                            </Select>
                          </>
                        )}
                      </div>
                      </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={generatePDFReport}
                      className="bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Save Report
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Tickets Display */}
            <div className="bg-white rounded-lg shadow">
              {/* Table Header - only for non-solved views */}
              {!isSolvedView() && (
                <div className="p-4 border-b">
                  {currentView === 'unassigned' || currentView === 'company-new' || currentView === 'personal-new' || currentView === 'personal-open' || currentView === 'personal-pending' || currentView === 'personal-on-hold' ? (
                    // Unassigned, New, Personal Open, Personal Pending, and Personal On-Hold views - no Assignee column
                    <div className={`grid gap-4 text-sm font-medium text-gray-700 ${isStaff ? 'grid-cols-10' : 'grid-cols-8'}`}>
                      <div className="col-span-1">Status</div>
                      <div className={isStaff ? "col-span-5" : "col-span-5"}>Subject</div>
                      {isStaff && (
                        <div
                          className="col-span-2 cursor-pointer hover:text-gray-900 flex items-center"
                          onClick={() => handleColumnSort('requester')}
                        >
                          Requester
                          {getSortIndicator('requester')}
                        </div>
                      )}
                      <div
                        className="col-span-2 cursor-pointer hover:text-gray-900 flex items-center"
                        onClick={() => handleColumnSort('created')}
                      >
                        Requested
                        {getSortIndicator('created')}
                      </div>
                    </div>
                  ) : (
                    // All other views - with Assignee column
                    <div className={`grid gap-4 text-sm font-medium text-gray-700 ${isStaff ? 'grid-cols-11' : 'grid-cols-9'}`}>
                      <div className="col-span-1">Status</div>
                      <div className="col-span-4">Subject</div>
                      {isStaff && (
                        <div
                          className="col-span-2 cursor-pointer hover:text-gray-900 flex items-center"
                          onClick={() => handleColumnSort('requester')}
                        >
                          Requester
                          {getSortIndicator('requester')}
                        </div>
                      )}
                      <div
                        className="col-span-2 cursor-pointer hover:text-gray-900 flex items-center"
                        onClick={() => handleColumnSort('created')}
                      >
                        Requested
                        {getSortIndicator('created')}
                      </div>
                      <div className="col-span-2">Assignee</div>
                    </div>
                  )}
                </div>
              )}

              {/* Card Header - only for solved views */}
              {isSolvedView() && (
                <div className="p-4 border-b bg-gray-50">
                  <h3 className="text-lg font-medium text-gray-900">Solved Tickets</h3>
                  <p className="text-sm text-gray-600 mt-1">Tickets grouped by assignee with resolution details</p>
                </div>
              )}

              <div className="divide-y">
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <div key={i} className="p-4 animate-pulse">
                      <div className="grid grid-cols-11 gap-4">
                        <div className="col-span-1">
                          <div className="h-4 bg-gray-200 rounded"></div>
                        </div>
                        <div className="col-span-4">
                          <div className="h-4 bg-gray-200 rounded mb-2"></div>
                          <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                        </div>
                        <div className="col-span-2">
                          <div className="h-4 bg-gray-200 rounded"></div>
                        </div>
                        <div className="col-span-2">
                          <div className="h-4 bg-gray-200 rounded"></div>
                        </div>
                        {isSolvedView() ? (
                          <>
                            <div className="col-span-2">
                              <div className="h-4 bg-gray-200 rounded"></div>
                            </div>
                            <div className="col-span-1">
                              <div className="h-4 bg-gray-200 rounded"></div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="col-span-2">
                              <div className="h-4 bg-gray-200 rounded"></div>
                            </div>
                            <div className="col-span-1">
                              <div className="h-4 bg-gray-200 rounded"></div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                ) : filteredTickets.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    No tickets in this view
                  </div>
                ) : shouldShowHierarchicalView() ? (
                  // Hierarchical view for System Administrators
                  (() => {
                    // Exclude unassigned tickets for solved views (they shouldn't exist)
                    const issolvedView = currentView === 'company-solved' || currentView === 'solved-history'
                    const groupedTickets = groupTicketsByStaff(filteredTickets, issolvedView)
                    return Object.entries(groupedTickets).map(([staffId, staffData]) => (
                    <div key={staffId} className="border-b border-gray-100 last:border-b-0">
                      {/* Staff Header */}
                      <div
                        className="p-4 bg-gray-50 hover:bg-gray-100 cursor-pointer flex items-center justify-between"
                        onClick={() => toggleStaffExpansion(staffId)}
                      >
                        <div className="flex items-center space-x-3">
                          {expandedStaff.has(staffId) ? (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-500" />
                          )}
                          <User className="w-5 h-5 text-gray-600" />
                          <span className="font-medium text-gray-900">
                            {getStaffName(staffId, staffData.assignee, groupedTickets)}
                          </span>
                          <Badge variant="outline" className="ml-2">
                            {`${staffData.tickets.length} ticket${staffData.tickets.length !== 1 ? 's' : ''}`}
                          </Badge>
                        </div>
                      </div>

                      {/* Staff's Tickets */}
                      {expandedStaff.has(staffId) && (
                        <div className="pl-8">
                          {isSolvedView() ? (
                            // Card layout for solved views
                            <div className="grid gap-4 py-4">
                              {staffData.tickets.map((ticket) => (
                                <div
                                  key={ticket.id}
                                  className={`bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer hover:border-gray-300 ${getStatusBackgroundColor(ticket.status)}`}
                                  onClick={() => {
                                    const returnParams = new URLSearchParams({
                                      view: currentView,
                                      status: statusFilter,
                                      search: searchTerm,
                                      sort: sortBy,
                                      expanded: JSON.stringify(Array.from(expandedStaff))
                                    })
                                    router.push(`/tickets/${ticket.id}?return=${encodeURIComponent(returnParams.toString())}`)
                                  }}
                                >
                                  {/* Card Header */}
                                  <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center space-x-3">
                                      {getStatusBadge(ticket.status)}
                                      <span className="text-sm font-mono text-gray-500">#{ticket.ticketNumber}</span>
                                    </div>
                                    <div className="text-sm font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                      TTR: {calculateTTR(ticket.createdAt, ticket.resolvedAt)}
                                    </div>
                                  </div>

                                  {/* Card Title */}
                                  <h4 className="font-medium text-gray-900 mb-2 line-clamp-2">
                                    {ticket.title}
                                  </h4>

                                  {/* Card Metadata */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                    {/* Left Column */}
                                    <div className="space-y-2">
                                      {isStaff && (
                                        <div className="flex items-center space-x-2">
                                          <User className="w-4 h-4 text-gray-400" />
                                          <span className="text-gray-600">Requester:</span>
                                          <span className="text-gray-900">
                                            {ticket.requester?.firstName} {ticket.requester?.lastName}
                                          </span>
                                        </div>
                                      )}
                                      <div className="flex items-center space-x-2">
                                        <Calendar className="w-4 h-4 text-gray-400" />
                                        <span className="text-gray-600">Requested:</span>
                                        <span className="text-gray-900">
                                          {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Right Column */}
                                    <div className="space-y-2">
                                      <div className="flex items-center space-x-2">
                                        <CheckCircle className="w-4 h-4 text-green-400" />
                                        <span className="text-gray-600">Solved:</span>
                                        {ticket.resolvedAt ? (
                                          <span className="text-green-600">
                                            {formatDistanceToNow(new Date(ticket.resolvedAt), { addSuffix: true })}
                                          </span>
                                        ) : (
                                          <span className="text-gray-400">Not recorded</span>
                                        )}
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <div className="flex items-center space-x-1">
                                          <Badge className="text-xs">{ticket.category}</Badge>
                                          {ticket.priority && getPriorityBadge(ticket.priority)}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            // Column layout for non-solved views
                            staffData.tickets.map((ticket) => (
                              <div key={ticket.id} className={`p-4 hover:bg-gray-50 cursor-pointer border-l-2 border-gray-200 ${getStatusBackgroundColor(ticket.status)}`}
                                   onClick={() => {
                                     const returnParams = new URLSearchParams({
                                       view: currentView,
                                       status: statusFilter,
                                       search: searchTerm,
                                       sort: sortBy,
                                       expanded: JSON.stringify(Array.from(expandedStaff))
                                     })
                                     router.push(`/tickets/${ticket.id}?return=${encodeURIComponent(returnParams.toString())}`)
                                   }}>
                                {currentView === 'unassigned' || currentView === 'company-new' || currentView === 'personal-new' || currentView === 'personal-open' || currentView === 'personal-pending' || currentView === 'personal-on-hold' ? (
                                  // Unassigned, New, Personal Open, Personal Pending, and Personal On-Hold views - no Assignee column
                                  <div className={`grid gap-4 items-center ${isStaff ? 'grid-cols-10' : 'grid-cols-8'}`}>
                                    {/* Status */}
                                    <div className="col-span-1">
                                      {getStatusBadge(ticket.status)}
                                    </div>

                                    {/* Subject */}
                                    <div className="col-span-5">
                                      <div className="font-medium text-gray-900 mb-1">
                                        #{ticket.ticketNumber} {ticket.title}
                                      </div>
                                      <div className="text-sm text-gray-500 flex items-center space-x-2">
                                        <Badge className="text-xs">{ticket.category}</Badge>
                                        {ticket.priority && getPriorityBadge(ticket.priority)}
                                      </div>
                                    </div>

                                    {/* Requester - Staff Only */}
                                    {isStaff && (
                                      <div className="col-span-2">
                                        <div className="flex items-center space-x-2">
                                          <User className="w-4 h-4 text-gray-400" />
                                          <span className="text-sm text-gray-900">
                                            {ticket.requester?.firstName} {ticket.requester?.lastName}
                                          </span>
                                        </div>
                                      </div>
                                    )}

                                    {/* Requested */}
                                    <div className="col-span-2">
                                      <div className="flex items-center space-x-2">
                                        <Calendar className="w-4 h-4 text-gray-400" />
                                        <span className="text-sm text-gray-500">
                                          {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  // All other views - with Assignee column
                                  <div className={`grid gap-4 items-center ${isStaff ? 'grid-cols-11' : 'grid-cols-9'}`}>
                                    {/* Status */}
                                    <div className="col-span-1">
                                      {getStatusBadge(ticket.status)}
                                    </div>

                                    {/* Subject */}
                                    <div className="col-span-4">
                                      <div className="font-medium text-gray-900 mb-1">
                                        #{ticket.ticketNumber} {ticket.title}
                                      </div>
                                      <div className="text-sm text-gray-500 flex items-center space-x-2">
                                        <Badge className="text-xs">{ticket.category}</Badge>
                                        {ticket.priority && getPriorityBadge(ticket.priority)}
                                      </div>
                                    </div>

                                    {/* Requester - Staff Only */}
                                    {isStaff && (
                                      <div className="col-span-2">
                                        <div className="flex items-center space-x-2">
                                          <User className="w-4 h-4 text-gray-400" />
                                          <span className="text-sm text-gray-900">
                                            {ticket.requester?.firstName} {ticket.requester?.lastName}
                                          </span>
                                        </div>
                                      </div>
                                    )}

                                    {/* Requested */}
                                    <div className="col-span-2">
                                      <div className="flex items-center space-x-2">
                                        <Calendar className="w-4 h-4 text-gray-400" />
                                        <span className="text-sm text-gray-500">
                                          {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Assignee */}
                                    <div className="col-span-2">
                                      {ticket.assignee ? (
                                        <div className="flex items-center space-x-2">
                                          <User className="w-4 h-4 text-gray-400" />
                                          <span className="text-sm text-gray-900">
                                            {ticket.assignee.firstName} {ticket.assignee.lastName}
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-sm text-gray-400">Unassigned</span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  ))
                })()
                ) : (
                  // Standard view for non-admin users
                  isSolvedView() ? (
                    // Card layout for solved views
                    <div className="grid gap-4 p-4">
                      {filteredTickets.map((ticket) => (
                        <div
                          key={ticket.id}
                          className={`bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer hover:border-gray-300 ${getStatusBackgroundColor(ticket.status)}`}
                          onClick={() => {
                            const returnParams = new URLSearchParams({
                              view: currentView,
                              status: statusFilter,
                              search: searchTerm,
                              sort: sortBy,
                              expanded: JSON.stringify(Array.from(expandedStaff))
                            })
                            router.push(`/tickets/${ticket.id}?return=${encodeURIComponent(returnParams.toString())}`)
                          }}
                        >
                          {/* Card Header */}
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              {getStatusBadge(ticket.status)}
                              <span className="text-sm font-mono text-gray-500">#{ticket.ticketNumber}</span>
                            </div>
                            <div className="text-sm font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                              TTR: {calculateTTR(ticket.createdAt, ticket.resolvedAt)}
                            </div>
                          </div>

                          {/* Card Title */}
                          <h4 className="font-medium text-gray-900 mb-2 line-clamp-2">
                            {ticket.title}
                          </h4>

                          {/* Card Metadata */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            {/* Left Column */}
                            <div className="space-y-2">
                              <div className="flex items-center space-x-2">
                                <User className="w-4 h-4 text-gray-400" />
                                <span className="text-gray-600">Requester:</span>
                                <span className="text-gray-900">
                                  {ticket.requester?.firstName} {ticket.requester?.lastName}
                                </span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                <span className="text-gray-600">Requested:</span>
                                <span className="text-gray-900">
                                  {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}
                                </span>
                              </div>
                            </div>

                            {/* Right Column */}
                            <div className="space-y-2">
                              <div className="flex items-center space-x-2">
                                <User className="w-4 h-4 text-gray-400" />
                                <span className="text-gray-600">Assignee:</span>
                                <span className="text-gray-900">
                                  {ticket.assignee?.firstName} {ticket.assignee?.lastName}
                                </span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <CheckCircle className="w-4 h-4 text-green-400" />
                                <span className="text-gray-600">Solved:</span>
                                {ticket.resolvedAt ? (
                                  <span className="text-green-600">
                                    {formatDistanceToNow(new Date(ticket.resolvedAt), { addSuffix: true })}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">Not recorded</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Card Footer */}
                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                            <div className="flex items-center space-x-2">
                              <Badge className="text-xs">{ticket.category}</Badge>
                              {ticket.priority && getPriorityBadge(ticket.priority)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    // Column layout for non-solved views
                    filteredTickets.map((ticket) => (
                      <div key={ticket.id} className={`p-4 hover:bg-gray-50 cursor-pointer ${getStatusBackgroundColor(ticket.status)}`}
                           onClick={() => {
                             const returnParams = new URLSearchParams({
                               view: currentView,
                               status: statusFilter,
                               search: searchTerm,
                               sort: sortBy,
                               expanded: JSON.stringify(Array.from(expandedStaff))
                             })
                             router.push(`/tickets/${ticket.id}?return=${encodeURIComponent(returnParams.toString())}`);
                           }}>
                        {(currentView === 'unassigned' || currentView === 'company-new' || currentView === 'personal-new' || currentView === 'personal-open' || currentView === 'personal-pending' || currentView === 'personal-on-hold') ? (
                          // Unassigned, New, Personal Open, Personal Pending, and Personal On-Hold views - no Assignee column
                          <div className={`grid gap-4 items-center ${isStaff ? 'grid-cols-10' : 'grid-cols-8'}`}>
                            {/* Status */}
                            <div className="col-span-1">
                              {getStatusBadge(ticket.status)}
                            </div>

                            {/* Subject */}
                            <div className="col-span-5">
                              <div className="font-medium text-gray-900 mb-1">
                                #{ticket.ticketNumber} {ticket.title}
                              </div>
                              <div className="text-sm text-gray-500 flex items-center space-x-2">
                                <Badge className="text-xs">{ticket.category}</Badge>
                                {ticket.priority && getPriorityBadge(ticket.priority)}
                              </div>
                            </div>

                            {/* Requester - Staff Only */}
                            {isStaff && (
                              <div className="col-span-2">
                                <div className="flex items-center space-x-2">
                                  <User className="w-4 h-4 text-gray-400" />
                                  <span className="text-sm text-gray-900">
                                    {ticket.requester?.firstName} {ticket.requester?.lastName}
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Requested */}
                            <div className="col-span-2">
                              <div className="flex items-center space-x-2">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                <span className="text-sm text-gray-500">
                                  {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          // All other views - with Assignee column
                          <div className={`grid gap-4 items-center ${isStaff ? 'grid-cols-11' : 'grid-cols-9'}`}>
                            {/* Status */}
                            <div className="col-span-1">
                              {getStatusBadge(ticket.status)}
                            </div>

                            {/* Subject */}
                            <div className="col-span-4">
                              <div className="font-medium text-gray-900 mb-1">
                                #{ticket.ticketNumber} {ticket.title}
                              </div>
                              <div className="text-sm text-gray-500 flex items-center space-x-2">
                                <Badge className="text-xs">{ticket.category}</Badge>
                                {ticket.priority && getPriorityBadge(ticket.priority)}
                              </div>
                            </div>

                            {/* Requester - Staff Only */}
                            {isStaff && (
                              <div className="col-span-2">
                                <div className="flex items-center space-x-2">
                                  <User className="w-4 h-4 text-gray-400" />
                                  <span className="text-sm text-gray-900">
                                    {ticket.requester?.firstName} {ticket.requester?.lastName}
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Requested */}
                            <div className="col-span-2">
                              <div className="flex items-center space-x-2">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                <span className="text-sm text-gray-500">
                                  {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}
                                </span>
                              </div>
                            </div>

                            {/* Assignee */}
                            <div className="col-span-2">
                              {ticket.assignee ? (
                                <div className="flex items-center space-x-2">
                                  <User className="w-4 h-4 text-gray-400" />
                                  <span className="text-sm text-gray-900">
                                    {ticket.assignee.firstName} {ticket.assignee.lastName}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-sm text-gray-400">Unassigned</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default function TicketsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TicketsPageContent />
    </Suspense>
  )
}