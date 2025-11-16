'use client'

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import DashboardLayout from '@/components/DashboardLayout'
import { DataTable } from '@/components/tickets/DataTable'
import { createTicketColumns } from '@/components/tickets/columns'
import {
  TicketsSidebar,
  PERSONAL_VIEWS,
  COMPANY_VIEWS,
} from '@/components/tickets/TicketsSidebar'
import { Button } from '@/components/ui/button'
import { Download, FileText } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// View filter configurations
const VIEW_FILTERS = {
  'personal-new': { status: 'NEW', personalOnly: true },
  'personal-open': { status: 'OPEN', personalOnly: true },
  'personal-pending': { status: 'PENDING', personalOnly: true },
  'personal-on-hold': { status: 'ON_HOLD', personalOnly: true },
  'personal-solved': { status: 'SOLVED', recentOnly: true, personalOnly: true },
  'personal-solved-history': { status: 'SOLVED', historyOnly: true, personalOnly: true },
  'unassigned': { assigneeId: null, excludeStatuses: ['SOLVED'] },
  'company-new': { status: 'NEW', assigneeId: null },
  'company-open': { status: 'OPEN', requiresAssignee: true },
  'company-pending': { status: 'PENDING', requiresAssignee: true },
  'company-on-hold': { status: 'ON_HOLD', requiresAssignee: true },
  'company-solved': { status: 'SOLVED', recentOnly: true, requiresAssignee: true },
  'all-unsolved': { status: ['NEW', 'OPEN', 'PENDING', 'ON_HOLD'] },
  'solved-history': { status: 'SOLVED', historyOnly: true, requiresAssignee: true },
}

