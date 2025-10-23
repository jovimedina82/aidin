'use client'
import React, { useState, useEffect } from 'react'
import { useAuth } from '../../components/AuthProvider'
import { useStats } from '@/lib/hooks/useStats'
import { useTickets } from '@/lib/hooks/useTickets'
import { useUserPreferences, useUpdateUserPreferences } from '@/lib/hooks/useUserPreferences'
import DashboardLayout from '../../components/DashboardLayout'
import CreateTicketDialog from '../../components/CreateTicketDialog'
import TicketCard from '../../components/TicketCard'
import VirtualAssistant from '../../components/VirtualAssistant'
import DraggableStatCard from '../../components/DraggableStatCard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Ticket, Clock, CheckCircle, AlertCircle, Users, TrendingUp, Pause, MessageCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useSocket } from '@/lib/hooks/useSocket'
import { useQueryClient } from '@tanstack/react-query'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable'
import { toast } from 'sonner'

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { isConnected, isEnabled, on, off } = useSocket()

  // Use React Query hooks instead of manual fetching
  const { data: stats, isLoading: statsLoading } = useStats()
  const { data: ticketsData, isLoading: ticketsLoading } = useTickets({ limit: 8, status: 'NEW' })
  const { data: preferences } = useUserPreferences()
  const updatePreferences = useUpdateUserPreferences()

  const [showAssistant, setShowAssistant] = useState(false)
  const [assistantMinimized, setAssistantMinimized] = useState(false)

  // Default card order
  const defaultCardOrder = ['total', 'open', 'pending', 'solved', 'onHold', 'new']
  const cardOrder = preferences?.dashboardCardOrder || defaultCardOrder

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Socket.IO event handlers - invalidate queries instead of manual refetch
  useEffect(() => {
    if (!isEnabled || !isConnected) return

    const handleTicketEvent = () => {
      // Invalidate queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    }

    const handleStatsUpdate = (data) => {
      // Directly update the stats cache
      queryClient.setQueryData(['stats'], data.stats)
    }

    on('ticket:created', handleTicketEvent)
    on('ticket:updated', handleTicketEvent)
    on('ticket:deleted', handleTicketEvent)
    on('stats:updated', handleStatsUpdate)

    return () => {
      off('ticket:created', handleTicketEvent)
      off('ticket:updated', handleTicketEvent)
      off('ticket:deleted', handleTicketEvent)
      off('stats:updated', handleStatsUpdate)
    }
  }, [isEnabled, isConnected, on, off, queryClient])

  // Handle drag end
  const handleDragEnd = (event) => {
    const { active, over } = event

    if (active.id !== over.id) {
      const oldIndex = cardOrder.indexOf(active.id)
      const newIndex = cardOrder.indexOf(over.id)
      const newOrder = arrayMove(cardOrder, oldIndex, newIndex)

      // Optimistically update and save
      updatePreferences.mutate(
        { dashboardCardOrder: newOrder },
        {
          onSuccess: () => toast.success('Dashboard layout saved'),
          onError: () => toast.error('Failed to save card layout')
        }
      )
    }
  }

  const handleTicketClick = (ticket) => {
    router.push(`/tickets/${ticket.id}`)
  }

  // Handle different role formats
  const getRoleName = (role) => {
    if (typeof role === 'string') return role
    if (role?.role?.name) return role.role.name
    if (role?.name) return role.name
    return null
  }

  const isStaff = user?.roles?.some(role => ['Admin', 'Manager', 'Staff'].includes(getRoleName(role)))

  // Define all stat cards configuration
  const statCardsConfig = {
    total: { id: 'total', title: 'Total Tickets', value: stats?.total || 0, description: 'All time tickets', icon: Ticket, color: '' },
    open: { id: 'open', title: 'Open Tickets', value: stats?.open || 0, description: 'Active tickets', icon: Clock, color: 'text-blue-600' },
    pending: { id: 'pending', title: 'Pending', value: stats?.pending || 0, description: 'Waiting for response', icon: AlertCircle, color: 'text-yellow-600' },
    solved: { id: 'solved', title: 'Solved', value: stats?.solved || 0, description: 'Resolved tickets', icon: CheckCircle, color: 'text-green-600' },
    onHold: { id: 'onHold', title: 'On Hold', value: stats?.onHold || 0, description: 'Temporarily paused', icon: Pause, color: 'text-purple-600' },
    new: { id: 'new', title: 'New', value: stats?.newTickets || 0, description: 'Just created', icon: AlertCircle, color: 'text-orange-600' }
  }

  const recentTickets = ticketsData?.tickets || []
  const loading = statsLoading || ticketsLoading || authLoading

  // Show loading state while auth is checking
  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="container mx-auto px-4 pt-4 pb-8">
          <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading dashboard...</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 pt-4 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Welcome back, {user?.firstName || user?.name?.split(' ')[0] || 'User'}!
            </h1>
            <p className="text-muted-foreground">
              Here's what's happening with your support tickets today.
            </p>
          </div>
          <CreateTicketDialog />
        </div>

        {/* Stats Cards - Draggable */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={cardOrder} strategy={rectSortingStrategy}>
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
                    loading={statsLoading}
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
              <CardDescription>New support tickets awaiting assignment</CardDescription>
            </CardHeader>
            <CardContent>
              {ticketsLoading ? (
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
                <CardDescription>Common tasks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <TooltipProvider delayDuration={500}>
                  <div className="grid gap-3">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" className="justify-start h-auto p-3" onClick={() => router.push('/tickets')}>
                          <Ticket className="mr-3 h-4 w-4" />
                          <div className="text-left">
                            <div className="font-medium text-sm">View All Tickets</div>
                            <div className="text-xs text-muted-foreground">Browse and manage</div>
                          </div>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>View and manage all support tickets in the system</p></TooltipContent>
                    </Tooltip>

                    {isStaff && (
                      <>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="outline" className="justify-start h-auto p-3" onClick={() => router.push('/tickets?view=unassigned')}>
                              <Users className="mr-3 h-4 w-4 text-red-600" />
                              <div className="text-left">
                                <div className="font-medium text-sm">Unassigned ({stats?.unassigned || 0})</div>
                                <div className="text-xs text-muted-foreground">Need assignment</div>
                              </div>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>View tickets that haven't been assigned to any staff member yet</p></TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="outline" className="justify-start h-auto p-3" onClick={() => router.push('/tickets?view=personal-open')}>
                              <Users className="mr-3 h-4 w-4 text-blue-600" />
                              <div className="text-left">
                                <div className="font-medium text-sm">My Assignments</div>
                                <div className="text-xs text-muted-foreground">Assigned to you</div>
                              </div>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>View all tickets currently assigned to you</p></TooltipContent>
                        </Tooltip>
                      </>
                    )}

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" className="justify-start h-auto p-3" onClick={() => router.push('/knowledge-base')}>
                          <TrendingUp className="mr-3 h-4 w-4 text-green-600" />
                          <div className="text-left">
                            <div className="font-medium text-sm">Knowledge Base</div>
                            <div className="text-xs text-muted-foreground">Browse articles</div>
                          </div>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Browse help articles and solutions for common issues</p></TooltipContent>
                    </Tooltip>
                  </div>
                </TooltipProvider>
              </CardContent>
            </Card>

            {/* More Recent Tickets */}
            <Card>
              <CardHeader>
                <CardTitle>More Recent Tickets</CardTitle>
                <CardDescription>Additional recent active tickets (excluding solved)</CardDescription>
              </CardHeader>
              <CardContent>
                {ticketsLoading ? (
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
                      <TicketCard key={ticket.id} ticket={ticket} onClick={handleTicketClick} currentUserId={user?.id} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Virtual Assistant */}
      {showAssistant && (
        <VirtualAssistant
          isMinimized={assistantMinimized}
          onToggleMinimize={() => setAssistantMinimized(!assistantMinimized)}
          onClose={() => setShowAssistant(false)}
        />
      )}

      {!showAssistant && (
        <div className="fixed bottom-4 right-4 z-50">
          <Button
            onClick={() => setShowAssistant(true)}
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
