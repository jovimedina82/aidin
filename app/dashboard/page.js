'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../components/AuthProvider'
import DashboardLayout from '../../components/DashboardLayout'
import CreateTicketDialog from '../../components/CreateTicketDialog'
import TicketCard from '../../components/TicketCard'
import VirtualAssistant from '../../components/VirtualAssistant'
import DraggableStatCard from '../../components/DraggableStatCard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Ticket, Clock, CheckCircle, AlertCircle, Users, TrendingUp, Pause, MessageCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useSocket } from '@/lib/hooks/useSocket'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable'
import { toast } from 'sonner'

export default function DashboardPage() {
  const { makeAuthenticatedRequest, user } = useAuth()
  const router = useRouter()
  const { isConnected, isEnabled, on, off } = useSocket()
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    pending: 0,
    solved: 0,
    unassigned: 0,
    onHold: 0,
    newTickets: 0,
    closed: 0
  })
  const [recentTickets, setRecentTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAssistant, setShowAssistant] = useState(false)
  const [assistantMinimized, setAssistantMinimized] = useState(false)

  // Default card order
  const defaultCardOrder = ['total', 'open', 'pending', 'solved', 'onHold', 'new']
  const [cardOrder, setCardOrder] = useState(defaultCardOrder)

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Azure AD token handling is now done in AuthProvider

  // Fetch dashboard data function (used by both polling and initial load)
  const fetchDashboardData = useCallback(async (showLoadingState = true) => {
    try {
      if (showLoadingState) {
        setLoading(true)
      }

      // Fetch stats and recent NEW tickets in parallel
      const [statsResponse, ticketsResponse] = await Promise.all([
        makeAuthenticatedRequest('/api/stats'),
        makeAuthenticatedRequest('/api/tickets?limit=8&status=NEW')
      ])

      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setStats(statsData)
      }

      if (ticketsResponse.ok) {
        const ticketsData = await ticketsResponse.json()
        setRecentTickets(ticketsData.tickets || ticketsData || [])
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      if (showLoadingState) {
        setLoading(false)
      }
    }
  }, [makeAuthenticatedRequest])

  // Load user card order preference
  const loadCardOrderPreference = useCallback(async () => {
    try {
      const response = await makeAuthenticatedRequest('/api/user-preferences')
      if (response.ok) {
        const data = await response.json()
        if (data.dashboardCardOrder && Array.isArray(data.dashboardCardOrder)) {
          setCardOrder(data.dashboardCardOrder)
        }
      }
    } catch (error) {
      console.error('Failed to load card order preference:', error)
    }
  }, [makeAuthenticatedRequest])

  // Save card order preference
  const saveCardOrderPreference = useCallback(async (newOrder) => {
    try {
      await makeAuthenticatedRequest('/api/user-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dashboardCardOrder: newOrder })
      })
    } catch (error) {
      console.error('Failed to save card order preference:', error)
      toast.error('Failed to save card layout')
    }
  }, [makeAuthenticatedRequest])

  // Handle drag end
  const handleDragEnd = (event) => {
    const { active, over } = event

    if (active.id !== over.id) {
      setCardOrder((items) => {
        const oldIndex = items.indexOf(active.id)
        const newIndex = items.indexOf(over.id)
        const newOrder = arrayMove(items, oldIndex, newIndex)

        // Save to backend
        saveCardOrderPreference(newOrder)
        toast.success('Dashboard layout saved')

        return newOrder
      })
    }
  }

  // Initial data fetch and load preferences
  useEffect(() => {
    fetchDashboardData(true)
    loadCardOrderPreference()
  }, [fetchDashboardData, loadCardOrderPreference])

  // Socket.IO event handlers
  useEffect(() => {
    if (!isEnabled || !isConnected) {
      return
    }

    console.log('📡 Setting up Socket.IO event listeners')

    const handleTicketCreated = (data) => {
      console.log('🎫 Ticket created:', data.ticket.ticketNumber)
      fetchDashboardData(false) // Refresh without loading state
    }

    const handleTicketUpdated = (data) => {
      console.log('🔄 Ticket updated:', data.ticket.ticketNumber)
      fetchDashboardData(false) // Refresh without loading state
    }

    const handleTicketDeleted = (data) => {
      console.log('🗑️ Ticket deleted:', data.ticketId)
      fetchDashboardData(false) // Refresh without loading state
    }

    const handleStatsUpdate = (data) => {
      console.log('📊 Stats updated')
      setStats(data.stats)
    }

    // Register event listeners
    on('ticket:created', handleTicketCreated)
    on('ticket:updated', handleTicketUpdated)
    on('ticket:deleted', handleTicketDeleted)
    on('stats:updated', handleStatsUpdate)

    // Cleanup event listeners
    return () => {
      off('ticket:created', handleTicketCreated)
      off('ticket:updated', handleTicketUpdated)
      off('ticket:deleted', handleTicketDeleted)
      off('stats:updated', handleStatsUpdate)
    }
  }, [isEnabled, isConnected, on, off, fetchDashboardData])

  // Polling fallback - only if WebSockets are disabled or disconnected
  useEffect(() => {
    // If live updates are enabled and connected, skip polling
    if (isEnabled && isConnected) {
      console.log('📡 Using WebSocket updates, polling disabled')
      return
    }

    console.log('🔄 Using polling fallback (every 30 seconds)')

    // Set up polling interval (every 30 seconds)
    const interval = setInterval(() => {
      fetchDashboardData(false) // false = no loading spinner
    }, 30000)

    // Cleanup on unmount
    return () => clearInterval(interval)
  }, [isEnabled, isConnected, fetchDashboardData])

  const handleTicketCreated = () => {
    fetchDashboardData()
  }

  const handleTicketClick = (ticket) => {
    router.push(`/tickets/${ticket.id}`)
  }

  const isStaff = user?.roles?.some(role => ['Admin', 'Manager', 'Staff'].includes(role))

  // Define all stat cards configuration
  const statCardsConfig = {
    total: {
      id: 'total',
      title: 'Total Tickets',
      value: stats.total,
      description: 'All time tickets',
      icon: Ticket,
      color: ''
    },
    open: {
      id: 'open',
      title: 'Open Tickets',
      value: stats.open,
      description: 'Active tickets',
      icon: Clock,
      color: 'text-blue-600'
    },
    pending: {
      id: 'pending',
      title: 'Pending',
      value: stats.pending,
      description: 'Waiting for response',
      icon: AlertCircle,
      color: 'text-yellow-600'
    },
    solved: {
      id: 'solved',
      title: 'Solved',
      value: stats.solved,
      description: 'Resolved tickets',
      icon: CheckCircle,
      color: 'text-green-600'
    },
    onHold: {
      id: 'onHold',
      title: 'On Hold',
      value: stats.onHold,
      description: 'Temporarily paused',
      icon: Pause,
      color: 'text-purple-600'
    },
    new: {
      id: 'new',
      title: 'New',
      value: stats.newTickets,
      description: 'Just created',
      icon: AlertCircle,
      color: 'text-orange-600'
    }
  }

  // Debug logging for SSO users
  React.useEffect(() => {
    if (user) {
      console.log('Dashboard user data:', user)
      console.log('User roles:', user.roles)
      console.log('Is staff?', isStaff)
    }
  }, [user, isStaff])

  // Debug logging for Virtual Assistant
  React.useEffect(() => {
    console.log('Virtual Assistant state:', {
      showAssistant,
      assistantMinimized,
      user: !!user,
      roles: user?.roles,
      shouldShowButton: !showAssistant
    })
  }, [showAssistant, assistantMinimized, user])

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Welcome back, {user?.firstName}!
              </h1>
              <p className="text-muted-foreground">
                Here's what's happening with your support tickets today.
              </p>
            </div>
            <CreateTicketDialog onTicketCreated={handleTicketCreated} />
          </div>

          {/* Stats Cards - Draggable */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={cardOrder}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
                {cardOrder.map((cardId) => {
                  const card = statCardsConfig[cardId]
                  if (!card) return null
                  return (
                    <DraggableStatCard
                      key={card.id}
                      id={card.id}
                      title={card.title}
                      value={card.value}
                      description={card.description}
                      icon={card.icon}
                      color={card.color}
                      loading={loading}
                    />
                  )
                })}
              </div>
            </SortableContext>
          </DndContext>

          {/* Recent Tickets */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Recent Tickets
                  <Button variant="ghost" size="sm" onClick={() => router.push('/tickets')}>
                    View All
                  </Button>
                </CardTitle>
                <CardDescription>
                  New support tickets awaiting assignment
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-20 bg-muted rounded"></div>
                      </div>
                    ))}
                  </div>
                ) : recentTickets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Ticket className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No new tickets</p>
                    <p className="text-sm">All tickets have been assigned or resolved</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentTickets.slice(0, 5).map((ticket) => (
                      <TicketCard
                        key={ticket.id}
                        ticket={ticket}
                        onClick={handleTicketClick}
                        currentUserId={user?.id}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Right Column - Quick Actions and More Recent Tickets */}
            <div className="space-y-8">
              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                  <CardDescription>
                    Common tasks
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                <div className="grid gap-3">
                    <Button
                      variant="outline"
                      className="justify-start h-auto p-3"
                      onClick={() => router.push('/tickets')}
                    >
                      <Ticket className="mr-3 h-4 w-4" />
                      <div className="text-left">
                        <div className="font-medium text-sm">View All Tickets</div>
                        <div className="text-xs text-muted-foreground">
                          Browse and manage
                        </div>
                      </div>
                    </Button>

                    {isStaff && (
                      <>
                        <Button
                          variant="outline"
                          className="justify-start h-auto p-3"
                          onClick={() => router.push('/tickets?view=unassigned')}
                        >
                          <Users className="mr-3 h-4 w-4 text-red-600" />
                          <div className="text-left">
                            <div className="font-medium text-sm">Unassigned ({stats.unassigned})</div>
                            <div className="text-xs text-muted-foreground">
                              Need assignment
                            </div>
                          </div>
                        </Button>

                        <Button
                          variant="outline"
                          className="justify-start h-auto p-3"
                          onClick={() => router.push('/tickets?view=personal-open')}
                        >
                          <Users className="mr-3 h-4 w-4 text-blue-600" />
                          <div className="text-left">
                            <div className="font-medium text-sm">My Assignments</div>
                            <div className="text-xs text-muted-foreground">
                              Assigned to you
                            </div>
                          </div>
                        </Button>
                      </>
                    )}

                    <Button
                      variant="outline"
                      className="justify-start h-auto p-3"
                      onClick={() => router.push('/knowledge-base')}
                    >
                      <TrendingUp className="mr-3 h-4 w-4 text-green-600" />
                      <div className="text-left">
                        <div className="font-medium text-sm">Knowledge Base</div>
                        <div className="text-xs text-muted-foreground">
                          Browse articles
                        </div>
                      </div>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* More Recent Tickets */}
              <Card>
                <CardHeader>
                  <CardTitle>More Recent Tickets</CardTitle>
                  <CardDescription>
                    Additional recent active tickets (excluding solved)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="animate-pulse">
                          <div className="h-16 bg-muted rounded"></div>
                        </div>
                      ))}
                    </div>
                  ) : recentTickets.length <= 5 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <Clock className="h-8 w-8 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">No additional tickets</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recentTickets.slice(5).map((ticket) => (
                        <TicketCard
                          key={ticket.id}
                          ticket={ticket}
                          onClick={handleTicketClick}
                          currentUserId={user?.id}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
      </div>

      {/* Virtual Assistant - Available for All Users */}
      {showAssistant && (
        <VirtualAssistant
          isMinimized={assistantMinimized}
          onToggleMinimize={() => setAssistantMinimized(!assistantMinimized)}
          onClose={() => setShowAssistant(false)}
        />
      )}

      {/* Virtual Assistant Trigger Button - Available for All Users */}
      {!showAssistant && (
        <div className="fixed bottom-4 right-4 z-50">
          <Button
            onClick={() => {
              console.log('Assistant button clicked!')
              setShowAssistant(true)
            }}
            className="h-14 w-14 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700"
            title="Open AidIN Virtual Assistant"
          >
            <MessageCircle className="h-6 w-6 text-white" />
          </Button>
        </div>
      )}

    </DashboardLayout>
  )
}