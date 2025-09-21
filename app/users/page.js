'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../../components/AuthProvider'
import ProtectedRoute from '../../components/ProtectedRoute'
import Navbar from '../../components/Navbar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Building2,
  Plus,
  MoreVertical,
  Mail,
  Phone,
  Calendar,
  Edit,
  Trash2,
  Shield,
  UserX,
  UserCheck,
  AlertTriangle
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import HierarchicalOrgChart from '../../components/HierarchicalOrgChart'

export default function UsersPage() {
  const { makeAuthenticatedRequest, user } = useAuth()
  const router = useRouter()
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
    userType: 'Client', // Default to Client
    departmentIds: []
  })
  const [deletionInfo, setDeletionInfo] = useState(null)
  const [isManagerReassignmentOpen, setIsManagerReassignmentOpen] = useState(false)
  const [selectedNewManager, setSelectedNewManager] = useState('')
  const [orgChartData, setOrgChartData] = useState(null)
  const [orgChartLoading, setOrgChartLoading] = useState(false)

  // Departments state
  const [departments, setDepartments] = useState([])
  const [departmentsLoading, setDepartmentsLoading] = useState(false)
  const [isAddDepartmentDialogOpen, setIsAddDepartmentDialogOpen] = useState(false)
  const [isEditDepartmentDialogOpen, setIsEditDepartmentDialogOpen] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState(null)
  const [newDepartment, setNewDepartment] = useState({
    name: '',
    description: '',
    color: 'gray',
    isActive: true
  })

  // Role-based permissions
  const isAdmin = user?.roles?.includes('Admin')
  const isManager = user?.roles?.includes('Manager')
  const isStaff = user?.roles?.includes('Staff') || isManager || isAdmin

  useEffect(() => {
    if (isStaff) {
      fetchUsers()
    }
  }, [isStaff])

  const fetchUsers = async () => {
    try {
      setLoading(true)
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

  // Check if user can be modified (agents cannot modify admins or managers without permission)
  const canModifyUser = (targetUser) => {
    if (isAdmin) return true // Admins can modify anyone
    if (isManager) {
      // Managers can modify everyone except Admins
      const targetRoles = Array.isArray(targetUser.roles) && typeof targetUser.roles[0] === 'string'
        ? targetUser.roles
        : targetUser.roles?.map(role => role.role?.name || role.name) || []
      return !targetRoles.includes('Admin')
    }

    const targetRoles = Array.isArray(targetUser.roles) && typeof targetUser.roles[0] === 'string'
      ? targetUser.roles
      : targetUser.roles?.map(role => role.role?.name || role.name) || []

    // Staffs cannot modify admin or manager users
    if (targetRoles.includes('Admin') || targetRoles.includes('Manager')) return false

    return true
  }

  // Check if user can be deleted (agents and managers have limited delete permissions)
  const canDeleteUser = (targetUser) => {
    if (isAdmin) return true // Admins can delete anyone

    const targetRoles = Array.isArray(targetUser.roles) && typeof targetUser.roles[0] === 'string'
      ? targetUser.roles
      : targetUser.roles?.map(role => role.role?.name || role.name) || []

    if (isManager) {
      // Managers can delete everyone except Admins
      return !targetRoles.includes('Admin')
    }

    // Staffs cannot delete admin, manager, or other agent users
    if (targetRoles.includes('Admin') || targetRoles.includes('Manager') || targetRoles.includes('Staff')) return false

    return true // Can delete regular users
  }

  const handleDeleteUser = async (userId) => {
    const targetUser = users.find(u => u.id === userId)
    if (!canDeleteUser(targetUser)) {
      toast.error('You need admin permission to delete this user')
      return
    }

    try {
      // First check if user has direct reports
      console.log('Checking deletion requirements for user:', userId)
      const checkResponse = await makeAuthenticatedRequest(`/api/users/${userId}/check-deletion`)

      if (!checkResponse.ok) {
        const error = await checkResponse.json()
        toast.error(error.error || 'Failed to check deletion requirements')
        return
      }

      const checkData = await checkResponse.json()

      if (checkData.requiresManagerReassignment) {
        // Show manager reassignment modal
        setDeletionInfo(checkData)
        setIsManagerReassignmentOpen(true)
        return
      }

      // No direct reports, proceed with deletion
      await performUserDeletion(userId)

    } catch (error) {
      console.error('Delete user error:', error)
      toast.error(`Failed to delete user: ${error.message}`)
    }
  }

  const performUserDeletion = async (userId, newManagerId = null) => {
    try {
      console.log('Performing user deletion:', userId, 'New manager:', newManagerId)

      const deleteData = newManagerId ? { newManagerId } : {}

      const response = await makeAuthenticatedRequest(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(deleteData)
      })

      console.log('Delete response:', response.status, response.statusText)

      if (response.ok) {
        const result = await response.json()
        setUsers(users.filter(u => u.id !== userId))
        setSelectedUsers(selectedUsers.filter(id => id !== userId))

        const message = result.reassignedReports > 0
          ? `User deleted successfully. ${result.reassignedReports} direct reports reassigned.`
          : 'User deleted successfully'

        toast.success(message)
        console.log('User deleted successfully')

        // Close modal if open
        setIsManagerReassignmentOpen(false)
        setDeletionInfo(null)
        setSelectedNewManager('')
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

  const handleManagerReassignment = () => {
    if (!selectedNewManager) {
      toast.error('Please select a new manager')
      return
    }

    performUserDeletion(deletionInfo.user.id, selectedNewManager)
  }

  const handleDeleteSelected = async () => {
    if (selectedUsers.length === 0) {
      toast.error('No users selected')
      return
    }

    try {
      console.log('Attempting to bulk delete selected users:', selectedUsers)

      const response = await makeAuthenticatedRequest('/api/users/bulk-delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userIds: selectedUsers })
      })

      const result = await response.json()

      if (response.ok) {
        // Clear selection
        setSelectedUsers([])

        // Refresh the user list
        await fetchUsers()

        // Show success message with details
        if (result.unassignedTickets > 0) {
          toast.success(`Successfully deleted ${result.deletedCount} users and unassigned ${result.unassignedTickets} tickets`)
        } else {
          toast.success(`Successfully deleted ${result.deletedCount} users`)
        }
      } else {
        toast.error(result.error || 'Failed to delete users')
      }

    } catch (error) {
      console.error('Error in bulk delete:', error)
      toast.error('Failed to delete users')
      // Clear selection even on error
      setSelectedUsers([])
    }
  }

  // Available color options for departments
  const availableColors = [
    { name: 'blue', classes: 'bg-blue-100 text-blue-800 border-blue-200' },
    { name: 'green', classes: 'bg-green-100 text-green-800 border-green-200' },
    { name: 'yellow', classes: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    { name: 'purple', classes: 'bg-purple-100 text-purple-800 border-purple-200' },
    { name: 'pink', classes: 'bg-pink-100 text-pink-800 border-pink-200' },
    { name: 'orange', classes: 'bg-orange-100 text-orange-800 border-orange-200' },
    { name: 'indigo', classes: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
    { name: 'red', classes: 'bg-red-100 text-red-800 border-red-200' },
    { name: 'cyan', classes: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
    { name: 'emerald', classes: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    { name: 'gray', classes: 'bg-gray-100 text-gray-800 border-gray-200' }
  ]

  // Function to get department color classes from color name
  const getDepartmentColor = (colorName) => {
    const color = availableColors.find(c => c.name === colorName)
    return color ? color.classes : 'bg-gray-100 text-gray-800 border-gray-200'
  }

  // Function to get available colors (excluding already used ones)
  const getAvailableColors = (excludeCurrentColor = null) => {
    const usedColors = departments.map(dept => dept.color).filter(color => color !== excludeCurrentColor)
    return availableColors.filter(color => !usedColors.includes(color.name)).map(color => color.name)
  }

  const handleEditUser = async (userId, updates) => {
    const targetUser = users.find(u => u.id === userId)
    if (!canModifyUser(targetUser)) {
      toast.error('You cannot modify this user')
      return
    }

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

      // Validate employee department requirement
      if (newUser.userType === 'Employee' && newUser.departmentIds.length === 0) {
        toast.error('At least one department is required for employees')
        return
      }

      // Permission checks for user creation
      if (!isAdmin && newUser.roles.includes('Admin')) {
        toast.error('Only admins can create admin users')
        return
      }

      if (!isAdmin && !isManager && newUser.roles.includes('Manager')) {
        toast.error('Only admins and managers can create manager users')
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
          departmentIds: newUser.userType === 'Employee' ? newUser.departmentIds : []
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
          userType: 'Client',
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
    const targetUser = users.find(u => u.id === userId)
    if (!canModifyUser(targetUser)) {
      toast.error('You cannot modify this user')
      return
    }

    // Staffs cannot assign admin roles
    if (!isAdmin && roles.includes('Admin')) {
      toast.error('You cannot assign admin roles')
      return
    }

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

  const filteredUsers = users.filter(u => {
    const matchesSearch = !searchTerm || 
      u.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    
    return matchesSearch
  })

  const getRoleBadges = (userRoles) => {
    if (!userRoles || userRoles.length === 0) return <Badge variant="outline">User</Badge>

    const roleNames = Array.isArray(userRoles) && typeof userRoles[0] === 'string'
      ? userRoles
      : userRoles.map(role => role.role?.name || role.name || 'User')

    return roleNames.map((roleName, index) => (
      <Badge key={index} variant={roleName === 'Admin' ? 'destructive' : roleName === 'Manager' ? 'secondary' : roleName === 'Staff' ? 'default' : 'outline'}>
        {roleName}
      </Badge>
    ))
  }

  // Departments functions
  const fetchDepartments = async () => {
    if (!isAdmin) return

    try {
      setDepartmentsLoading(true)
      const response = await makeAuthenticatedRequest('/api/departments')

      if (response.ok) {
        const data = await response.json()
        setDepartments(data.departments || [])
      }
    } catch (error) {
      console.error('Failed to fetch departments:', error)
    } finally {
      setDepartmentsLoading(false)
    }
  }

  const handleCreateDepartment = async () => {
    try {
      if (!newDepartment.name.trim()) {
        alert('Department name is required')
        return
      }

      // Automatically assign the first available color
      const availableColors = getAvailableColors()
      const autoColor = availableColors.length > 0 ? availableColors[0] : 'gray'

      const departmentData = {
        ...newDepartment,
        color: autoColor
      }

      const response = await makeAuthenticatedRequest('/api/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(departmentData)
      })

      if (response.ok) {
        setIsAddDepartmentDialogOpen(false)
        setNewDepartment({ name: '', description: '', isActive: true })
        fetchDepartments()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to create department')
      }
    } catch (error) {
      console.error('Failed to create department:', error)
      alert('Failed to create department')
    }
  }

  const handleEditDepartment = async () => {
    try {
      if (!editingDepartment.name.trim()) {
        alert('Department name is required')
        return
      }

      const response = await makeAuthenticatedRequest(`/api/departments/${editingDepartment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingDepartment.name,
          description: editingDepartment.description,
          color: editingDepartment.color,
          isActive: editingDepartment.isActive
        })
      })

      if (response.ok) {
        setIsEditDepartmentDialogOpen(false)
        setEditingDepartment(null)
        fetchDepartments()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to update department')
      }
    } catch (error) {
      console.error('Failed to update department:', error)
      alert('Failed to update department')
    }
  }

  const handleDeleteDepartment = async (departmentId) => {
    if (!confirm('Are you sure you want to delete this department?')) return

    try {
      const response = await makeAuthenticatedRequest(`/api/departments/${departmentId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchDepartments()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to delete department')
      }
    } catch (error) {
      console.error('Failed to delete department:', error)
      alert('Failed to delete department')
    }
  }

  // Fetch org chart data
  const fetchOrgChart = async () => {
    try {
      setOrgChartLoading(true)
      const response = await makeAuthenticatedRequest('/api/org-chart')

      if (response.ok) {
        const data = await response.json()
        setOrgChartData(data)
      } else {
        console.error('Failed to fetch org chart:', response.statusText)
        toast.error('Failed to load organizational chart')
      }
    } catch (error) {
      console.error('Error fetching org chart:', error)
      toast.error('Failed to load organizational chart')
    } finally {
      setOrgChartLoading(false)
    }
  }

  // Fetch departments when component mounts (for admins only)
  useEffect(() => {
    if (isAdmin) {
      fetchDepartments()
    }
  }, [isAdmin])

  // Fetch org chart data when component mounts
  useEffect(() => {
    if (isStaff) {
      fetchOrgChart()
    }
  }, [isStaff])

  if (!isStaff) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-background">
          <Navbar />
          <main className="container mx-auto px-4 py-8 pt-28">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
              <p className="text-muted-foreground">You don't have permission to manage users.</p>
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
        <main className="container mx-auto px-4 py-8 pt-28">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Users className="w-8 h-8 text-blue-600" />
                User Management
              </h1>
              <p className="text-muted-foreground mt-1">
                {isAdmin ? "Manage all users and permissions" : "Manage users and basic permissions"}
              </p>
              {!isAdmin && (
                <p className="text-orange-600 text-sm mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  Staff Mode: Limited permissions - Cannot modify Admin users or delete Staffs
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {selectedUsers.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Selected ({selectedUsers.length})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Users</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete {selectedUsers.length} selected users? This action cannot be undone.
                        {!isAdmin && " Note: Admin users and Staffs cannot be deleted."}
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
              <Button onClick={() => {
                setIsAddUserDialogOpen(true)
                fetchDepartments()
              }}>
                <UserPlus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            </div>
          </div>

          {/* Tabs for Users, Org Chart, and Departments */}
          <Tabs defaultValue="users" className="w-full">
            <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Users
              </TabsTrigger>
              <TabsTrigger value="org-chart" className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Org Chart
              </TabsTrigger>
              {isAdmin && (
                <TabsTrigger value="departments" className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Departments
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="users" className="mt-6">
              {/* Users Table */}
              <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center justify-between">
                  <span>All Users ({filteredUsers.length})</span>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                    <span className="text-sm text-muted-foreground">Select All</span>
                  </div>
                </CardTitle>
              </div>
              <div className="flex items-center gap-4 mt-4">
                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button variant="outline">
                  <Filter className="w-4 h-4 mr-2" />
                  Filter
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="flex items-center space-x-4 p-4">
                        <div className="w-4 h-4 bg-gray-200 rounded"></div>
                        <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                        <div className="flex-1">
                          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                          <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No users found</p>
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
                    {filteredUsers.map((u) => {
                      const canModify = canModifyUser(u)
                      const canDelete = canDeleteUser(u)
                      
                      return (
                        <TableRow key={u.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedUsers.includes(u.id)}
                              onCheckedChange={(checked) => handleSelectUser(u.id, checked)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <span className="text-blue-600 font-medium text-sm">
                                  {u.firstName?.[0]}{u.lastName?.[0]}
                                </span>
                              </div>
                              <span>{u.firstName} {u.lastName}</span>
                            </div>
                          </TableCell>
                          <TableCell>{u.email}</TableCell>
                          <TableCell>
                            {u.departments && u.departments.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {u.departments.map((userDept, index) => (
                                  <Badge
                                    key={index}
                                    className={`${getDepartmentColor(userDept.department.color)} border`}
                                  >
                                    {userDept.department.name}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-500 text-sm">Client</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {getRoleBadges(u.roles)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={u.isActive ? "default" : "secondary"}>
                              {u.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                disabled={!canModify}
                                onClick={() => {
                                  // Initialize user with current department IDs and user type
                                  const departmentIds = u.departments?.map(dept => dept.department?.id || dept.departmentId) || []
                                  const userType = departmentIds.length > 0 ? 'Employee' : 'Client'

                                  setEditingUser({
                                    ...u,
                                    userType: userType,
                                    departmentIds: departmentIds
                                  })
                                  setIsEditDialogOpen(true)
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Select
                                disabled={!canModify}
                                onValueChange={(role) => {
                                  const currentRoles = Array.isArray(u.roles) && typeof u.roles[0] === 'string' 
                                    ? u.roles 
                                    : u.roles?.map(role => role.role?.name || role.name) || []
                                  
                                  const newRoles = currentRoles.includes(role) 
                                    ? currentRoles.filter(r => r !== role)
                                    : [...currentRoles, role]
                                  updateUserRoles(u.id, newRoles)
                                }}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue placeholder="Add role" />
                                </SelectTrigger>
                                <SelectContent>
                                  {isAdmin && <SelectItem value="Admin">Admin</SelectItem>}
                                  {(isAdmin || isManager) && <SelectItem value="Manager">Manager</SelectItem>}
                                  <SelectItem value="Staff">Staff</SelectItem>
                                  <SelectItem value="Requester">Requester</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                disabled={!canModify}
                                onClick={() => {
                                  handleEditUser(u.id, { isActive: !u.isActive })
                                }}
                              >
                                {u.isActive ? (
                                  <UserX className="h-4 w-4 text-orange-500" />
                                ) : (
                                  <UserCheck className="h-4 w-4 text-green-500" />
                                )}
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" disabled={!canDelete}>
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete User</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete {u.firstName} {u.lastName}? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => handleDeleteUser(u.id)}
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
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Add User Dialog */}
          <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
                <DialogDescription>
                  Create a new user account with specified roles and permissions
                  {!isAdmin && " (Staff mode: Cannot create Admin users)"}
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
                  <label className="text-sm font-medium">User Type *</label>
                  <Select
                    value={newUser.userType}
                    onValueChange={(value) => {
                      setNewUser({
                        ...newUser,
                        userType: value,
                        departmentId: value === 'Client' ? '' : newUser.departmentId
                      })
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select user type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Client">Client</SelectItem>
                      <SelectItem value="Employee">Employee</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {newUser.userType === 'Employee' && (
                  <div>
                    <label className="text-sm font-medium">Departments *</label>
                    <div className="space-y-2 mt-2 border rounded-md p-3 bg-gray-50">
                      {departments.length === 0 ? (
                        <p className="text-sm text-gray-500">No departments available</p>
                      ) : (
                        departments.map((dept) => (
                          <div key={dept.id} className="flex items-center space-x-2">
                            <Checkbox
                              checked={newUser.departmentIds.includes(dept.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setNewUser({
                                    ...newUser,
                                    departmentIds: [...newUser.departmentIds, dept.id]
                                  })
                                } else {
                                  setNewUser({
                                    ...newUser,
                                    departmentIds: newUser.departmentIds.filter(id => id !== dept.id)
                                  })
                                }
                              }}
                            />
                            <label className="text-sm">{dept.name}</label>
                            {dept.description && (
                              <span className="text-xs text-gray-500">- {dept.description}</span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                    {newUser.departmentIds.length > 0 && (
                      <p className="text-xs text-gray-600 mt-1">
                        Selected: {newUser.departmentIds.length} department{newUser.departmentIds.length > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium">Roles</label>
                  <div className="space-y-2 mt-2">
                    {['Staff', 'Requester'].map((role) => (
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
                        {role === 'Staff' && (
                          <Badge variant="default" className="text-xs">Ticket Management</Badge>
                        )}
                        {role === 'Requester' && (
                          <Badge variant="outline" className="text-xs">Basic Access</Badge>
                        )}
                      </div>
                    ))}
                    {isAdmin && (
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          checked={newUser.roles.includes('Admin')}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setNewUser({...newUser, roles: [...newUser.roles, 'Admin']})
                            } else {
                              setNewUser({...newUser, roles: newUser.roles.filter(r => r !== 'Admin')})
                            }
                          }}
                        />
                        <label className="text-sm">Admin</label>
                        <Badge variant="destructive" className="text-xs">Full Access</Badge>
                      </div>
                    )}
                    {(isAdmin || isManager) && (
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          checked={newUser.roles.includes('Manager')}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setNewUser({...newUser, roles: [...newUser.roles, 'Manager']})
                            } else {
                              setNewUser({...newUser, roles: newUser.roles.filter(r => r !== 'Manager')})
                            }
                          }}
                        />
                        <label className="text-sm">Manager</label>
                        <Badge variant="secondary" className="text-xs">Management Access</Badge>
                      </div>
                    )}
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
                    roles: ['Requester'],
                    userType: 'Client',
                    departmentIds: []
                  })
                }}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateUser}
                  disabled={!newUser.firstName || !newUser.lastName || !newUser.email || !newUser.password || newUser.roles.length === 0 || (newUser.userType === 'Employee' && newUser.departmentIds.length === 0)}
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

                  {/* User Type Selection */}
                  <div>
                    <label className="text-sm font-medium">User Type</label>
                    <Select
                      value={editingUser.userType || 'Client'}
                      onValueChange={(value) => setEditingUser({...editingUser, userType: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select user type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Client">Client</SelectItem>
                        <SelectItem value="Employee">Employee</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Department Selection - Only show for Employees */}
                  {editingUser.userType === 'Employee' && (
                    <div>
                      <label className="text-sm font-medium">Departments</label>
                      <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-3">
                        {departments.map((dept) => (
                          <div key={dept.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`edit-dept-${dept.id}`}
                              checked={editingUser.departmentIds?.includes(dept.id) || false}
                              onCheckedChange={(checked) => {
                                const currentDepts = editingUser.departmentIds || []
                                if (checked) {
                                  setEditingUser({
                                    ...editingUser,
                                    departmentIds: [...currentDepts, dept.id]
                                  })
                                } else {
                                  setEditingUser({
                                    ...editingUser,
                                    departmentIds: currentDepts.filter(id => id !== dept.id)
                                  })
                                }
                              }}
                            />
                            <label
                              htmlFor={`edit-dept-${dept.id}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {dept.name}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
                      phone: editingUser.phone,
                      userType: editingUser.userType || 'Client',
                      departmentIds: editingUser.userType === 'Employee' ? (editingUser.departmentIds || []) : []
                    })
                  }
                }}>
                  Save Changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

            </TabsContent>

            {/* Departments Tab */}
            {isAdmin && (
              <TabsContent value="departments" className="mt-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Departments ({departments.length})</CardTitle>
                      <Button onClick={() => setIsAddDepartmentDialogOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Department
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {departmentsLoading ? (
                      <div className="text-center py-8">Loading departments...</div>
                    ) : departments.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No departments found. Create your first department to get started.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Users</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {departments.map((department) => (
                            <TableRow key={department.id}>
                              <TableCell className="font-medium">
                                <Badge className={`${getDepartmentColor(department.color)} border`}>
                                  {department.name}
                                </Badge>
                              </TableCell>
                              <TableCell>{department.description || '-'}</TableCell>
                              <TableCell>{department.users?.length || 0}</TableCell>
                              <TableCell>
                                <Badge variant={department.isActive ? 'default' : 'secondary'}>
                                  {department.isActive ? 'Active' : 'Inactive'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setEditingDepartment(department)
                                      setIsEditDepartmentDialogOpen(true)
                                    }}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleDeleteDepartment(department.id)}
                                    disabled={department.users?.length > 0}
                                    title={department.users?.length > 0 ? 'Cannot delete department with users' : 'Delete department'}
                                  >
                                    Delete
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                {/* Add Department Dialog */}
                <Dialog open={isAddDepartmentDialogOpen} onOpenChange={setIsAddDepartmentDialogOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Department</DialogTitle>
                      <DialogDescription>
                        Create a new department to organize your users.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium">Department Name *</label>
                        <Input
                          value={newDepartment.name}
                          onChange={(e) => setNewDepartment({...newDepartment, name: e.target.value})}
                          placeholder="Enter department name"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Description</label>
                        <Input
                          value={newDepartment.description}
                          onChange={(e) => setNewDepartment({...newDepartment, description: e.target.value})}
                          placeholder="Enter department description (optional)"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="active"
                          checked={newDepartment.isActive}
                          onCheckedChange={(checked) => setNewDepartment({...newDepartment, isActive: checked})}
                        />
                        <label htmlFor="active" className="text-sm">Active department</label>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => {
                        setIsAddDepartmentDialogOpen(false)
                        setNewDepartment({ name: '', description: '', isActive: true })
                      }}>
                        Cancel
                      </Button>
                      <Button
                        onClick={handleCreateDepartment}
                        disabled={!newDepartment.name.trim()}
                      >
                        Create Department
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Edit Department Dialog */}
                <Dialog open={isEditDepartmentDialogOpen} onOpenChange={setIsEditDepartmentDialogOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit Department</DialogTitle>
                      <DialogDescription>
                        Update department information.
                      </DialogDescription>
                    </DialogHeader>
                    {editingDepartment && (
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium">Department Name *</label>
                          <Input
                            value={editingDepartment.name}
                            onChange={(e) => setEditingDepartment({...editingDepartment, name: e.target.value})}
                            placeholder="Enter department name"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Description</label>
                          <Input
                            value={editingDepartment.description || ''}
                            onChange={(e) => setEditingDepartment({...editingDepartment, description: e.target.value})}
                            placeholder="Enter department description (optional)"
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="edit-active"
                            checked={editingDepartment.isActive}
                            onCheckedChange={(checked) => setEditingDepartment({...editingDepartment, isActive: checked})}
                          />
                          <label htmlFor="edit-active" className="text-sm">Active department</label>
                        </div>
                      </div>
                    )}
                    <DialogFooter>
                      <Button variant="outline" onClick={() => {
                        setIsEditDepartmentDialogOpen(false)
                        setEditingDepartment(null)
                      }}>
                        Cancel
                      </Button>
                      <Button
                        onClick={handleEditDepartment}
                        disabled={!editingDepartment?.name?.trim()}
                      >
                        Save Changes
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </TabsContent>
            )}

            {/* Organizational Chart Tab */}
            <TabsContent value="org-chart" className="mt-6">
              <HierarchicalOrgChart data={orgChartData} />
            </TabsContent>

          </Tabs>

          {/* Manager Reassignment Modal */}
          <Dialog open={isManagerReassignmentOpen} onOpenChange={setIsManagerReassignmentOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  Manager Reassignment Required
                </DialogTitle>
                <DialogDescription>
                  {deletionInfo && (
                    <>
                      <strong>{deletionInfo.user.firstName} {deletionInfo.user.lastName}</strong> has direct reports.
                      You must reassign their employees before deletion.
                    </>
                  )}
                </DialogDescription>
              </DialogHeader>

              {deletionInfo && (
                <div className="space-y-4">
                  {/* Show direct reports */}
                  <div>
                    <h4 className="text-sm font-medium mb-2">Direct Reports ({deletionInfo.directReports.length}):</h4>
                    <div className="bg-muted rounded-md p-3 space-y-2">
                      {deletionInfo.directReports.map(report => (
                        <div key={report.id} className="flex items-center gap-2 text-sm">
                          <UserCheck className="h-4 w-4" />
                          {report.firstName} {report.lastName}
                          <Badge variant="outline" className="text-xs">
                            {report.userType}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Manager selection */}
                  <div>
                    <label className="text-sm font-medium">Assign new manager:</label>
                    <Select value={selectedNewManager} onValueChange={setSelectedNewManager}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select new manager" />
                      </SelectTrigger>
                      <SelectContent>
                        {deletionInfo.currentManager && (
                          <SelectItem value={deletionInfo.currentManager.id}>
                            {deletionInfo.currentManager.firstName} {deletionInfo.currentManager.lastName} (Current Supervisor)
                          </SelectItem>
                        )}
                        {deletionInfo.potentialManagers.map(manager => (
                          <SelectItem key={manager.id} value={manager.id}>
                            {manager.firstName} {manager.lastName}
                            <span className="text-xs text-muted-foreground ml-2">
                              ({manager.roles.join(', ')})
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Choose who will become the new manager for the direct reports above.
                    </p>
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsManagerReassignmentOpen(false)
                    setDeletionInfo(null)
                    setSelectedNewManager('')
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleManagerReassignment}
                  disabled={!selectedNewManager}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Reassign & Delete User
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

        </main>
      </div>
    </ProtectedRoute>
  )
}