'use client'

import { useState, useEffect } from 'react'
import { Badge } from './ui/badge'
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
import { Input } from './ui/input'
import { ScrollArea } from './ui/scroll-area'
import { Loader2, Plus, X, Tag as TagIcon, Check } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from './AuthProvider'

const TAG_COLORS = {
  'gray': 'bg-gray-100 text-gray-800 border-gray-300',
  'red': 'bg-red-100 text-red-800 border-red-300',
  'orange': 'bg-orange-100 text-orange-800 border-orange-300',
  'yellow': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'green': 'bg-green-100 text-green-800 border-green-300',
  'blue': 'bg-blue-100 text-blue-800 border-blue-300',
  'purple': 'bg-purple-100 text-purple-800 border-purple-300',
  'pink': 'bg-pink-100 text-pink-800 border-pink-300',
}

export default function TicketTagEditor({ ticketId, onTagsUpdate }) {
  const { makeAuthenticatedRequest } = useAuth()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [allTags, setAllTags] = useState([])
  const [selectedTags, setSelectedTags] = useState([])
  const [tempSelectedTagIds, setTempSelectedTagIds] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchTags = async () => {
    try {
      const response = await makeAuthenticatedRequest('/api/tags')
      if (response.ok) {
        const data = await response.json()
        setAllTags(data.tags)
      }
    } catch (error) {
      console.error('Error fetching tags:', error)
    }
  }

  const fetchTicketTags = async () => {
    setLoading(true)
    try {
      const response = await makeAuthenticatedRequest(`/api/tickets/${ticketId}/tags`)
      if (response.ok) {
        const data = await response.json()
        setSelectedTags(data.tags)
        setTempSelectedTagIds(data.tags.map(t => t.id))
      }
    } catch (error) {
      console.error('Error fetching ticket tags:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTicketTags()
    fetchTags()
  }, [ticketId])

  const handleOpenDialog = () => {
    setTempSelectedTagIds(selectedTags.map(t => t.id))
    setSearchQuery('')
    setDialogOpen(true)
  }

  const handleToggleTag = (tagId) => {
    setTempSelectedTagIds(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    )
  }

  const handleSave = async () => {
    setSubmitting(true)
    try {
      const response = await makeAuthenticatedRequest(`/api/tickets/${ticketId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tagIds: tempSelectedTagIds,
          mode: 'replace'
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update tags')
      }

      setSelectedTags(data.tags)
      toast.success('Tags updated successfully')
      setDialogOpen(false)

      if (onTagsUpdate) {
        onTagsUpdate(data.tags)
      }
    } catch (error) {
      console.error('Error updating tags:', error)
      toast.error(error.message || 'Failed to update tags')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemoveTag = async (tagId) => {
    try {
      const response = await makeAuthenticatedRequest(`/api/tickets/${ticketId}/tags?tagId=${tagId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to remove tag')
      }

      const updatedTags = selectedTags.filter(t => t.id !== tagId)
      setSelectedTags(updatedTags)
      toast.success('Tag removed')

      if (onTagsUpdate) {
        onTagsUpdate(updatedTags)
      }
    } catch (error) {
      console.error('Error removing tag:', error)
      toast.error(error.message || 'Failed to remove tag')
    }
  }

  const getTagColorClass = (colorValue) => {
    return TAG_COLORS[colorValue] || TAG_COLORS['gray']
  }

  const filteredTags = allTags.filter(tag =>
    tag.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : selectedTags.length > 0 ? (
          selectedTags.map(tag => (
            <Badge
              key={tag.id}
              className={`${getTagColorClass(tag.color)} cursor-pointer group relative pr-7`}
            >
              {tag.displayName}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemoveTag(tag.id)
                }}
                className="absolute right-1 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))
        ) : (
          <span className="text-sm text-muted-foreground">No tags</span>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenDialog}
              className="h-7"
            >
              <Plus className="h-3 w-3 mr-1" />
              Edit Tags
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Ticket Tags</DialogTitle>
              <DialogDescription>
                Select tags to categorize this ticket
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <div className="space-y-3">
                <Input
                  placeholder="Search tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />

                <ScrollArea className="h-[300px] border rounded-lg p-2">
                  {filteredTags.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No tags found
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {filteredTags.map(tag => (
                        <button
                          key={tag.id}
                          onClick={() => handleToggleTag(tag.id)}
                          className="w-full flex items-center justify-between p-2 hover:bg-muted rounded-lg transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 flex items-center justify-center border rounded">
                              {tempSelectedTagIds.includes(tag.id) && (
                                <Check className="h-4 w-4" />
                              )}
                            </div>
                            <Badge className={getTagColorClass(tag.color)}>
                              {tag.displayName}
                            </Badge>
                          </div>
                          {tag.category && (
                            <span className="text-xs text-muted-foreground">
                              {tag.category}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>

              {/* Selected tags preview */}
              {tempSelectedTagIds.length > 0 && (
                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    Selected Tags ({tempSelectedTagIds.length})
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {tempSelectedTagIds.map(tagId => {
                      const tag = allTags.find(t => t.id === tagId)
                      return tag ? (
                        <Badge key={tag.id} className={getTagColorClass(tag.color)}>
                          {tag.displayName}
                        </Badge>
                      ) : null
                    })}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="button" onClick={handleSave} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Tags'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
