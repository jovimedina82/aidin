'use client'

/**
 * Presence Directory View
 *
 * Displays user's schedule for a selected date with read-only mode for Requesters
 * and edit capability for Staff/Manager/Admin.
 */

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Calendar as CalendarIcon, Edit, Trash2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import PresencePlannerModal from './PresencePlannerModal'

interface Segment {
  id: string
  statusCode: string
  statusLabel: string
  statusColor: string | null
  statusIcon: string | null
  officeCode: string | null
  officeName: string | null
  from: string
  to: string
  notes: string | null
}

interface PresenceDirectoryViewProps {
  userId?: string
  canEdit?: boolean
  onScheduleChange?: () => void
}

export default function PresenceDirectoryView({ userId, canEdit = false, onScheduleChange }: PresenceDirectoryViewProps) {
  const [date, setDate] = useState<Date>(new Date())
  const [segments, setSegments] = useState<Segment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [plannerOpen, setPlannerOpen] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)

  useEffect(() => {
    fetchSegments()
  }, [date, userId])

  async function fetchSegments() {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams({
        date: format(date, 'yyyy-MM-dd'),
      })

      if (userId) {
        params.append('userId', userId)
      }

      const res = await fetch(`/api/presence/day?${params}`)

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to fetch schedule')
        setSegments([])
        return
      }

      const data = await res.json()
      setSegments(data.segments || [])
    } catch (err: any) {
      setError(err.message || 'Failed to fetch schedule')
      setSegments([])
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteSegment(segmentId: string) {
    if (!confirm('Are you sure you want to delete this segment?')) {
      return
    }

    try {
      const res = await fetch(`/api/presence/segment/${segmentId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Failed to delete segment')
        return
      }

      // Refresh segments for this view
      fetchSegments()

      // Notify parent to refresh user list (in case user's last schedule was deleted)
      if (onScheduleChange) {
        onScheduleChange()
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete segment')
    }
  }

  return (
    <div className="space-y-4">
      {/* Header with Date Picker and Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(date, 'PPP')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => {
                  if (d) {
                    setDate(d)
                    setCalendarOpen(false)
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          {loading && <span className="text-sm text-gray-500">Loading...</span>}
        </div>

        {canEdit && (
          <Button onClick={() => setPlannerOpen(true)}>
            <Edit className="mr-2 h-4 w-4" />
            Plan Schedule
          </Button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="flex items-start gap-2 text-red-600">
            <AlertCircle className="h-5 w-5 mt-0.5" />
            <div>
              <div className="font-medium">Error</div>
              <div className="text-sm">{error}</div>
            </div>
          </div>
        </Card>
      )}

      {/* Segments Display */}
      {!loading && segments.length === 0 && !error && (
        <Card className="p-8 text-center text-gray-500">
          <div>No schedule for this date</div>
          {canEdit && (
            <Button variant="link" onClick={() => setPlannerOpen(true)} className="mt-2">
              Add a schedule
            </Button>
          )}
        </Card>
      )}

      {segments.length > 0 && (
        <div className="space-y-3">
          {segments.map((segment) => (
            <Card key={segment.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-2">
                  {/* Time & Status */}
                  <div className="flex items-center gap-3">
                    <div className="font-semibold text-lg">
                      {segment.from} – {segment.to}
                    </div>
                    <Badge
                      style={{
                        backgroundColor: segment.statusColor || '#6b7280',
                        color: '#fff',
                      }}
                    >
                      {segment.statusLabel}
                    </Badge>
                  </div>

                  {/* Office Location */}
                  {segment.officeName && (
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Office:</span> {segment.officeName}
                    </div>
                  )}

                  {/* Notes */}
                  {segment.notes && (
                    <div className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                      {segment.notes}
                    </div>
                  )}
                </div>

                {/* Delete Button */}
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteSegment(segment.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Planner Modal */}
      {canEdit && (
        <PresencePlannerModal
          isOpen={plannerOpen}
          onClose={() => setPlannerOpen(false)}
          userId={userId}
          onSuccess={() => {
            fetchSegments()
            if (onScheduleChange) {
              onScheduleChange()
            }
          }}
        />
      )}
    </div>
  )
}