function TicketsPageContent() {
  const { makeAuthenticatedRequest, user, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  // State
  const [tickets, setTickets] = useState([])
  const [ticketStats, setTicketStats] = useState(null)
  const [ticketsLoading, setTicketsLoading] = useState(true)
  const [currentView, setCurrentView] = useState('personal-new')

  // Role-based permissions
  const userRoles = user?.roles || []
  const roleNames = userRoles.map((role) =>
    typeof role === 'string' ? role : role.role?.name || role.name
  )
  const isAdmin = roleNames.includes('Admin')
  const isManager = roleNames.includes('Manager')
  const isStaff = roleNames.includes('Staff') || isManager || isAdmin

  // Memoized columns based on current view
  const columns = useMemo(() => {
    if (!user) return []
    const showAssignee = !['unassigned', 'company-new', 'personal-new', 'personal-open', 'personal-pending', 'personal-on-hold'].includes(currentView)
    return createTicketColumns(user.id, showAssignee)
  }, [user?.id, currentView])

  // Create views with counts
  const personalViews = useMemo(() => {
    return PERSONAL_VIEWS.map((view) => ({
      ...view,
      count: ticketStats?.personal?.[view.id] || 0,
      section: 'personal',
    }))
  }, [ticketStats])

  const companyViews = useMemo(() => {
    return COMPANY_VIEWS.map((view) => ({
      ...view,
      count: ticketStats?.company?.[view.id] || 0,
      section: 'company',
    }))
  }, [ticketStats])

  // Fetch ticket stats for sidebar counts
  const fetchTicketStats = useCallback(async () => {
    try {
      const response = await makeAuthenticatedRequest('/api/tickets/stats')
      if (response.ok) {
        const data = await response.json()
        setTicketStats(data)
      } else if (response.status === 401) {
        window.location.href = '/login'
      }
    } catch (error) {
      console.error('Failed to fetch ticket stats:', error)
    }
  }, [makeAuthenticatedRequest])

  // Fetch tickets based on current view
  const fetchTickets = useCallback(
    async (showLoading = true) => {
      if (!user) return

      try {
        if (showLoading) setTicketsLoading(true)

        const params = new URLSearchParams()
        const filter = VIEW_FILTERS[currentView]

        if (filter) {
          if (filter.status) {
            if (Array.isArray(filter.status)) {
              filter.status.forEach((s) => params.append('status', s))
            } else {
              params.append('status', filter.status)
            }
          }
          if (filter.excludeStatuses) {
            filter.excludeStatuses.forEach((s) =>
              params.append('excludeStatus', s)
            )
          }
          if (filter.assigneeId === null) {
            params.append('unassigned', 'true')
          }
        }

        // Default sort by creation date descending
        params.append('sortBy', 'createdAt')
        params.append('sortOrder', 'desc')

        const response = await makeAuthenticatedRequest(
          `/api/tickets?${params.toString()}`
        )

        if (response.ok) {
          const data = await response.json()
          setTickets(data.tickets || [])
        } else if (response.status === 401) {
          window.location.href = '/login'
        } else {
          setTickets([])
        }
      } catch (error) {
        console.error('Failed to fetch tickets:', error)
        setTickets([])
      } finally {
        if (showLoading) setTicketsLoading(false)
      }
    },
    [currentView, user, makeAuthenticatedRequest]
  )

  // Initial load
  useEffect(() => {
    if (user && !authLoading) {
      fetchTickets()
      fetchTicketStats()
    }
  }, [user, authLoading, fetchTickets, fetchTicketStats])

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!user || authLoading) return

    const interval = setInterval(() => {
      fetchTickets(false)
      fetchTicketStats()
    }, 60000)

    return () => clearInterval(interval)
  }, [user, authLoading, fetchTickets, fetchTicketStats])

  // URL state restoration
  useEffect(() => {
    const view = searchParams.get('view')
    if (view && VIEW_FILTERS[view]) {
      setCurrentView(view)
    }
  }, [searchParams])

  // Handle view change
  const handleViewChange = useCallback((viewId) => {
    setCurrentView(viewId)
    // Update URL without full page reload
    const url = new URL(window.location.href)
    url.searchParams.set('view', viewId)
    window.history.pushState({}, '', url.toString())
  }, [])

  // Handle row click - navigate to ticket detail
  const handleRowClick = useCallback(
    (ticket) => {
      const returnParams = new URLSearchParams({ view: currentView })
      router.push(
        `/tickets/${ticket.id}?return=${encodeURIComponent(returnParams.toString())}`
      )
    },
    [router, currentView]
  )

  // Export to PDF
  const exportToPDF = useCallback(() => {
    const doc = new jsPDF()
    const viewLabel = [...PERSONAL_VIEWS, ...COMPANY_VIEWS].find(
      (v) => v.id === currentView
    )?.label || 'Tickets'

    doc.setFontSize(18)
    doc.text(`${viewLabel} - Ticket Report`, 14, 22)
    doc.setFontSize(11)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 32)

    const tableData = tickets.map((ticket) => [
      ticket.ticketNumber,
      ticket.status,
      ticket.title.substring(0, 40) + (ticket.title.length > 40 ? '...' : ''),
      ticket.requester
        ? `${ticket.requester.firstName} ${ticket.requester.lastName}`
        : 'Unknown',
      ticket.assignee
        ? `${ticket.assignee.firstName} ${ticket.assignee.lastName}`
        : 'Unassigned',
      new Date(ticket.createdAt).toLocaleDateString(),
    ])

    autoTable(doc, {
      startY: 40,
      head: [['Ticket #', 'Status', 'Subject', 'Requester', 'Assignee', 'Created']],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
    })

    doc.save(`tickets-${currentView}-${Date.now()}.pdf`)
  }, [tickets, currentView])

  // Export to CSV
  const exportToCSV = useCallback(() => {
    const headers = ['Ticket #', 'Status', 'Subject', 'Category', 'Priority', 'Requester', 'Assignee', 'Created', 'Updated']
    const rows = tickets.map((ticket) => [
      ticket.ticketNumber,
      ticket.status,
      `"${ticket.title.replace(/"/g, '""')}"`,
      ticket.category,
      ticket.priority || 'N/A',
      ticket.requester ? `${ticket.requester.firstName} ${ticket.requester.lastName}` : 'Unknown',
      ticket.assignee ? `${ticket.assignee.firstName} ${ticket.assignee.lastName}` : 'Unassigned',
      new Date(ticket.createdAt).toISOString(),
      new Date(ticket.updatedAt).toISOString(),
    ])

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `tickets-${currentView}-${Date.now()}.csv`
    link.click()
  }, [tickets, currentView])

  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 pt-4 pb-8">
        <div className="flex h-[calc(100vh-120px)] bg-white rounded-lg shadow-sm border">
          {/* Sidebar */}
          <TicketsSidebar
            personalViews={personalViews}
            companyViews={companyViews}
            currentView={currentView}
            onViewChange={handleViewChange}
            onNewTicket={() => router.push('/tickets/new')}
            isStaff={isStaff}
          />

          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  {[...PERSONAL_VIEWS, ...COMPANY_VIEWS].find((v) => v.id === currentView)?.label || 'Tickets'}
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  {tickets.length} {tickets.length === 1 ? 'ticket' : 'tickets'}
                </p>
              </div>

              {/* Export Actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={exportToPDF}>
                    <FileText className="w-4 h-4 mr-2" />
                    Export as PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportToCSV}>
                    <FileText className="w-4 h-4 mr-2" />
                    Export as CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Data Table */}
            <div className="flex-1 overflow-hidden">
              <DataTable
                columns={columns}
                data={tickets}
                searchPlaceholder="Search tickets..."
                onRowClick={handleRowClick}
                isLoading={ticketsLoading}
                emptyMessage="No tickets found in this view."
                enableColumnVisibility={true}
                enableGlobalFilter={true}
                rowHeight={72}
                className="h-full"
              />
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default function TicketsPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <div className="flex items-center justify-center h-screen">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        </DashboardLayout>
      }
    >
      <TicketsPageContent />
    </Suspense>
  )
}
