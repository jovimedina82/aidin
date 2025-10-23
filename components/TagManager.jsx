'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table'
import { Input } from './ui/input'
import { Label } from './ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { Badge } from './ui/badge'
import { Loader2, Plus, Pencil, Trash2, Tag as TagIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from './AuthProvider'

const TAG_COLORS = [
  { value: 'gray', label: 'Gray', class: 'bg-gray-100 text-gray-800 border-gray-300' },
  { value: 'red', label: 'Red', class: 'bg-red-100 text-red-800 border-red-300' },
  { value: 'orange', label: 'Orange', class: 'bg-orange-100 text-orange-800 border-orange-300' },
  { value: 'yellow', label: 'Yellow', class: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  { value: 'green', label: 'Green', class: 'bg-green-100 text-green-800 border-green-300' },
  { value: 'blue', label: 'Blue', class: 'bg-blue-100 text-blue-800 border-blue-300' },
  { value: 'purple', label: 'Purple', class: 'bg-purple-100 text-purple-800 border-purple-300' },
  { value: 'pink', label: 'Pink', class: 'bg-pink-100 text-pink-800 border-pink-300' },
]

const TAG_CATEGORIES = [
  'Issue Type',
  'Department',
  'Priority',
  'Status',
  'Other'
]

export default function TagManager() {
  const { makeAuthenticatedRequest } = useAuth()
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTag, setEditingTag] = useState(null)
  const [deletingTag, setDeletingTag] = useState(null)
  const [tagTickets, setTagTickets] = useState([])
  const [loadingTickets, setLoadingTickets] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [color, setColor] = useState('blue')
  const [category, setCategory] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchTags = async () => {
    setLoading(true)
    try {
      const response = await makeAuthenticatedRequest('/api/tags')
      if (response.ok) {
        const data = await response.json()
        setTags(data.tags)
      }
    } catch (error) {
      console.error('Error fetching tags:', error)
      toast.error('Failed to load tags')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTags()
  }, [])

  const handleOpenDialog = (tag = null) => {
    if (tag) {
      setEditingTag(tag)
      setName(tag.name)
      setDisplayName(tag.displayName)
      setColor(tag.color || 'blue')
      setCategory(tag.category || '')
    } else {
      setEditingTag(null)
      setName('')
      setDisplayName('')
      setColor('blue')
      setCategory('')
    }
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingTag(null)
    setName('')
    setDisplayName('')
    setColor('blue')
    setCategory('')
  }

  const handleSubmit = async () => {
    if (!displayName.trim()) {
      toast.error('Display name is required')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        displayName: displayName.trim(),
        color,
        category: category || null
      }

      let response
      if (editingTag) {
        // Update existing tag
        response = await makeAuthenticatedRequest('/api/tags', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, id: editingTag.id })
        })
      } else {
        // Create new tag
        response = await makeAuthenticatedRequest('/api/tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            name: name.trim() || displayName.trim()
          })
        })
      }

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save tag')
      }

      toast.success(editingTag ? 'Tag updated successfully' : 'Tag created successfully')
      handleCloseDialog()
      fetchTags()
    } catch (error) {
      console.error('Error saving tag:', error)
      toast.error(error.message || 'Failed to save tag')
    } finally {
      setSubmitting(false)
    }
  }

  const fetchTagTickets = async (tagId) => {
    setLoadingTickets(true)
    try {
      const response = await makeAuthenticatedRequest(`/api/tickets?tagId=${tagId}`)
      if (response.ok) {
        const data = await response.json()
        console.log('Tag tickets response:', data)
        setTagTickets(data.tickets || [])
      } else {
        console.error('Failed to fetch tickets:', response.status)
        setTagTickets([])
      }
    } catch (error) {
      console.error('Error fetching tag tickets:', error)
      setTagTickets([])
    } finally {
      setLoadingTickets(false)
    }
  }

  const handleDeleteClick = async (tag) => {
    console.log('Delete clicked for tag:', tag)
    setDeletingTag(tag)
    await fetchTagTickets(tag.id)
  }

  const handleConfirmDelete = async () => {
    if (!deletingTag) return

    try {
      const response = await makeAuthenticatedRequest(`/api/tags?id=${deletingTag.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete tag')
      }

      toast.success('Tag deleted successfully')
      setDeletingTag(null)
      setTagTickets([])
      fetchTags()
    } catch (error) {
      console.error('Error deleting tag:', error)
      toast.error(error.message || 'Failed to delete tag')
    }
  }

  const getTagColorClass = (colorValue) => {
    const colorObj = TAG_COLORS.find(c => c.value === colorValue)
    return colorObj?.class || TAG_COLORS[0].class
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TagIcon className="h-5 w-5" />
              Tag Management
            </CardTitle>
            <CardDescription>
              Manage tags for categorizing tickets
            </CardDescription>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            New Tag
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : tags.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <TagIcon className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>No tags found. Create your first tag to get started.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tag</TableHead>
                <TableHead>Internal Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Usage</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tags.map(tag => (
                <TableRow key={tag.id}>
                  <TableCell>
                    <Badge className={getTagColorClass(tag.color)}>
                      {tag.displayName}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm text-muted-foreground">{tag.name}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{tag.category || 'Uncategorized'}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-sm">{tag._count?.tickets || 0} tickets</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleOpenDialog(tag)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-100"
                        onClick={() => handleDeleteClick(tag)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTag ? 'Edit Tag' : 'Create New Tag'}</DialogTitle>
            <DialogDescription>
              {editingTag
                ? 'Update the tag details below'
                : 'Create a new tag to categorize tickets'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {!editingTag && (
              <div className="space-y-2">
                <Label htmlFor="name">Tag Name (Internal) *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., email-management"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Lowercase with hyphens. If left empty, will be auto-generated from display name.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name *</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g., Email Management"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={category || 'none'} onValueChange={(val) => setCategory(val === 'none' ? '' : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {TAG_CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="grid grid-cols-4 gap-2">
                {TAG_COLORS.map(colorOption => (
                  <button
                    key={colorOption.value}
                    type="button"
                    onClick={() => setColor(colorOption.value)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      color === colorOption.value
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-transparent hover:border-muted-foreground/20'
                    }`}
                  >
                    <Badge className={colorOption.class}>
                      {colorOption.label}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseDialog}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                editingTag ? 'Update Tag' : 'Create Tag'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingTag} onOpenChange={() => {
        setDeletingTag(null)
        setTagTickets([])
      }}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tag: {deletingTag?.displayName}</AlertDialogTitle>
            <AlertDialogDescription>
              {loadingTickets ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2">Loading tickets...</span>
                </div>
              ) : tagTickets.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-red-600 font-semibold">
                    Warning: This tag is being used by {tagTickets.length} ticket{tagTickets.length !== 1 ? 's' : ''}.
                  </p>
                  <p>Deleting this tag will remove it from all the following tickets:</p>
                  <div className="max-h-64 overflow-y-auto border rounded-lg p-3 bg-muted/30">
                    <div className="space-y-2">
                      {tagTickets.map(ticket => (
                        <div key={ticket.id} className="flex items-center justify-between p-2 bg-white rounded border text-sm">
                          <div className="flex-1">
                            <span className="font-mono text-xs text-muted-foreground">#{ticket.ticketNumber}</span>
                            <span className="mx-2">-</span>
                            <span>{ticket.title}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(`/tickets/${ticket.id}`, '_blank')}
                            className="h-7 text-xs"
                          >
                            View
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Are you sure you want to delete this tag? This action cannot be undone.
                  </p>
                </div>
              ) : (
                <p>
                  This tag is not currently used by any tickets. Are you sure you want to delete it?
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={loadingTickets}
            >
              {loadingTickets ? 'Loading...' : 'Delete Tag'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
