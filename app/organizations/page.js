'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../components/AuthProvider'
import DashboardLayout from '../../components/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Building2,
  Search,
  Plus,
  Users,
  Ticket,
  Shield,
  Edit,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

export default function OrganizationsPage() {
  const { user, makeAuthenticatedRequest } = useAuth()
  const [organizations, setOrganizations] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedOrg, setSelectedOrg] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    domain: '',
    description: '',
  })

  const userRoleNames = user?.roles?.map(role =>
    typeof role === 'string' ? role : (role.role?.name || role.name)
  ) || []
  const isStaff = userRoleNames.some(role => ['Admin', 'Manager', 'Staff'].includes(role))

  useEffect(() => {
    if (isStaff) {
      fetchOrganizations()
    }
  }, [isStaff])

  const fetchOrganizations = async () => {
    try {
      setLoading(true)
      const response = await makeAuthenticatedRequest('/api/organizations')
      if (response.ok) {
        const data = await response.json()
        setOrganizations(data)
      }
    } catch (error) {
      toast.error('Failed to fetch organizations')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateOrg = async () => {
    try {
      const response = await makeAuthenticatedRequest('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (response.ok) {
        toast.success('Organization created successfully')
        setIsCreateDialogOpen(false)
        setFormData({ name: '', domain: '', description: '' })
        fetchOrganizations()
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to create organization')
      }
    } catch (error) {
      toast.error('Failed to create organization')
    }
  }

  const handleUpdateOrg = async () => {
    if (!selectedOrg) return
    try {
      const response = await makeAuthenticatedRequest(`/api/organizations/${selectedOrg.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (response.ok) {
        toast.success('Organization updated successfully')
        setIsEditDialogOpen(false)
        setSelectedOrg(null)
        setFormData({ name: '', domain: '', description: '' })
        fetchOrganizations()
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to update organization')
      }
    } catch (error) {
      toast.error('Failed to update organization')
    }
  }

  const handleDeleteOrg = async (orgId) => {
    if (!confirm('Are you sure you want to delete this organization?')) return
    try {
      const response = await makeAuthenticatedRequest(`/api/organizations/${orgId}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        toast.success('Organization deleted successfully')
        fetchOrganizations()
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to delete organization')
      }
    } catch (error) {
      toast.error('Failed to delete organization')
    }
  }

  const filteredOrganizations = organizations.filter(org =>
    org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (org.domain && org.domain.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  if (!isStaff) {
    return (
      <DashboardLayout>
        <div className="container mx-auto px-4 pt-4 pb-8">
          <div className="flex items-center justify-center h-64">
            <Card className="w-full max-w-md">
              <CardContent className="p-8 text-center">
                <Shield className="h-12 w-12 mx-auto mb-4 text-red-500" />
                <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
                <p className="text-muted-foreground">
                  You need Staff privileges or higher to access organizations.
                </p>
              </CardContent>
            </Card>
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
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Building2 className="w-8 h-8 text-blue-600" />
              Organizations
            </h1>
            <p className="text-muted-foreground mt-1">Manage company organizations</p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Organization
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Organizations</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{organizations.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {organizations.reduce((sum, org) => sum + (org._count?.users || 0), 0)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
              <Ticket className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {organizations.reduce((sum, org) => sum + (org._count?.tickets || 0), 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="mb-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search organizations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : filteredOrganizations.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-gray-500">
                No organizations found
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Domain</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>Tickets</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrganizations.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell className="font-medium">{org.name}</TableCell>
                      <TableCell>
                        {org.domain ? (
                          <Badge variant="secondary">{org.domain}</Badge>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>{org._count?.users || 0}</TableCell>
                      <TableCell>{org._count?.tickets || 0}</TableCell>
                      <TableCell>
                        {new Date(org.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedOrg(org)
                            setFormData({
                              name: org.name,
                              domain: org.domain || '',
                              description: org.description || '',
                            })
                            setIsEditDialogOpen(true)
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteOrg(org.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Organization</DialogTitle>
              <DialogDescription>
                Create a new organization to group users and tickets.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Organization name"
                />
              </div>
              <div>
                <Label htmlFor="domain">Domain</Label>
                <Input
                  id="domain"
                  value={formData.domain}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                  placeholder="example.com"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateOrg} disabled={!formData.name}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Organization</DialogTitle>
              <DialogDescription>
                Update organization details.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Name *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Organization name"
                />
              </div>
              <div>
                <Label htmlFor="edit-domain">Domain</Label>
                <Input
                  id="edit-domain"
                  value={formData.domain}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                  placeholder="example.com"
                />
              </div>
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateOrg} disabled={!formData.name}>
                Update
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
