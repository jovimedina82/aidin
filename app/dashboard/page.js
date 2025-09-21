'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../../components/AuthProvider'
import DashboardLayout from '../../components/DashboardLayout'
import CreateTicketDialog from '../../components/CreateTicketDialog'
import TicketCard from '../../components/TicketCard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Ticket, Clock, CheckCircle, AlertCircle, Users, TrendingUp, Pause } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const { makeAuthenticatedRequest, user } = useAuth()
  const router = useRouter()
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

  // Azure AD token handling is now done in AuthProvider

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      
      // Fetch stats and recent tickets in parallel
      const [statsResponse, ticketsResponse] = await Promise.all([
        makeAuthenticatedRequest('/api/stats'),
        makeAuthenticatedRequest('/api/tickets?limit=8')
      ])

      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        console.log('Stats data received:', statsData)
        setStats({
          total: statsData.total || 0,
          open: statsData.open || 0,
          pending: statsData.pending || 0,
          solved: statsData.solved || 0,
          unassigned: statsData.unassigned || 0,
          onHold: statsData.onHold || 0,
          newTickets: statsData.newTickets || 0,
          closed: statsData.closed || 0
        })
      } else {
        console.error('Stats response not ok:', statsResponse.status, statsResponse.statusText)
      }

      if (ticketsResponse.ok) {
        const ticketsData = await ticketsResponse.json()
        setRecentTickets(ticketsData.tickets || [])
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleTicketCreated = () => {
    fetchDashboardData()
  }

  const handleTicketClick = (ticket) => {
    router.push(`/tickets/${ticket.id}`)
  }

  const isStaff = user?.roles?.some(role => ['Admin', 'Manager', 'Staff'].includes(role))

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

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
                <Ticket className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loading ? '...' : stats.total}</div>
                <p className="text-xs text-muted-foreground">
                  All time tickets
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Open Tickets</CardTitle>
                <Clock className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {loading ? '...' : stats.open}
                </div>
                <p className="text-xs text-muted-foreground">
                  Active tickets
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
                <AlertCircle className="h-4 w-4 text-yellow-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">
                  {loading ? '...' : stats.pending}
                </div>
                <p className="text-xs text-muted-foreground">
                  Waiting for response
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Solved</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {loading ? '...' : stats.solved}
                </div>
                <p className="text-xs text-muted-foreground">
                  Resolved tickets
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">On Hold</CardTitle>
                <Pause className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  {loading ? '...' : stats.onHold}
                </div>
                <p className="text-xs text-muted-foreground">
                  Temporarily paused
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">New</CardTitle>
                <AlertCircle className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {loading ? '...' : stats.newTickets}
                </div>
                <p className="text-xs text-muted-foreground">
                  Just created
                </p>
              </CardContent>
            </Card>
          </div>

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
                  Your most recent support tickets
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
                    <p>No tickets yet</p>
                    <p className="text-sm">Create your first ticket to get started</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentTickets.slice(0, 5).map((ticket) => (
                      <TicketCard
                        key={ticket.id}
                        ticket={ticket}
                        onClick={handleTicketClick}
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
                    Additional recent support tickets
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
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
      </div>
    </DashboardLayout>
  )
}