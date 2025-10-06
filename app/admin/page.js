'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../../components/AuthProvider'
import SidebarLayout from '../../components/SidebarLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Settings, Users, Plus, Edit, Trash2, Shield, UserX, UserCheck, Building2, Brain, Ticket, Search, Calendar, User, MoreVertical } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import DepartmentManagement from '../../components/DepartmentManagement'
import AIAdministration from '../../components/AIAdministration'

export default function AdminPage() {
  const { user, makeAuthenticatedRequest } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUsers, setSelectedUsers] = useState([])
  const [editingUser, setEditingUser] = useState(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false)
  const [newUser, setNewUser] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    roles: ['Requester'],
    departmentIds: []
  })

  // Azure AD Sync state
  const [azureSyncStatus, setAzureSyncStatus] = useState(null)
  const [azureSyncLoading, setAzureSyncLoading] = useState(false)
  const [azureConnectionStatus, setAzureConnectionStatus] = useState('unknown')

  // Departments state
  const [departments, setDepartments] = useState([])

  // Tickets state
  const [tickets, setTickets] = useState([])
  const [ticketsLoading, setTicketsLoading] = useState(false)
  const [ticketSearchTerm, setTicketSearchTerm] = useState('')
  const [ticketToDelete, setTicketToDelete] = useState(null)
  const [selectedTickets, setSelectedTickets] = useState([])

  // Check admin access
  const isAdmin = user?.roles?.includes('Admin')

  useEffect(() => {
    if (!isAdmin) {
      return
    }
    fetchUsers()
    fetchDepartments()
    fetchTickets()
  }, [isAdmin])

  const fetchUsers = async () => {
    try {
      const response = await makeAuthenticatedRequest('/api/users')
      if (response.ok) {
        const data = await response.json()
        // Handle both array format and object with users property
        const usersArray = Array.isArray(data) ? data : data.users || []
        setUsers(usersArray)
        console.log('Fetched users:', usersArray)
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchDepartments = async () => {
    try {
      const response = await makeAuthenticatedRequest('/api/admin/departments')
      if (response.ok) {
        const data = await response.json()
        setDepartments(data.departments || [])
      }
    } catch (error) {
      console.error('Failed to fetch departments:', error)
    }
  }

  const fetchTickets = async () => {
    try {
      setTicketsLoading(true)
      const oneMonthAgo = new Date()
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)

      const response = await makeAuthenticatedRequest(`/api/tickets?sortBy=createdAt&sortOrder=desc&limit=1000`)
      if (response.ok) {
        const data = await response.json()
        // Filter for tickets from the last month
        const allTickets = data.tickets || []
        const lastMonthTickets = allTickets.filter(ticket =>
          new Date(ticket.createdAt) >= oneMonthAgo
        )
        setTickets(lastMonthTickets)
      }
    } catch (error) {
      console.error('Failed to fetch tickets:', error)
    } finally {
      setTicketsLoading(false)
    }
  }

  // Azure AD Sync functions
  const fetchAzureSyncStatus = async () => {
    try {
      const response = await makeAuthenticatedRequest('/api/azure-sync/status')
      if (response.ok) {
        const data = await response.json()
        setAzureSyncStatus(data)
        if (data.configured && data.enabled && data.syncStatus === 'ready') {
          setAzureConnectionStatus('connected')
        } else if (data.configured) {
          setAzureConnectionStatus('configured')
        } else {
          setAzureConnectionStatus('not_configured')
        }
      }
    } catch (error) {
      console.error('Failed to fetch Azure sync status:', error)
      setAzureConnectionStatus('error')
    }
  }

  const testAzureConnection = async () => {
    setAzureSyncLoading(true)
    try {
      const response = await makeAuthenticatedRequest('/api/azure-sync/test')
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          toast.success('Azure AD connection successful!')
          setAzureConnectionStatus('connected')
        } else {
          toast.error(`Connection failed: ${data.message}`)
          setAzureConnectionStatus('error')
        }
      } else {
        toast.error('Failed to test Azure AD connection')
        setAzureConnectionStatus('error')
      }
    } catch (error) {
      console.error('Test connection error:', error)
      toast.error('Failed to test Azure AD connection')
      setAzureConnectionStatus('error')
    } finally {
      setAzureSyncLoading(false)
    }
  }

  const triggerManualSync = async () => {
    setAzureSyncLoading(true)
    try {
      const response = await makeAuthenticatedRequest('/api/azure-sync/sync', {
        method: 'POST'
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(`Sync completed! Created: ${data.summary.created}, Updated: ${data.summary.updated}, Skipped: ${data.summary.skipped}`)

        // Refresh users list and sync status
        await fetchUsers()
        await fetchAzureSyncStatus()
      } else {
        const errorData = await response.json()
        toast.error(`Sync failed: ${errorData.error}`)
      }
    } catch (error) {
      console.error('Manual sync error:', error)
      toast.error('Failed to perform manual sync')
    } finally {
      setAzureSyncLoading(false)
    }
  }

  // Load Azure sync status on component mount
  useEffect(() => {
    if (isAdmin) {
      fetchAzureSyncStatus()
    }
  }, [isAdmin])

  const handleSelectUser = (userId, checked) => {
    console.log(`User selection changed: ${userId}, checked: ${checked}`)
    if (checked) {
      const newSelection = [...selectedUsers, userId]
      setSelectedUsers(newSelection)
      console.log('Updated selected users:', newSelection)
    } else {
      const newSelection = selectedUsers.filter(id => id !== userId)
      setSelectedUsers(newSelection)
      console.log('Updated selected users:', newSelection)
    }
  }

  const handleSelectAll = (checked) => {
    console.log(`Select all changed: ${checked}`)
    if (checked) {
      const allUserIds = filteredUsers.map(u => u.id)
      setSelectedUsers(allUserIds)
      console.log('Selected all users:', allUserIds)
    } else {
      setSelectedUsers([])
      console.log('Cleared all selections')
    }
  }

  const handleDeleteUser = async (userId) => {
    try {
      console.log('Attempting to delete user:', userId)
      const response = await makeAuthenticatedRequest(`/api/users/${userId}`, {
        method: 'DELETE'
      })

      console.log('Delete response:', response.status, response.statusText)

      if (response.ok) {
        setUsers(users.filter(u => u.id !== userId))
        setSelectedUsers(selectedUsers.filter(id => id !== userId))
        toast.success('User deleted successfully')
        console.log('User deleted successfully')
      } else {
        const error = await response.json()
        console.log('Delete error:', error)
        toast.error(error.error || `Failed to delete user (${response.status})`)
      }
    } catch (error) {
      console.error('Delete user error:', error)
      toast.error(`Failed to delete user: ${error.message}`)
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedUsers.length === 0) {
      toast.error('No users selected')
      return
    }

    try {
      console.log('Attempting to delete selected users:', selectedUsers)

      const results = []
      const deletedUsers = []
      const failedUsers = []

      // Process deletions sequentially to avoid database conflicts
      for (const userId of selectedUsers) {
        try {
          console.log(`Deleting user: ${userId}`)
          const response = await makeAuthenticatedRequest(`/api/users/${userId}`, {
            method: 'DELETE'
          })

          console.log(`Delete response for ${userId}:`, response.status, response.statusText)

          if (response.ok) {
            deletedUsers.push(userId)
            console.log(`Successfully deleted user: ${userId}`)
          } else {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
            failedUsers.push({ userId, error: errorData.error || `HTTP ${response.status}` })
            console.error(`Failed to delete user ${userId}:`, errorData)
          }

          // Add small delay between deletions to prevent overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 100))

        } catch (error) {
          failedUsers.push({ userId, error: error.message })
          console.error(`Exception deleting user ${userId}:`, error)
        }
      }

      console.log(`Bulk delete completed. Success: ${deletedUsers.length}, Failed: ${failedUsers.length}`)

      // Update UI state
      if (deletedUsers.length > 0) {
        // Remove deleted users from the UI
        setUsers(users.filter(u => !deletedUsers.includes(u.id)))

        // Refresh the full user list to ensure consistency
        setTimeout(() => {
          fetchUsers()
        }, 500)
      }

      // Clear selection
      setSelectedUsers([])

      // Show appropriate feedback
      if (failedUsers.length === 0) {
        toast.success(`${deletedUsers.length} users deleted successfully`)
      } else if (deletedUsers.length === 0) {
        toast.error(`Failed to delete all ${failedUsers.length} selected users`)
        console.error('All deletions failed:', failedUsers)
      } else {
        toast.error(`${deletedUsers.length} users deleted, ${failedUsers.length} failed`)
        console.error('Some deletions failed:', failedUsers)
      }

    } catch (error) {
      console.error('Bulk delete error:', error)
      toast.error(`Failed to delete selected users: ${error.message}`)
      setSelectedUsers([])
    }
  }

  const handleEditUser = async (userId, updates) => {
    try {
      const response = await makeAuthenticatedRequest(`/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      })

      if (response.ok) {
        const updatedUser = await response.json()
        setUsers(users.map(u => u.id === userId ? { ...u, ...updatedUser } : u))
        setIsEditDialogOpen(false)
        setEditingUser(null)
        toast.success('User updated successfully')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to update user')
      }
    } catch (error) {
      toast.error('Failed to update user')
    }
  }

  const handleCreateUser = async () => {
    try {
      console.log('Creating new user:', newUser)

      // Validate required fields
      if (!newUser.firstName || !newUser.lastName || !newUser.email || !newUser.password) {
        toast.error('Please fill in all required fields')
        return
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(newUser.email)) {
        toast.error('Please enter a valid email address')
        return
      }

      // Validate password length
      if (newUser.password.length < 6) {
        toast.error('Password must be at least 6 characters long')
        return
      }

      const response = await makeAuthenticatedRequest('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          email: newUser.email,
          password: newUser.password,
          phone: newUser.phone || null,
          roles: newUser.roles,
          departmentIds: newUser.departmentIds
        })
      })

      if (response.ok) {
        const createdUser = await response.json()
        console.log('User created successfully:', createdUser)

        // Refresh the users list
        fetchUsers()

        // Reset form and close dialog
        setNewUser({
          firstName: '',
          lastName: '',
          email: '',
          password: '',
          phone: '',
          roles: ['Requester'],
          departmentIds: []
        })
        setIsAddUserDialogOpen(false)

        toast.success('User created successfully')
      } else {
        const error = await response.json()
        console.log('Create user error:', error)
        toast.error(error.error || `Failed to create user (${response.status})`)
      }
    } catch (error) {
      console.error('Create user error:', error)
      toast.error(`Failed to create user: ${error.message}`)
    }
  }

  const updateUserRoles = async (userId, roles) => {
    try {
      const response = await makeAuthenticatedRequest(`/api/users/${userId}/roles`, {
        method: 'PUT',
        body: JSON.stringify({ roles })
      })

      if (response.ok) {
        toast.success('User roles updated successfully')
        fetchUsers()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to update user roles')
      }
    } catch (error) {
      toast.error('Failed to update user roles')
    }
  }

  const filteredUsers = users.filter(user =>
    user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredTickets = tickets.filter(ticket =>
    ticket.title?.toLowerCase().includes(ticketSearchTerm.toLowerCase()) ||
    ticket.ticketNumber?.toLowerCase().includes(ticketSearchTerm.toLowerCase()) ||
    ticket.description?.toLowerCase().includes(ticketSearchTerm.toLowerCase()) ||
    (ticket.requester?.firstName + ' ' + ticket.requester?.lastName)?.toLowerCase().includes(ticketSearchTerm.toLowerCase()) ||
    (ticket.assignee?.firstName + ' ' + ticket.assignee?.lastName)?.toLowerCase().includes(ticketSearchTerm.toLowerCase())
  )

  const handleDeleteTicket = async (ticketId) => {
    try {
      console.log('Attempting to delete ticket:', ticketId)
      const response = await makeAuthenticatedRequest(`/api/tickets/${ticketId}`, {
        method: 'DELETE'
      })

      console.log('Delete response:', response.status, response.statusText)

      if (response.ok) {
        setTickets(tickets.filter(t => t.id !== ticketId))
        toast.success('Ticket deleted successfully')
        console.log('Ticket deleted successfully')
      } else {
        const error = await response.json()
        console.log('Delete error:', error)
        toast.error(error.error || `Failed to delete ticket (${response.status})`)
      }
    } catch (error) {
      console.error('Delete ticket error:', error)
      toast.error(`Failed to delete ticket: ${error.message}`)
    }
    setTicketToDelete(null)
  }

  const handleSelectTicket = (ticketId, checked) => {
    if (checked) {
      setSelectedTickets([...selectedTickets, ticketId])
    } else {
      setSelectedTickets(selectedTickets.filter(id => id !== ticketId))
    }
  }

  const handleSelectAllTickets = (checked) => {
    if (checked) {
      const allTicketIds = filteredTickets.map(t => t.id)
      setSelectedTickets(allTicketIds)
    } else {
      setSelectedTickets([])
    }
  }

  const handleBulkDeleteTickets = async () => {
    if (selectedTickets.length === 0) {
      toast.error('No tickets selected')
      return
    }

    try {
      console.log('Attempting to delete selected tickets:', selectedTickets)

      const results = []
      const deletedTickets = []
      const failedTickets = []

      // Process deletions sequentially to avoid database conflicts
      for (const ticketId of selectedTickets) {
        try {
          console.log(`Deleting ticket: ${ticketId}`)
          const response = await makeAuthenticatedRequest(`/api/tickets/${ticketId}`, {
            method: 'DELETE'
          })

          console.log(`Delete response for ${ticketId}:`, response.status, response.statusText)

          if (response.ok) {
            deletedTickets.push(ticketId)
            console.log(`Successfully deleted ticket: ${ticketId}`)
          } else {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
            failedTickets.push({ ticketId, error: errorData.error || `HTTP ${response.status}` })
            console.error(`Failed to delete ticket ${ticketId}:`, errorData)
          }

          // Add small delay between deletions to prevent overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 100))

        } catch (error) {
          failedTickets.push({ ticketId, error: error.message })
          console.error(`Exception deleting ticket ${ticketId}:`, error)
        }
      }

      console.log(`Bulk delete completed. Success: ${deletedTickets.length}, Failed: ${failedTickets.length}`)

      // Update UI state
      if (deletedTickets.length > 0) {
        // Remove deleted tickets from the UI
        setTickets(tickets.filter(t => !deletedTickets.includes(t.id)))

        // Refresh the full ticket list to ensure consistency
        setTimeout(() => {
          fetchTickets()
        }, 500)
      }

      // Clear selection
      setSelectedTickets([])

      // Show appropriate feedback
      if (failedTickets.length === 0) {
        toast.success(`${deletedTickets.length} tickets deleted successfully`)
      } else if (deletedTickets.length === 0) {
        toast.error(`Failed to delete all ${failedTickets.length} selected tickets`)
        console.error('All deletions failed:', failedTickets)
      } else {
        toast.error(`${deletedTickets.length} tickets deleted, ${failedTickets.length} failed`)
        console.error('Some deletions failed:', failedTickets)
      }

    } catch (error) {
      console.error('Bulk delete error:', error)
      toast.error(`Failed to delete selected tickets: ${error.message}`)
      setSelectedTickets([])
    }
  }

  const getStatusBadge = (status) => {
    const statusConfig = {
      NEW: { label: 'New', className: 'bg-red-100 text-red-800 border-red-200' },
      OPEN: { label: 'Open', className: 'bg-blue-100 text-blue-800 border-blue-200' },
      PENDING: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      ON_HOLD: { label: 'On Hold', className: 'bg-orange-100 text-orange-800 border-orange-200' },
      SOLVED: { label: 'Solved', className: 'bg-green-100 text-green-800 border-green-200' }
    }
    const config = statusConfig[status] || statusConfig.NEW
    return (
      <Badge variant="outline" className={config.className}>
        {config.label}
      </Badge>
    )
  }

  if (!isAdmin) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center h-full">
          <Card className="w-full max-w-md">
            <CardContent className="p-8 text-center">
              <Shield className="h-12 w-12 mx-auto mb-4 text-red-500" />
              <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
              <p className="text-muted-foreground">
                You need Admin privileges to access this page.
              </p>
            </CardContent>
          </Card>
        </div>
      </SidebarLayout>
    )
  }

  return (
    <SidebarLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Settings className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Admin Settings</h1>
          </div>
          <p className="text-muted-foreground">
            Manage users, roles, and system configuration
          </p>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="users">User Management</TabsTrigger>
            <TabsTrigger value="tickets">All Tickets</TabsTrigger>
            <TabsTrigger value="departments">Departments</TabsTrigger>
            <TabsTrigger value="ai-admin">AI Administration</TabsTrigger>
            <TabsTrigger value="azure-sync">Azure AD Sync</TabsTrigger>
            <TabsTrigger value="settings">System Settings</TabsTrigger>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      User Management
                    </CardTitle>
                    <CardDescription>
                      Manage user accounts and role assignments
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedUsers.length > 0 && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Selected ({selectedUsers.length})
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Users</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete {selectedUsers.length} selected users? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteSelected} className="bg-red-600 hover:bg-red-700">
                              Delete Users
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    <Button onClick={() => setIsAddUserDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add User
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-6">
                  <Input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-sm"
                  />
                  <span className="text-sm text-muted-foreground">
                    {filteredUsers.length} users
                  </span>
                </div>

                {loading ? (
                  <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-12 bg-muted rounded"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                            onCheckedChange={handleSelectAll}
                          />
                        </TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Roles</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedUsers.includes(user.id)}
                              onCheckedChange={(checked) => handleSelectUser(user.id, checked)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {user.firstName} {user.lastName}
                          </TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex flex-wrap gap-1 min-h-[20px]">
                                {user.departments?.length > 0 ? (
                                  user.departments.map((userDept) => (
                                    <Badge key={userDept.department.id} variant="secondary" className="text-xs">
                                      {userDept.department.name}
                                      <button
                                        onClick={() => {
                                          const currentDeptIds = user.departments.map(d => d.department.id)
                                          const newDeptIds = currentDeptIds.filter(id => id !== userDept.department.id)
                                          handleEditUser(user.id, { departmentIds: newDeptIds })
                                        }}
                                        className="ml-1 text-red-500 hover:text-red-700"
                                      >
                                        ×
                                      </button>
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-gray-400 text-xs">No departments</span>
                                )}
                              </div>
                              <Select
                                value=""
                                onValueChange={(departmentId) => {
                                  if (departmentId && departmentId !== "0") {
                                    const currentDeptIds = user.departments?.map(d => d.department.id) || []
                                    if (!currentDeptIds.includes(departmentId)) {
                                      handleEditUser(user.id, { departmentIds: [...currentDeptIds, departmentId] })
                                    }
                                  }
                                }}
                              >
                                <SelectTrigger className="w-36 h-6 text-xs">
                                  <SelectValue placeholder="+ Add dept" />
                                </SelectTrigger>
                                <SelectContent>
                                  {departments.filter(dept =>
                                    !user.departments?.some(userDept => userDept.department.id === dept.id)
                                  ).map((dept) => (
                                    <SelectItem key={dept.id} value={dept.id.toString()}>
                                      {dept.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {user.roles?.map((roleAssignment) => (
                                <Badge key={roleAssignment.role.name} variant="outline">
                                  {roleAssignment.role.name}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.isActive ? "default" : "secondary"}>
                              {user.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingUser(user)
                                  setIsEditDialogOpen(true)
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Select
                                onValueChange={(role) => {
                                  const currentRoles = user.roles?.map(r => r.role.name) || []
                                  const newRoles = currentRoles.includes(role)
                                    ? currentRoles.filter(r => r !== role)
                                    : [...currentRoles, role]
                                  updateUserRoles(user.id, newRoles)
                                }}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue placeholder="Add role" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Admin">Admin</SelectItem>
                                  <SelectItem value="Manager">Manager</SelectItem>
                                  <SelectItem value="Staff">Staff</SelectItem>
                                  <SelectItem value="Requester">Requester</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  handleEditUser(user.id, { isActive: !user.isActive })
                                }}
                              >
                                {user.isActive ? (
                                  <UserX className="h-4 w-4 text-orange-500" />
                                ) : (
                                  <UserCheck className="h-4 w-4 text-green-500" />
                                )}
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete User</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete {user.firstName} {user.lastName}? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteUser(user.id)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      Delete User
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tickets" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Ticket className="h-5 w-5" />
                      All Tickets
                    </CardTitle>
                    <CardDescription>
                      All tickets from the last month with all statuses
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-6">
                  <div className="flex items-center space-x-2">
                    <Search className="w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search tickets..."
                      value={ticketSearchTerm}
                      onChange={(e) => setTicketSearchTerm(e.target.value)}
                      className="max-w-sm"
                    />
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {filteredTickets.length} tickets
                  </span>
                  {selectedTickets.length > 0 && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Selected ({selectedTickets.length})
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Tickets</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete {selectedTickets.length} selected tickets? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleBulkDeleteTickets} className="bg-red-600 hover:bg-red-700">
                            Delete Tickets
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>

                {/* Select All Checkbox for tickets */}
                {filteredTickets.length > 0 && (
                  <div className="flex items-center space-x-2 mb-4 p-2 bg-gray-50 rounded">
                    <Checkbox
                      checked={selectedTickets.length === filteredTickets.length && filteredTickets.length > 0}
                      onCheckedChange={handleSelectAllTickets}
                    />
                    <span className="text-sm text-gray-600">
                      Select all ({filteredTickets.length} tickets)
                    </span>
                  </div>
                )}

                {ticketsLoading ? (
                  <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-16 bg-muted rounded"></div>
                      </div>
                    ))}
                  </div>
                ) : filteredTickets.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No tickets found from the last month
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredTickets.map((ticket) => (
                      <div key={ticket.id} className="border rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            <Checkbox
                              checked={selectedTickets.includes(ticket.id)}
                              onCheckedChange={(checked) => handleSelectTicket(ticket.id, checked)}
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                {getStatusBadge(ticket.status)}
                                <span className="text-sm font-mono text-gray-500">#{ticket.ticketNumber}</span>
                              </div>

                              <h4 className="font-medium text-gray-900 mb-2">
                                {ticket.title}
                              </h4>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                <div className="flex items-center space-x-2">
                                  <User className="w-4 h-4 text-gray-400" />
                                  <span className="text-gray-600">Requester:</span>
                                  <span className="text-gray-900">
                                    {ticket.requester?.firstName} {ticket.requester?.lastName}
                                  </span>
                                </div>

                                <div className="flex items-center space-x-2">
                                  <User className="w-4 h-4 text-gray-400" />
                                  <span className="text-gray-600">Assignee:</span>
                                  <span className="text-gray-900">
                                    {ticket.assignee ? `${ticket.assignee.firstName} ${ticket.assignee.lastName}` : 'Unassigned'}
                                  </span>
                                </div>

                                <div className="flex items-center space-x-2">
                                  <Calendar className="w-4 h-4 text-gray-400" />
                                  <span className="text-gray-600">Created:</span>
                                  <span className="text-gray-900">
                                    {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}
                                  </span>
                                </div>
                              </div>

                              {ticket.category && (
                                <div className="mt-2">
                                  <Badge variant="secondary" className="text-xs">
                                    {ticket.category}
                                  </Badge>
                                </div>
                              )}
                            </div>

                            <div className="ml-4">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => window.open(`/tickets/${ticket.id}`, '_blank')}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    View Ticket
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => setTicketToDelete(ticket)}
                                    className="text-red-600 focus:text-red-600"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete Ticket
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="departments" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Department Management
                </CardTitle>
                <CardDescription>
                  Manage departments, their settings, and organizational structure
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DepartmentManagement makeAuthenticatedRequest={makeAuthenticatedRequest} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai-admin" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  AI Administration
                </CardTitle>
                <CardDescription>
                  Manage AI system settings, keywords, and knowledge base
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AIAdministration makeAuthenticatedRequest={makeAuthenticatedRequest} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>System Configuration</CardTitle>
                <CardDescription>
                  Configure system-wide settings and preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Organization Name</label>
                      <Input value="Surterre Properties" />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Support Email</label>
                      <Input value="helpdesk@surterreproperties.com" />
                    </div>
                  </div>
                  <Button>Save Changes</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="azure-sync" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Azure AD Synchronization
                </CardTitle>
                <CardDescription>
                  Synchronize users from Microsoft Entra ID (Azure AD) group: <strong>IT-Helpdesk</strong>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Sync Status */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{azureSyncStatus?.userCount || 0}</div>
                        <p className="text-sm text-muted-foreground">Azure AD Users</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold">
                          {azureSyncStatus?.lastSync ? 'Connected' : 'Not Configured'}
                        </div>
                        <p className="text-sm text-muted-foreground">Connection Status</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold">
                          {azureSyncStatus?.syncInterval || '30 minutes'}
                        </div>
                        <p className="text-sm text-muted-foreground">Sync Interval</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Last Sync Information */}
                  {azureSyncStatus?.lastSync && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Last Synchronization</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <strong>Performed By:</strong> {azureSyncStatus.lastSync.performedBy}
                          </div>
                          <div>
                            <strong>Date:</strong> {new Date(azureSyncStatus.lastSync.timestamp).toLocaleString()}
                          </div>
                          <div>
                            <strong>Users Created:</strong> {azureSyncStatus.lastSync.changes?.created || 0}
                          </div>
                          <div>
                            <strong>Users Updated:</strong> {azureSyncStatus.lastSync.changes?.updated || 0}
                          </div>
                          <div>
                            <strong>Users Skipped:</strong> {azureSyncStatus.lastSync.changes?.skipped || 0}
                          </div>
                          <div>
                            <strong>Errors:</strong> {azureSyncStatus.lastSync.changes?.errors || 0}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-4">
                    <Button
                      onClick={testAzureConnection}
                      disabled={azureSyncLoading}
                      variant="outline"
                    >
                      {azureSyncLoading ? 'Testing...' : 'Test Connection'}
                    </Button>
                    <Button
                      onClick={triggerManualSync}
                      disabled={azureSyncLoading}
                    >
                      {azureSyncLoading ? 'Syncing...' : 'Sync Now'}
                    </Button>
                    <Badge
                      variant={azureConnectionStatus === 'connected' ? 'default' :
                              azureConnectionStatus === 'error' ? 'destructive' : 'secondary'}
                    >
                      {azureConnectionStatus === 'connected' ? '✅ Connected' :
                       azureConnectionStatus === 'error' ? '❌ Connection Error' :
                       azureConnectionStatus === 'configured' ? '⚙️ Configured' : '⚠️ Not Configured'}
                    </Badge>
                  </div>

                  {/* Configuration Info */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Configuration</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div><strong>Azure AD Group:</strong> IT-Helpdesk</div>
                        <div><strong>Default Role:</strong> Requester</div>
                        <div><strong>Automatic Sync:</strong> Every 30 minutes</div>
                        <div><strong>SSO Enabled:</strong> Yes</div>
                        <div className="text-muted-foreground mt-4">
                          All users from the "IT-Helpdesk" group in Azure AD will be automatically
                          created as Requester users. System administrators can manually upgrade
                          user roles to Staff or Admin as needed.
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Email Integration</CardTitle>
                <CardDescription>
                  Configure email intake and notifications
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">SMTP Host</label>
                    <Input value="smtp.office365.com" disabled />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">SMTP Port</label>
                      <Input value="587" disabled />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Username</label>
                      <Input value="helpdesk@surterreproperties.com" disabled />
                    </div>
                  </div>
                  <Badge variant="outline" className="text-green-600">
                    ✓ Email intake configured
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Add User Dialog */}
        <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>
                Create a new user account with the specified roles and permissions
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">First Name *</label>
                  <Input
                    placeholder="First name"
                    value={newUser.firstName}
                    onChange={(e) => setNewUser({...newUser, firstName: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Last Name *</label>
                  <Input
                    placeholder="Last name"
                    value={newUser.lastName}
                    onChange={(e) => setNewUser({...newUser, lastName: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Email Address *</label>
                <Input
                  type="email"
                  placeholder="user@example.com"
                  value={newUser.email}
                  onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Password *</label>
                <Input
                  type="password"
                  placeholder="Minimum 6 characters"
                  value={newUser.password}
                  onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Phone (Optional)</label>
                <Input
                  placeholder="Phone number"
                  value={newUser.phone}
                  onChange={(e) => setNewUser({...newUser, phone: e.target.value})}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Departments (Optional)</label>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1 min-h-[20px] p-2 border rounded">
                    {newUser.departmentIds?.length > 0 ? (
                      newUser.departmentIds.map((deptId) => {
                        const dept = departments.find(d => d.id === deptId)
                        return dept ? (
                          <Badge key={deptId} variant="secondary" className="text-xs">
                            {dept.name}
                            <button
                              onClick={() => {
                                const newDeptIds = newUser.departmentIds.filter(id => id !== deptId)
                                setNewUser({...newUser, departmentIds: newDeptIds})
                              }}
                              className="ml-1 text-red-500 hover:text-red-700"
                            >
                              ×
                            </button>
                          </Badge>
                        ) : null
                      })
                    ) : (
                      <span className="text-gray-400 text-sm">No departments selected</span>
                    )}
                  </div>
                  <Select
                    value=""
                    onValueChange={(departmentId) => {
                      if (departmentId) {
                        const currentIds = newUser.departmentIds || []
                        if (!currentIds.includes(departmentId)) {
                          setNewUser({...newUser, departmentIds: [...currentIds, departmentId]})
                        }
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="+ Add department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.filter(dept =>
                        !newUser.departmentIds?.includes(dept.id)
                      ).map((dept) => (
                        <SelectItem key={dept.id} value={dept.id.toString()}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Roles</label>
                <div className="space-y-2 mt-2">
                  {['Admin', 'Staff', 'Requester'].map((role) => (
                    <div key={role} className="flex items-center space-x-2">
                      <Checkbox
                        checked={newUser.roles.includes(role)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setNewUser({...newUser, roles: [...newUser.roles, role]})
                          } else {
                            setNewUser({...newUser, roles: newUser.roles.filter(r => r !== role)})
                          }
                        }}
                      />
                      <label className="text-sm">{role}</label>
                      {role === 'Admin' && (
                        <Badge variant="destructive" className="text-xs">Full Access</Badge>
                      )}
                      {role === 'Staff' && (
                        <Badge variant="default" className="text-xs">Ticket Management</Badge>
                      )}
                      {role === 'Requester' && (
                        <Badge variant="outline" className="text-xs">Basic Access</Badge>
                      )}
                    </div>
                  ))}
                </div>
                {newUser.roles.length === 0 && (
                  <p className="text-sm text-red-500 mt-1">At least one role must be selected</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsAddUserDialogOpen(false)
                setNewUser({
                  firstName: '',
                  lastName: '',
                  email: '',
                  password: '',
                  phone: '',
                  roles: ['Requester']
                })
              }}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateUser}
                disabled={!newUser.firstName || !newUser.lastName || !newUser.email || !newUser.password || newUser.roles.length === 0}
              >
                Create User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit User Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                Update user information and settings
              </DialogDescription>
            </DialogHeader>
            {editingUser && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">First Name</label>
                    <Input
                      defaultValue={editingUser.firstName}
                      onChange={(e) => setEditingUser({...editingUser, firstName: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Last Name</label>
                    <Input
                      defaultValue={editingUser.lastName}
                      onChange={(e) => setEditingUser({...editingUser, lastName: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    type="email"
                    defaultValue={editingUser.email}
                    onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Phone</label>
                  <Input
                    defaultValue={editingUser.phone || ''}
                    onChange={(e) => setEditingUser({...editingUser, phone: e.target.value})}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => {
                if (editingUser) {
                  handleEditUser(editingUser.id, {
                    firstName: editingUser.firstName,
                    lastName: editingUser.lastName,
                    email: editingUser.email,
                    phone: editingUser.phone
                  })
                }
              }}>
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Ticket Confirmation Dialog */}
        <AlertDialog open={!!ticketToDelete} onOpenChange={() => setTicketToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Ticket</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete ticket #{ticketToDelete?.ticketNumber} "{ticketToDelete?.title}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleDeleteTicket(ticketToDelete?.id)}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete Ticket
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </SidebarLayout>
  )
}