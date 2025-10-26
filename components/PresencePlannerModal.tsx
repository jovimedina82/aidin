'use client'

/**
 * Presence Planner Modal
 *
 * Features:
 * - Date picker with optional "Repeat until" (max 30 days)
 * - Multi-segment planning with status/office dropdowns
 * - Live 8h validation indicator (red if exceeded)
 * - Dynamic office field (only shows if status requiresOffice)
 * - Validation errors displayed per field
 */

import { useState, useEffect } from 'react'
import { format, add } from 'date-fns'
import { Calendar as CalendarIcon, Plus, Trash2, AlertCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { calculateTotalMinutes, calculateRemainingMinutes, formatDuration, MAX_DAY_MINUTES, MAX_RANGE_DAYS } from '@/lib/presence/validation'

interface StatusOption {
  code: string
  label: string
  color: string | null
  icon: string | null
  requiresOffice: boolean
}

interface OfficeOption {
  code: string
  name: string
}

interface Segment {
  id: string
  statusCode: string
  officeCode: string
  from: string
  to: string
  notes: string
}

interface PresencePlannerModalProps {
  isOpen: boolean
  onClose: () => void
  userId?: string
  onSuccess?: () => void
}

export default function PresencePlannerModal({
  isOpen,
  onClose,
  userId,
  onSuccess,
}: PresencePlannerModalProps) {
  const [date, setDate] = useState<Date>(new Date())
  const [repeatUntil, setRepeatUntil] = useState<Date | undefined>()
  const [segments, setSegments] = useState<Segment[]>([
    { id: crypto.randomUUID(), statusCode: '', officeCode: '', from: '09:00', to: '17:00', notes: '' },
  ])

  const [statuses, setStatuses] = useState<StatusOption[]>([])
  const [offices, setOffices] = useState<OfficeOption[]>([])
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<any[]>([])
  const [generalError, setGeneralError] = useState<string>('')

  // Fetch options on mount
  useEffect(() => {
    if (isOpen) {
      fetchOptions()
    }
  }, [isOpen])

  async function fetchOptions() {
    try {
      const res = await fetch('/api/presence/options')
      if (res.ok) {
        const data = await res.json()
        setStatuses(data.statuses || [])
        setOffices(data.offices || [])
      }
    } catch (error) {
      console.error('Failed to fetch options:', error)
    }
  }

  function addSegment() {
    setSegments([
      ...segments,
      { id: crypto.randomUUID(), statusCode: '', officeCode: '', from: '09:00', to: '17:00', notes: '' },
    ])
  }

  function removeSegment(id: string) {
    setSegments(segments.filter((s) => s.id !== id))
  }

  function updateSegment(id: string, field: keyof Segment, value: string) {
    setSegments(segments.map((s) => (s.id === id ? { ...s, [field]: value } : s)))
  }

  function getStatusOption(code: string): StatusOption | undefined {
    return statuses.find((s) => s.code === code)
  }

  async function handleSave() {
    setLoading(true)
    setErrors([])
    setGeneralError('')

    try {
      const payload = {
        userId,
        date: format(date, 'yyyy-MM-dd'),
        repeatUntil: repeatUntil ? format(repeatUntil, 'yyyy-MM-dd') : undefined,
        segments: segments.map((s) => ({
          statusCode: s.statusCode,
          officeCode: s.officeCode || undefined,
          from: s.from,
          to: s.to,
          notes: s.notes || undefined,
        })),
      }

      const res = await fetch('/api/presence/plan-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.details && Array.isArray(data.details)) {
          setErrors(data.details)
        } else {
          setGeneralError(data.error || 'Failed to save schedule')
        }
        return
      }

      // Success
      onSuccess?.()
      onClose()
      resetForm()
    } catch (error: any) {
      setGeneralError(error.message || 'Failed to save schedule')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setDate(new Date())
    setRepeatUntil(undefined)
    setSegments([{ id: crypto.randomUUID(), statusCode: '', officeCode: '', from: '09:00', to: '17:00', notes: '' }])
    setErrors([])
    setGeneralError('')
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  // Calculate duration indicator
  const totalMinutes = calculateTotalMinutes(
    segments
      .filter((s) => s.from && s.to)
      .map((s) => ({ from: s.from, to: s.to, statusCode: s.statusCode }))
  )
  const remainingMinutes = calculateRemainingMinutes(
    segments
      .filter((s) => s.from && s.to)
      .map((s) => ({ from: s.from, to: s.to, statusCode: s.statusCode }))
  )
  const isOverLimit = totalMinutes > MAX_DAY_MINUTES

  // Max repeat date
  const maxRepeatDate = add(date, { days: MAX_RANGE_DAYS })

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Plan Schedule</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Date Picker */}
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'PPP') : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus />
              </PopoverContent>
            </Popover>
          </div>

          {/* Repeat Until (Optional) */}
          <div className="space-y-2">
            <Label>Repeat Until (Optional, max {MAX_RANGE_DAYS} days)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {repeatUntil ? format(repeatUntil, 'PPP') : <span>No repeat</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={repeatUntil}
                  onSelect={setRepeatUntil}
                  disabled={(d) => d <= date || d > maxRepeatDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {repeatUntil && (
              <Button variant="ghost" size="sm" onClick={() => setRepeatUntil(undefined)}>
                Clear
              </Button>
            )}
          </div>

          {/* Duration Indicator */}
          <div className={`p-3 rounded-md border ${isOverLimit ? 'bg-red-50 border-red-300' : 'bg-blue-50 border-blue-300'}`}>
            <div className="flex items-center justify-between">
              <span className="font-medium">Daily Total:</span>
              <span className={isOverLimit ? 'text-red-600 font-semibold' : 'text-blue-600'}>
                {formatDuration(totalMinutes)} of {formatDuration(MAX_DAY_MINUTES)}
              </span>
            </div>
            {!isOverLimit && remainingMinutes > 0 && (
              <div className="text-sm text-gray-600 mt-1">
                {formatDuration(remainingMinutes)} remaining
              </div>
            )}
            {isOverLimit && (
              <div className="text-sm text-red-600 mt-1 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                Exceeds daily limit
              </div>
            )}
          </div>

          {/* Segments */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Schedule Segments</Label>
              <Button type="button" size="sm" onClick={addSegment} disabled={loading}>
                <Plus className="h-4 w-4 mr-1" />
                Add Segment
              </Button>
            </div>

            {segments.map((seg, index) => {
              const status = getStatusOption(seg.statusCode)
              const segmentErrors = errors.filter((e) => e.field?.startsWith(`segments[${index}]`))

              return (
                <div key={seg.id} className="p-4 border rounded-md space-y-3 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Segment {index + 1}</span>
                    {segments.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSegment(seg.id)}
                        disabled={loading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* From Time */}
                    <div>
                      <Label htmlFor={`from-${seg.id}`}>From</Label>
                      <Input
                        id={`from-${seg.id}`}
                        type="time"
                        value={seg.from}
                        onChange={(e) => updateSegment(seg.id, 'from', e.target.value)}
                        disabled={loading}
                      />
                    </div>

                    {/* To Time */}
                    <div>
                      <Label htmlFor={`to-${seg.id}`}>To</Label>
                      <Input
                        id={`to-${seg.id}`}
                        type="time"
                        value={seg.to}
                        onChange={(e) => updateSegment(seg.id, 'to', e.target.value)}
                        disabled={loading}
                      />
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <Label htmlFor={`status-${seg.id}`}>Status</Label>
                    <Select
                      value={seg.statusCode}
                      onValueChange={(value) => {
                        updateSegment(seg.id, 'statusCode', value)
                        // Clear office if new status doesn't require it
                        const newStatus = getStatusOption(value)
                        if (newStatus && !newStatus.requiresOffice) {
                          updateSegment(seg.id, 'officeCode', '')
                        }
                      }}
                      disabled={loading}
                    >
                      <SelectTrigger id={`status-${seg.id}`}>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map((s) => (
                          <SelectItem key={s.code} value={s.code}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Office (conditional) */}
                  {status?.requiresOffice && (
                    <div>
                      <Label htmlFor={`office-${seg.id}`}>Office Location</Label>
                      <Select
                        value={seg.officeCode}
                        onValueChange={(value) => updateSegment(seg.id, 'officeCode', value)}
                        disabled={loading}
                      >
                        <SelectTrigger id={`office-${seg.id}`}>
                          <SelectValue placeholder="Select office" />
                        </SelectTrigger>
                        <SelectContent>
                          {offices.map((o) => (
                            <SelectItem key={o.code} value={o.code}>
                              {o.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Notes */}
                  <div>
                    <Label htmlFor={`notes-${seg.id}`}>Notes (Optional, max 500 chars)</Label>
                    <Textarea
                      id={`notes-${seg.id}`}
                      value={seg.notes}
                      onChange={(e) => updateSegment(seg.id, 'notes', e.target.value.slice(0, 500))}
                      maxLength={500}
                      rows={2}
                      disabled={loading}
                      placeholder="Add notes..."
                    />
                    <div className="text-xs text-gray-500 mt-1">{seg.notes.length}/500</div>
                  </div>

                  {/* Segment Errors */}
                  {segmentErrors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded p-2 space-y-1">
                      {segmentErrors.map((err, i) => (
                        <div key={i} className="text-sm text-red-600 flex items-start gap-1">
                          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          {err.message}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* General Error */}
          {generalError && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-600 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              {generalError}
            </div>
          )}

          {/* Global Errors */}
          {errors.filter((e) => !e.field?.startsWith('segments[')).length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded p-3 space-y-1">
              {errors
                .filter((e) => !e.field?.startsWith('segments['))
                .map((err, i) => (
                  <div key={i} className="text-sm text-red-600 flex items-start gap-1">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong>{err.field}:</strong> {err.message}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || segments.length === 0}>
            {loading ? 'Saving...' : 'Save Schedule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
