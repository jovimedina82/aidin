'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../components/AuthProvider'
import DashboardLayout from '../../components/DashboardLayout'
import StaffPresenceBadge from '../../components/StaffPresenceBadge'
import StaffPresenceSelector from '../../components/StaffPresenceSelector'
import OfficeHoursEditor from '../../components/OfficeHoursEditor'
import StaffWeekView from '../../components/StaffWeekView'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Search, Users, RefreshCw, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export default function StaffDirectoryPage() {
  const { user, makeAuthenticatedRequest, loading: authLoading } = useAuth()
  const [presences, setPresences] = useState([])
  const [filteredPresences, setFilteredPresences] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [myPresence, setMyPresence] = useState(null)
  const [selectedStaff, setSelectedStaff] = useState(null)
  const [weekViewOpen, setWeekViewOpen] = useState(false)

  const isStaff = user?.roles?.some(role =>
    ['Admin', 'Manager', 'Staff'].includes(role.role?.name || role.name)
  )

  const fetchPresences = async () => {
    setLoading(true)
    try {
      const response = await makeAuthenticatedRequest('/api/staff-presence')
      if (response.ok) {
        const data = await response.json()
        setPresences(data.presences || [])
        setFilteredPresences(data.presences || [])

        // Find current user's presence
        const currentUserPresence = data.presences?.find(p => p.userId === user?.id)
        setMyPresence(currentUserPresence || null)
      }
    } catch (error) {
      console.error('Error fetching staff presences:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchPresences()
    }
  }, [user])

  useEffect(() => {
    let filtered = presences

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(p =>
        `${p.user.firstName} ${p.user.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.user.jobTitle?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => p.status === statusFilter)
    }

    setFilteredPresences(filtered)
  }, [searchTerm, statusFilter, presences])

  const handlePresenceUpdate = (updatedPresence) => {
    setMyPresence(updatedPresence)
    fetchPresences() // Refresh the list
  }

  const handleStaffClick = (presence) => {
    setSelectedStaff(presence)
    setWeekViewOpen(true)
  }

  const handleCloseWeekView = () => {
    setWeekViewOpen(false)
    setSelectedStaff(null)
  }

  const getInitials = (firstName, lastName) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase()
  }

  const groupByStatus = (presenceList) => {
    const groups = {
      AVAILABLE: [],
      IN_OFFICE: [],
      REMOTE: [],
      VACATION: [],
      SICK: []
    }

    presenceList.forEach(p => {
      if (groups[p.status]) {
        groups[p.status].push(p)
      }
    })

    return groups
  }

  const groupedPresences = groupByStatus(filteredPresences)

  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="container mx-auto px-4 pt-4 pb-8">
          <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading directory...</p>
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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Users className="h-8 w-8" />
              Staff Directory
            </h1>
            <p className="text-muted-foreground">
              View where staff members are located and their availability
            </p>
          </div>
          <div className="flex gap-2">
            {isStaff && (
              <>
                <OfficeHoursEditor
                  triggerButton={
                    <Button variant="outline">
                      <Clock className="mr-2 h-4 w-4" />
                      Office Hours
                    </Button>
                  }
                />
                <StaffPresenceSelector
                  currentPresence={myPresence}
                  onUpdate={handlePresenceUpdate}
                  triggerButton={
                    <Button>
                      Update My Status
                    </Button>
                  }
                />
              </>
            )}
            <Button variant="outline" size="icon" onClick={fetchPresences} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* My Status Card (for staff only) */}
        {isStaff && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">My Current Status</CardTitle>
            </CardHeader>
            <CardContent>
              {myPresence ? (
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={myPresence.user.avatar} alt={`${myPresence.user.firstName} ${myPresence.user.lastName}`} />
                    <AvatarFallback>{getInitials(myPresence.user.firstName, myPresence.user.lastName)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{myPresence.user.firstName} {myPresence.user.lastName}</p>
                    <p className="text-sm text-muted-foreground">{myPresence.user.jobTitle}</p>
                  </div>
                  <StaffPresenceBadge presence={myPresence} showIcon showLocation />
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground mb-3">You haven't set your status yet</p>
                  <StaffPresenceSelector
                    currentPresence={null}
                    onUpdate={handlePresenceUpdate}
                    triggerButton={<Button size="sm">Set Your Status</Button>}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by name, email, or job title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="AVAILABLE">Available</SelectItem>
              <SelectItem value="IN_OFFICE">In Office</SelectItem>
              <SelectItem value="REMOTE">Remote</SelectItem>
              <SelectItem value="VACATION">On Vacation</SelectItem>
              <SelectItem value="SICK">Out Sick</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Staff</CardDescription>
              <CardTitle className="text-2xl">{presences.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Available</CardDescription>
              <CardTitle className="text-2xl text-green-600">{groupedPresences.AVAILABLE.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>In Office</CardDescription>
              <CardTitle className="text-2xl text-blue-600">{groupedPresences.IN_OFFICE.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Remote</CardDescription>
              <CardTitle className="text-2xl text-purple-600">{groupedPresences.REMOTE.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Out of Office</CardDescription>
              <CardTitle className="text-2xl text-orange-600">
                {groupedPresences.VACATION.length + groupedPresences.SICK.length}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Staff List */}
        <Card>
          <CardHeader>
            <CardTitle>All Staff ({filteredPresences.length})</CardTitle>
            <CardDescription>Current availability and location of all staff members</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse flex items-center gap-4">
                    <div className="h-12 w-12 bg-muted rounded-full"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-muted rounded w-1/3 mb-2"></div>
                      <div className="h-3 bg-muted rounded w-1/4"></div>
                    </div>
                    <div className="h-6 w-24 bg-muted rounded"></div>
                  </div>
                ))}
              </div>
            ) : filteredPresences.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground">No staff members found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPresences.map((presence) => (
                  <div
                    key={presence.id}
                    className="flex items-center gap-4 p-3 rounded-lg border hover:bg-accent transition-colors cursor-pointer"
                    onClick={() => handleStaffClick(presence)}
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarImage
                        src={presence.user.avatar}
                        alt={`${presence.user.firstName} ${presence.user.lastName}`}
                      />
                      <AvatarFallback>
                        {getInitials(presence.user.firstName, presence.user.lastName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {presence.user.firstName} {presence.user.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {presence.user.jobTitle || presence.user.email}
                      </p>
                      {presence.user.departments?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {presence.user.departments.map((dept) => (
                            <Badge
                              key={dept.department.name}
                              variant="outline"
                              className="text-xs"
                              style={{ borderColor: dept.department.color }}
                            >
                              {dept.department.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <StaffPresenceBadge presence={presence} showIcon showLocation />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Week View Modal */}
        {selectedStaff && (
          <StaffWeekView
            userId={selectedStaff.userId}
            userName={`${selectedStaff.user.firstName} ${selectedStaff.user.lastName}`}
            userAvatar={selectedStaff.user.avatar}
            isOpen={weekViewOpen}
            onClose={handleCloseWeekView}
          />
        )}
      </div>
    </DashboardLayout>
  )
}
