'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Users, Search, Calendar, Mail, Phone, MapPin, Loader2, UserPlus, Trash2, AlertCircle } from 'lucide-react'
import PresenceDirectoryView from '@/components/PresenceDirectoryView'
import ProtectedRoute from '@/components/ProtectedRoute'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuth } from '@/components/AuthProvider'
import { isAdmin as checkIsAdmin } from '@/lib/role-utils'

function StaffDirectoryPage() {
  const { user: currentUser } = useAuth()
  const isAdmin = currentUser ? checkIsAdmin(currentUser) : false

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [presenceModalOpen, setPresenceModalOpen] = useState(false)
  const [addStaffModalOpen, setAddStaffModalOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState(null)
  const [departments, setDepartments] = useState([])

  // New staff form state
  const [newStaff, setNewStaff] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    departmentId: '',
    role: 'Staff',
    title: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchUsers()
    if (isAdmin) {
      fetchDepartments()
    }
  }, [isAdmin])

  useEffect(() => {
  // When the presence modal closes (after saving/deleting), refresh the grid
  if (!presenceModalOpen) {
    fetchUsers()
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [presenceModalOpen])


  async function fetchUsers() {
  setLoading(true)
  try {
    // Make sure server filters relative to the user's local timezone
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const nowIso = new Date().toISOString()

    const res = await fetch(
      `/api/users/with-schedules?tz=${encodeURIComponent(tz)}&from=${encodeURIComponent(nowIso)}`,
      {
        method: 'GET',
        credentials: 'include',         // keep session cookies
        cache: 'no-store',              // avoid stale results
        headers: { 'Accept': 'application/json' },
      }
    )

    // If the specialized endpoint doesn't exist yet, fall back gracefully
    if (!res.ok) {
      console.warn('[Directory] /api/users/with-schedules returned', res.status)
      setUsers([])
      return
    }

    // Some backends return { users: [...] }, others return [...]
    const payload = await res.json()
    const usersArray = Array.isArray(payload) ? payload : (Array.isArray(payload?.users) ? payload.users : [])

    // Defensive normalization of roles
    const staffUsers = usersArray.filter((user) => {
      const roleNames = (user.roles || []).map((r) =>
        typeof r === 'string' ? r : (r?.role?.name || r?.name || '')
      )
      return roleNames.some((role) => ['Admin', 'Manager', 'Staff'].includes(role))
    })

    setUsers(staffUsers)
  } catch (error) {
    console.error('Failed to fetch users:', error)
    setUsers([])
  } finally {
    setLoading(false)
  }
}



  async function fetchDepartments() {
    try {
      const res = await fetch('/api/departments')
      if (res.ok) {
        const data = await res.json()
        // Ensure data is an array
        setDepartments(Array.isArray(data) ? data : [])
      } else {
        console.error('Failed to fetch departments:', res.status)
        setDepartments([])
      }
    } catch (error) {
      console.error('Failed to fetch departments:', error)
      setDepartments([])
    }
  }

  async function handleAddStaff() {
    setSubmitting(true)
    setError('')

    try {
      // Create user
      const userRes = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newStaff.email,
          firstName: newStaff.firstName,
          lastName: newStaff.lastName,
          phone: newStaff.phone,
          departmentId: (newStaff.departmentId && newStaff.departmentId !== 'none') ? newStaff.departmentId : null,
          userType: 'Staff',
          isActive: true,
          title: newStaff.title
        })
      })

      if (!userRes.ok) {
        const errorData = await userRes.json()
        throw new Error(errorData.error || 'Failed to create user')
      }

      const user = await userRes.json()

      // Assign role
      const roleRes = await fetch(`/api/users/${user.id}/roles`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles: [newStaff.role] })
      })

      if (!roleRes.ok) {
        throw new Error('Failed to assign role')
      }

      // Refresh users list
      await fetchUsers()

      // Close modal and reset form
      setAddStaffModalOpen(false)
      setNewStaff({
        email: '',
        firstName: '',
        lastName: '',
        phone: '',
        departmentId: '',
        role: 'Staff',
        title: ''
      })
    } catch (error) {
      setError(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteUser() {
    if (!userToDelete) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/users/${userToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to delete user')
      }

      // Refresh users list
      await fetchUsers()

      // Close dialog
      setDeleteDialogOpen(false)
      setUserToDelete(null)
    } catch (error) {
      setError(error.message)
      alert(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  function openDeleteDialog(user) {
    setUserToDelete(user)
    setDeleteDialogOpen(true)
  }

  const filteredUsers = users.filter(user => {
    const searchLower = searchTerm.toLowerCase()
    const fullName = `${user.firstName} ${user.lastName}`.toLowerCase()
    const email = user.email?.toLowerCase() || ''
    return fullName.includes(searchLower) || email.includes(searchLower)
  })

  const getUserInitials = (user) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    }
    if (user.name) {
      return user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    }
    return user.email?.[0].toUpperCase() || 'U'
  }

  const getUserRoles = (user) => {
    return user.roles?.map(r =>
      typeof r === 'string' ? r : r.role?.name || r.name
    ) || []
  }

  const openPresenceModal = (user) => {
    setSelectedUser(user)
    setPresenceModalOpen(true)
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Users className="h-8 w-8" />
              Staff Directory
            </h1>
            <p className="text-muted-foreground mt-2">
              View staff availability, contact information, and schedules. Click "My Schedule" to manage your own schedule.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* My Schedule Button for All Staff */}
            {currentUser && (
              <Button
                onClick={() => openPresenceModal(currentUser)}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Calendar className="h-4 w-4" />
                My Schedule
              </Button>
            )}
            {/* Add Staff Member Button for Admins */}
            {isAdmin && (
              <Button onClick={() => setAddStaffModalOpen(true)} className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Add Staff Member
              </Button>
            )}
          </div>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Staff Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUsers.map(user => (
            <Card key={user.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start gap-4">
                  <Avatar className="h-16 w-16">
                    {user.avatar && <AvatarImage src={user.avatar} alt={user.name || user.email} />}
                    <AvatarFallback className="text-lg">{getUserInitials(user)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">
                          {user.firstName} {user.lastName}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground truncate">
                          {user.title || 'Staff Member'}
                        </p>
                      </div>
                      {isAdmin && user.id !== currentUser?.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => openDeleteDialog(user)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {getUserRoles(user).map((role, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {role}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Contact Info */}
                {user.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <a
                      href={`mailto:${user.email}`}
                      className="text-blue-600 hover:underline truncate"
                    >
                      {user.email}
                    </a>
                  </div>
                )}

                {user.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <a
                      href={`tel:${user.phone}`}
                      className="text-blue-600 hover:underline"
                    >
                      {user.phone}
                    </a>
                  </div>
                )}

                {user.location && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">{user.location}</span>
                  </div>
                )}

                {/* View Schedule Button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-3"
                  onClick={() => openPresenceModal(user)}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  View Schedule
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredUsers.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {searchTerm ? (
                <>
                  <Search className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No staff members found matching "{searchTerm}"</p>
                </>
              ) : (
                <>
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No staff members found</p>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Presence Modal */}
      <Dialog open={presenceModalOpen} onOpenChange={setPresenceModalOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                {selectedUser?.avatar && (
                  <AvatarImage src={selectedUser.avatar} alt={selectedUser.name || selectedUser.email} />
                )}
                <AvatarFallback>{selectedUser && getUserInitials(selectedUser)}</AvatarFallback>
              </Avatar>
              <div>
                <div className="font-semibold">
                  {selectedUser?.firstName} {selectedUser?.lastName}
                </div>
                <div className="text-sm text-muted-foreground font-normal">
                  Schedule & Availability
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <PresenceDirectoryView
              userId={selectedUser.id}
              canEdit={isAdmin || selectedUser.id === currentUser?.id}
              onScheduleChange={fetchUsers}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Add Staff Modal */}
      <Dialog open={addStaffModalOpen} onOpenChange={setAddStaffModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Staff Member</DialogTitle>
            <DialogDescription>
              Create a new staff account and assign a role
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded p-3 flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={newStaff.email}
                onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                placeholder="staff@example.com"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={newStaff.firstName}
                  onChange={(e) => setNewStaff({ ...newStaff, firstName: e.target.value })}
                  placeholder="John"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={newStaff.lastName}
                  onChange={(e) => setNewStaff({ ...newStaff, lastName: e.target.value })}
                  placeholder="Doe"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={newStaff.phone}
                onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                placeholder="(555) 123-4567"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Job Title</Label>
              <Input
                id="title"
                value={newStaff.title}
                onChange={(e) => setNewStaff({ ...newStaff, title: e.target.value })}
                placeholder="IT Support Specialist"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              <Select value={newStaff.role} onValueChange={(value) => setNewStaff({ ...newStaff, role: value })}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Staff">Staff</SelectItem>
                  <SelectItem value="Manager">Manager</SelectItem>
                  <SelectItem value="Admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Select value={newStaff.departmentId} onValueChange={(value) => setNewStaff({ ...newStaff, departmentId: value })}>
                <SelectTrigger id="department">
                  <SelectValue placeholder="Select department (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddStaffModalOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleAddStaff} disabled={submitting || !newStaff.email || !newStaff.firstName || !newStaff.lastName}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Staff Member'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Staff Member?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {userToDelete?.firstName} {userToDelete?.lastName}? This action cannot be undone.
              All tickets and comments associated with this user will be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={submitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </DashboardLayout>
  )
}

export default function ProtectedStaffDirectory() {
  return (
    <ProtectedRoute>
      <StaffDirectoryPage />
    </ProtectedRoute>
  )
}
