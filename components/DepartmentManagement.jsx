'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
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
  DialogTrigger,
} from '@/components/ui/dialog'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Building2, Plus, Edit, Trash2, Eye, EyeOff, Users, MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'

export default function DepartmentManagement({ makeAuthenticatedRequest }) {
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDepartments, setSelectedDepartments] = useState([])

  // Add Department Dialog
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newDepartment, setNewDepartment] = useState({
    name: '',
    description: '',
    color: 'blue',
    isActive: true,
  })

  // Edit Department Dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState(null)
  const [editDepartment, setEditDepartment] = useState({
    name: '',
    description: '',
    color: 'blue',
    isActive: true,
  })

  const colorOptions = [
    { value: 'blue', name: 'Blue', class: 'bg-blue-500' },
    { value: 'green', name: 'Green', class: 'bg-green-500' },
    { value: 'red', name: 'Red', class: 'bg-red-500' },
    { value: 'yellow', name: 'Yellow', class: 'bg-yellow-500' },
    { value: 'purple', name: 'Purple', class: 'bg-purple-500' },
    { value: 'pink', name: 'Pink', class: 'bg-pink-500' },
    { value: 'indigo', name: 'Indigo', class: 'bg-indigo-500' },
    { value: 'teal', name: 'Teal', class: 'bg-teal-500' },
    { value: 'orange', name: 'Orange', class: 'bg-orange-500' },
    { value: 'gray', name: 'Gray', class: 'bg-gray-500' },
  ]

  const getColorClass = (color) => {
    const colorOption = colorOptions.find((opt) => opt.value === color)
    return colorOption ? colorOption.class : 'bg-blue-500'
  }

  useEffect(() => {
    fetchDepartments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchDepartments = async () => {
    try {
      setLoading(true)
      const response = await makeAuthenticatedRequest('/api/admin/departments')
      if (response.ok) {
        const data = await response.json()
        setDepartments(data.departments || [])
      } else {
        toast.error('Failed to fetch departments')
      }
    } catch (error) {
      console.error('Error fetching departments:', error)
      toast.error('Failed to fetch departments')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateDepartment = async () => {
    try {
      if (!newDepartment.name.trim()) {
        toast.error('Department name is required')
        return
      }

      const response = await makeAuthenticatedRequest('/api/admin/departments', {
        method: 'POST',
        body: JSON.stringify(newDepartment),
      })

      if (response.ok) {
        const created = await response.json()
        setDepartments([...departments, created])
        setNewDepartment({ name: '', description: '', color: 'blue', isActive: true })
        setIsAddDialogOpen(false)
        toast.success('Department created')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to create department')
      }
    } catch (error) {
      console.error('Error creating department:', error)
      toast.error('Failed to create department')
    }
  }

  const handleUpdateDepartment = async () => {
    try {
      if (!editingDepartment) return
      if (!editDepartment.name.trim()) {
        toast.error('Department name is required')
        return
      }

      const response = await makeAuthenticatedRequest(
        `/api/admin/departments/${editingDepartment.id}`,
        {
          method: 'PUT',
          body: JSON.stringify(editDepartment),
        }
      )

      if (response.ok) {
        const updated = await response.json()
        setDepartments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))
        setIsEditDialogOpen(false)
        setEditingDepartment(null)
        toast.success('Department updated')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to update department')
      }
    } catch (error) {
      console.error('Error updating department:', error)
      toast.error('Failed to update department')
    }
  }

  const handleDeleteDepartment = async (departmentId) => {
    try {
      const response = await makeAuthenticatedRequest(`/api/admin/departments/${departmentId}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        setDepartments((prev) => prev.filter((d) => d.id !== departmentId))
        setSelectedDepartments((prev) => prev.filter((id) => id !== departmentId))
        toast.success('Department deleted')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to delete department')
      }
    } catch (error) {
      console.error('Error deleting department:', error)
      toast.error('Failed to delete department')
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedDepartments.length === 0) {
      toast.error('No departments selected')
      return
    }

    try {
      let deleted = 0
      let failed = 0

      for (const id of selectedDepartments) {
        try {
          const res = await makeAuthenticatedRequest(`/api/admin/departments/${id}`, {
            method: 'DELETE',
          })
          if (res.ok) deleted++
          else failed++
        } catch {
          failed++
        }
      }

      await fetchDepartments()
      setSelectedDepartments([])

      if (failed === 0) toast.success(`${deleted} deleted`)
      else toast.error(`${deleted} deleted, ${failed} failed`)
    } catch (error) {
      console.error('Error deleting selected departments:', error)
      toast.error('Failed to delete selected departments')
    }
  }

  const startEditDepartment = (department) => {
    setEditingDepartment(department)
    setEditDepartment({
      name: department.name,
      description: department.description || '',
      color: department.color,
      isActive: department.isActive,
    })
    setIsEditDialogOpen(true)
  }

  const toggleDepartmentStatus = async (department) => {
    try {
      const response = await makeAuthenticatedRequest(`/api/admin/departments/${department.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...department, isActive: !department.isActive }),
      })

      if (response.ok) {
        const updated = await response.json()
        setDepartments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))
        toast.success(`Department ${updated.isActive ? 'activated' : 'deactivated'}`)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to update status')
      }
    } catch (error) {
      console.error('Error updating department status:', error)
      toast.error('Failed to update status')
    }
  }

  const handleSelectDepartment = (deptId, checked) => {
    const isChecked = checked === true
    setSelectedDepartments((prev) =>
      isChecked ? [...prev, deptId] : prev.filter((id) => id !== deptId)
    )
  }

  const handleSelectAll = (checked) => {
    const isChecked = checked === true
    if (isChecked) setSelectedDepartments(filteredDepartments.map((d) => d.id))
    else setSelectedDepartments([])
  }

  const filteredDepartments = departments.filter((d) => {
    const q = searchTerm.toLowerCase()
    return d.name?.toLowerCase().includes(q) || d.description?.toLowerCase().includes(q)
  })

  return (
    <div className="space-y-6 p-1 sm:p-2">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Input
            placeholder="Search departments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-[280px]"
          />
          <span className="text-sm text-muted-foreground">
            {filteredDepartments.length} result{filteredDepartments.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {selectedDepartments.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="secondary">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete selected ({selectedDepartments.length})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Departments</AlertDialogTitle>
                  <AlertDialogDescription>
                    Delete {selectedDepartments.length} department
                    {selectedDepartments.length !== 1 ? 's' : ''}? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteSelected}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Department
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Department</DialogTitle>
                <DialogDescription>
                  Create a new department to organize users and tickets.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Department Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Information Technology"
                    value={newDepartment.name}
                    onChange={(e) =>
                      setNewDepartment({ ...newDepartment, name: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Brief description of the department"
                    value={newDepartment.description}
                    onChange={(e) =>
                      setNewDepartment({ ...newDepartment, description: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label>Color Theme</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {colorOptions.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        className={`h-8 w-8 rounded-full ${color.class} ${
                          newDepartment.color === color.value
                            ? 'ring-2 ring-offset-2 ring-gray-900'
                            : ''
                        }`}
                        onClick={() =>
                          setNewDepartment({ ...newDepartment, color: color.value })
                        }
                        title={color.name}
                        aria-label={color.name}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="active"
                    checked={newDepartment.isActive}
                    onCheckedChange={(checked) =>
                      setNewDepartment({ ...newDepartment, isActive: checked === true })
                    }
                  />
                  <Label htmlFor="active">Active</Label>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateDepartment}>Create Department</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Table / Results */}
      <div className="rounded-lg border bg-card">
        {loading ? (
          <div className="p-4">
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-12 rounded bg-muted" />
                </div>
              ))}
            </div>
          </div>
        ) : filteredDepartments.length === 0 ? (
          <div className="p-10 text-center">
            <Building2 className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">No departments found</h3>
            <p className="mb-4 text-muted-foreground">
              {searchTerm
                ? 'No departments match your search.'
                : 'Get started by creating your first department.'}
            </p>
            {!searchTerm && (
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Department
              </Button>
            )}
          </div>
        ) : (
          <Table className="[&_th]:text-muted-foreground [&_td]:align-middle">
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      selectedDepartments.length === filteredDepartments.length &&
                      filteredDepartments.length > 0
                    }
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-36">Color</TableHead>
                <TableHead className="w-24 text-center">Users</TableHead>
                <TableHead className="w-28 text-center">Status</TableHead>
                <TableHead className="w-20 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredDepartments.map((d) => (
                <TableRow key={d.id} className="hover:bg-muted/40">
                  <TableCell>
                    <Checkbox
                      checked={selectedDepartments.includes(d.id)}
                      onCheckedChange={(checked) => handleSelectDepartment(d.id, checked)}
                    />
                  </TableCell>

                  <TableCell className="font-medium">{d.name}</TableCell>

                  <TableCell>
                    <p className="max-w-md text-sm text-muted-foreground line-clamp-2">
                      {d.description || <span className="italic">No description</span>}
                    </p>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className={`h-3 w-3 rounded-full ${getColorClass(d.color)}`} />
                      <span className="text-sm capitalize">{d.color}</span>
                    </div>
                  </TableCell>

                  <TableCell className="text-center">
                    <div className="inline-flex items-center gap-1">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="tabular-nums">{d._count?.users || 0}</span>
                    </div>
                  </TableCell>

                  <TableCell className="text-center">
                    <Badge
                      variant={d.isActive ? 'default' : 'secondary'}
                      className="px-2 py-0.5"
                    >
                      {d.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-right">
                    <ActionsMenu
                      active={d.isActive}
                      onEdit={() => startEditDepartment(d)}
                      onToggle={() => toggleDepartmentStatus(d)}
                      onDelete={() => handleDeleteDepartment(d.id)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Edit Department Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Department</DialogTitle>
            <DialogDescription>Update department information and settings.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Department Name *</Label>
              <Input
                id="edit-name"
                value={editDepartment.name}
                onChange={(e) =>
                  setEditDepartment({ ...editDepartment, name: e.target.value })
                }
              />
            </div>

            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editDepartment.description}
                onChange={(e) =>
                  setEditDepartment({ ...editDepartment, description: e.target.value })
                }
              />
            </div>

            <div>
              <Label>Color Theme</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    className={`h-8 w-8 rounded-full ${color.class} ${
                      editDepartment.color === color.value
                        ? 'ring-2 ring-offset-2 ring-gray-900'
                        : ''
                    }`}
                    onClick={() =>
                      setEditDepartment({ ...editDepartment, color: color.value })
                    }
                    title={color.name}
                    aria-label={color.name}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-active"
                checked={editDepartment.isActive}
                onCheckedChange={(checked) =>
                  setEditDepartment({ ...editDepartment, isActive: checked === true })
                }
              />
              <Label htmlFor="edit-active">Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateDepartment}>Update Department</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* Compact actions dropdown for each row */
function ActionsMenu({ onEdit, onToggle, active, onDelete }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Open actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={onEdit}>
          <Edit className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onToggle}>
          {active ? (
            <>
              <EyeOff className="mr-2 h-4 w-4 text-orange-600" />
              Deactivate
            </>
          ) : (
            <>
              <Eye className="mr-2 h-4 w-4 text-green-600" />
              Activate
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDelete} className="text-red-600 focus:text-red-700">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
