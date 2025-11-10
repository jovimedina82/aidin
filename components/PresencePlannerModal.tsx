'use client'

import { useEffect, useMemo, useState, type FC } from 'react'
import { add, format, isAfter, isBefore, isEqual } from 'date-fns'
import { Calendar as CalendarIcon, Plus, Trash2, AlertCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button as RawButton } from '@/components/ui/button'
const Button = RawButton as unknown as FC<any>
import { Input as RawInput } from '@/components/ui/input'
const Input = RawInput as unknown as FC<any>
import { Label as RawLabel } from '@/components/ui/label'
const Label = RawLabel as unknown as FC<any>
import {
  Select,
  SelectContent as RawSelectContent,
  SelectItem as RawSelectItem,
  SelectTrigger as RawSelectTrigger,
  SelectValue,
} from '@/components/ui/select'
const SelectTrigger = RawSelectTrigger as unknown as FC<any>
const SelectContent = RawSelectContent as unknown as FC<any>
const SelectItem = RawSelectItem as unknown as FC<any>
import { Textarea as RawTextarea } from '@/components/ui/textarea'
const Textarea = RawTextarea as unknown as FC<any>
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

import {
  calculateTotalMinutes,
  calculateRemainingMinutes,
  formatDuration,
  MAX_DAY_MINUTES,
  MAX_RANGE_DAYS,
} from '@/lib/presence/validation-utils'

/* -------------------------------- Types ------------------------------- */

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
  statusCode?: string
  officeCode?: string
  from: string // HH:mm (local)
  to: string   // HH:mm (local)
  notes: string
}

interface FieldError {
  field?: string
  message: string
}

interface PresencePlannerModalProps {
  isOpen: boolean
  onClose: () => void
  userId?: string
  onSuccess?: () => void
}

/* ------------------------------- Helpers ------------------------------ */

function newSegment(): Segment {
  return {
    id: crypto.randomUUID(),
    statusCode: undefined,
    officeCode: undefined,
    from: '09:00',
    to: '17:00',
    notes: '',
  }
}

function timeToMinutes(t: string): number {
  const [hh, mm] = t.split(':').map(Number)
  return hh * 60 + mm
}

function rangesOverlap(aFrom: string, aTo: string, bFrom: string, bTo: string) {
  const a1 = timeToMinutes(aFrom)
  const a2 = timeToMinutes(aTo)
  const b1 = timeToMinutes(bFrom)
  const b2 = timeToMinutes(bTo)
  return Math.max(a1, b1) < Math.min(a2, b2)
}

/* ========================= Presence Planner Modal ========================= */

export default function PresencePlannerModal({
  isOpen,
  onClose,
  userId,
  onSuccess,
}: PresencePlannerModalProps) {
  const [date, setDate] = useState<Date>(new Date())
  const [repeatUntil, setRepeatUntil] = useState<Date | undefined>(undefined)
  const [segments, setSegments] = useState<Segment[]>([newSegment()])

  const [statuses, setStatuses] = useState<StatusOption[]>([])
  const [offices, setOffices] = useState<OfficeOption[]>([])
  const [loading, setLoading] = useState(false)

  // Errors from server OR client
  const [serverErrors, setServerErrors] = useState<FieldError[]>([])
  const [generalError, setGeneralError] = useState<string>('')

  // Calendar popover open states
  const [datePopoverOpen, setDatePopoverOpen] = useState(false)
  const [repeatPopoverOpen, setRepeatPopoverOpen] = useState(false)

  // Existing segments for the selected date
  const [existingMinutes, setExistingMinutes] = useState(0)
  const [loadingExisting, setLoadingExisting] = useState(false)

  // Fetch options upon open
  useEffect(() => {
    if (!isOpen) return
    ;(async () => {
      try {
        const res = await fetch('/api/presence/options')
        if (res.ok) {
          const data = await res.json()
          setStatuses(Array.isArray(data.statuses) ? data.statuses : [])
          setOffices(Array.isArray(data.offices) ? data.offices : [])
        }
      } catch (e) {
        console.error('Failed to fetch presence options', e)
      }
    })()
  }, [isOpen])

  // Fetch existing segments when date changes
  useEffect(() => {
    if (!isOpen) return

    async function fetchExistingSegments() {
      setLoadingExisting(true)
      try {
        const params = new URLSearchParams({
          date: format(date, 'yyyy-MM-dd'),
        })

        if (userId) {
          params.append('userId', userId)
        }

        const res = await fetch(`/api/presence/day?${params}`)

        if (res.ok) {
          const data = await res.json()
          const existingSegs = data.segments || []

          // Calculate total existing minutes
          const totalExisting = existingSegs.reduce((sum: number, seg: any) => {
            const fromMins = timeToMinutes(seg.from)
            const toMins = timeToMinutes(seg.to)
            return sum + (toMins - fromMins)
          }, 0)

          setExistingMinutes(totalExisting)
        } else {
          setExistingMinutes(0)
        }
      } catch (e) {
        console.error('Failed to fetch existing segments', e)
        setExistingMinutes(0)
      } finally {
        setLoadingExisting(false)
      }
    }

    fetchExistingSegments()
  }, [isOpen, date, userId])

  function getStatus(code?: string) {
    if (!code) return undefined
    return statuses.find((s) => s.code === code)
  }

  function addSegmentRow() {
    setSegments((prev) => [...prev, newSegment()])
  }

  function removeSegmentRow(id: string) {
    setSegments((prev) => prev.filter((s) => s.id !== id))
  }

  function updateSegment<K extends keyof Segment>(
    id: string,
    field: K,
    value: Segment[K]
  ) {
    setSegments((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s
        const next: Segment = { ...s, [field]: value }

        // If status gets changed to one that doesn't need office, clear office
        if (field === 'statusCode') {
          const status = getStatus(value as string | undefined)
          if (!status?.requiresOffice) next.officeCode = undefined
        }

        return next
      })
    )
  }

  /* ----------------------- Local, client-side validation ---------------------- */

  const clientErrors = useMemo<FieldError[]>(() => {
    const errs: FieldError[] = []

    // Segment-level checks
    segments.forEach((seg, idx) => {
      const prefix = `segments[${idx}]`

      // times present & logical
      if (!seg.from) errs.push({ field: `${prefix}.from`, message: 'Start time is required' })
      if (!seg.to) errs.push({ field: `${prefix}.to`, message: 'End time is required' })

      if (seg.from && seg.to) {
        if (timeToMinutes(seg.to) <= timeToMinutes(seg.from)) {
          errs.push({
            field: `${prefix}.to`,
            message: 'End time must be after start time',
          })
        }
      }

      // status present
      if (!seg.statusCode) {
        errs.push({ field: `${prefix}.statusCode`, message: 'Status is required' })
      } else {
        // office conditional
        const st = getStatus(seg.statusCode)
        if (st?.requiresOffice && !seg.officeCode) {
          errs.push({ field: `${prefix}.officeCode`, message: 'Office is required for this status' })
        }
      }
    })

    // No overlaps (only if basic time checks pass)
    const basicOk = errs.every(
      (e) => !e.field?.endsWith('.from') && !e.field?.endsWith('.to')
    )
    if (basicOk) {
      segments.forEach((a, i) => {
        for (let j = i + 1; j < segments.length; j++) {
          const b = segments[j]
          if (rangesOverlap(a.from, a.to, b.from, b.to)) {
            errs.push({
              field: `segments[${i}].to`,
              message: `Overlaps with segment ${j + 1}`,
            })
          }
        }
      })
    }

    // Total minutes cap (existing + new)
    const newMinutes = calculateTotalMinutes(
      segments
        .filter((s) => s.from && s.to)
        .map((s) => ({ from: s.from, to: s.to, statusCode: s.statusCode }))
    )

    const combinedTotal = existingMinutes + newMinutes

    if (combinedTotal > MAX_DAY_MINUTES) {
      const remaining = MAX_DAY_MINUTES - existingMinutes
      if (existingMinutes >= MAX_DAY_MINUTES) {
        errs.push({
          field: 'total',
          message: 'This day is already fully scheduled (8 hours).',
        })
      } else {
        errs.push({
          field: 'total',
          message: `Exceeds daily limit. Only ${formatDuration(remaining)} remaining.`,
        })
      }
    }

    // Repeat range
    if (repeatUntil) {
      const latest = add(date, { days: MAX_RANGE_DAYS })
      if (!isAfter(repeatUntil, date) || isAfter(repeatUntil, latest) || isEqual(repeatUntil, date)) {
        errs.push({
          field: 'repeatUntil',
          message: `Choose a date after the start date and within ${MAX_RANGE_DAYS} days`,
        })
      }
    }

    return errs
  }, [segments, repeatUntil, date, statuses, existingMinutes])

  // New segments minutes only
  const newSegmentsMinutes = useMemo(
    () =>
      calculateTotalMinutes(
        segments
          .filter((s) => s.from && s.to)
          .map((s) => ({ from: s.from, to: s.to, statusCode: s.statusCode }))
      ),
    [segments]
  )

  // Combined total: existing + new
  const totalMinutes = existingMinutes + newSegmentsMinutes

  // Remaining from the 8-hour cap
  const remainingMinutes = MAX_DAY_MINUTES - totalMinutes

  const isOverLimit = totalMinutes > MAX_DAY_MINUTES
  const maxRepeatDate = add(date, { days: MAX_RANGE_DAYS })

  const canSave =
    !loading && segments.length > 0 && clientErrors.length === 0

  /* --------------------------------- Save --------------------------------- */

  async function handleSave() {
    if (!canSave) return
    setLoading(true)
    setServerErrors([])
    setGeneralError('')

    try {
      const payload = {
        userId,
        date: format(date, 'yyyy-MM-dd'),
        repeatUntil: repeatUntil ? format(repeatUntil, 'yyyy-MM-dd') : undefined,
        segments: segments.map((s) => ({
          statusCode: s.statusCode,                 // string | undefined
          officeCode: s.officeCode || undefined,    // ensure undefined (not '')
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

      const data = await res.json().catch(() => ({} as any))

      if (!res.ok) {
        if (Array.isArray(data?.details)) {
          setServerErrors(data.details)
        } else {
          setGeneralError(data?.error || 'Failed to save schedule')
        }
        return
      }

      onSuccess?.()
      // reset after success
      setDate(new Date())
      setRepeatUntil(undefined)
      setSegments([newSegment()])
      onClose()
    } catch (e: any) {
      setGeneralError(e?.message || 'Failed to save schedule')
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    // reset state on close to avoid sticky UI
    setServerErrors([])
    setGeneralError('')
    setRepeatUntil(undefined)
    setSegments([newSegment()])
    onClose()
  }

  /* --------------------------------- UI ---------------------------------- */

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent {...({ className: 'max-w-3xl max-h-[90vh] overflow-y-auto' } as any)}>
        <DialogHeader className="">
          <h3 className="text-lg font-semibold">Plan Schedule</h3>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Date */}
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(date, 'PPP')}
                </Button>
              </PopoverTrigger>
              <PopoverContent {...({ className: 'w-auto p-0', align: 'start' } as any)}>
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => {
                    if (d) {
                      setDate(d)
                      setDatePopoverOpen(false)
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Repeat Until */}
          <div className="space-y-1">
            <Label>
              Repeat Until (Optional, max {MAX_RANGE_DAYS} days)
            </Label>
            <div className="flex gap-2">
              <Popover open={repeatPopoverOpen} onOpenChange={setRepeatPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {repeatUntil ? format(repeatUntil, 'PPP') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent {...({ className: 'w-auto p-0', align: 'start' } as any)}>
                  <Calendar
                    mode="single"
                    selected={repeatUntil}
                    onSelect={(d) => {
                      setRepeatUntil(d)
                      if (d) setRepeatPopoverOpen(false)
                    }}
                    disabled={(d) =>
                      !isAfter(d, date) ||
                      isAfter(d, maxRepeatDate) ||
                      isEqual(d, date)
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              {repeatUntil && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRepeatUntil(undefined)}
                >
                  Clear
                </Button>
              )}
            </div>
            {/* client error for repeat */}
            {clientErrors
              .filter((e) => e.field === 'repeatUntil')
              .map((e, i) => (
                <p key={i} className="text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" /> {e.message}
                </p>
              ))}
          </div>

          {/* Daily total */}
          <div
            className={`p-3 rounded-md border ${
              isOverLimit ? 'bg-red-50 border-red-300' : 'bg-blue-50 border-blue-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">Daily Schedule Limit</span>
              <span className={isOverLimit ? 'text-red-600 font-semibold' : 'text-blue-700'}>
                {formatDuration(totalMinutes)} / {formatDuration(MAX_DAY_MINUTES)}
              </span>
            </div>

            {/* Breakdown */}
            <div className="space-y-1 text-sm">
              {existingMinutes > 0 && (
                <div className="flex items-center justify-between text-gray-600">
                  <span>Already scheduled:</span>
                  <span className="font-medium">{formatDuration(existingMinutes)}</span>
                </div>
              )}
              {newSegmentsMinutes > 0 && (
                <div className="flex items-center justify-between text-gray-700">
                  <span>Adding now:</span>
                  <span className="font-medium">{formatDuration(newSegmentsMinutes)}</span>
                </div>
              )}
              {!isOverLimit && remainingMinutes > 0 && (
                <div className="flex items-center justify-between text-green-700 font-medium">
                  <span>Remaining:</span>
                  <span>{formatDuration(remainingMinutes)}</span>
                </div>
              )}
            </div>

            {existingMinutes >= MAX_DAY_MINUTES && (
              <div className="text-sm text-red-600 mt-2 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" /> This day is already fully scheduled (8 hours).
              </div>
            )}

            {isOverLimit && existingMinutes < MAX_DAY_MINUTES && (
              <div className="text-sm text-red-600 mt-2 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" /> Exceeds daily limit
              </div>
            )}

            {/* server total error */}
            {serverErrors
              .filter((e) => e.field === 'segments' || e.field === 'total')
              .map((e, i) => (
                <p key={i} className="text-sm text-red-600 flex items-center gap-1 mt-2">
                  <AlertCircle className="h-4 w-4" /> {e.message}
                </p>
              ))}
          </div>

          {/* Segments */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Schedule Segments</Label>
              <Button type="button" size="sm" onClick={addSegmentRow} disabled={loading}>
                <Plus className="h-4 w-4 mr-1" />
                Add Segment
              </Button>
            </div>

            {segments.map((seg, idx) => {
              const st = getStatus(seg.statusCode)
              const pref = `segments[${idx}]`

              const segErrors = [
                ...clientErrors.filter((e) => e.field?.startsWith(pref)),
                ...serverErrors.filter((e) => e.field?.startsWith(pref)),
              ]

              return (
                <div key={seg.id} className="p-4 border rounded-md space-y-3 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      Segment {idx + 1}
                    </span>
                    {segments.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSegmentRow(seg.id)}
                        disabled={loading}
                        aria-label={`Remove segment ${idx + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {/* Times */}
                  <div className="grid grid-cols-2 gap-3">
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

                  {/* Status (FIX: value is string | undefined, never '') */}
                  <div>
                    <Label htmlFor={`status-${seg.id}`}>Status</Label>
                    <Select
                      value={seg.statusCode}
                      onValueChange={(val) => updateSegment(seg.id, 'statusCode', val)}
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

                  {/* Office (only if required by selected status) */}
                  {st?.requiresOffice && (
                    <div>
                      <Label htmlFor={`office-${seg.id}`}>Office Location</Label>
                      <Select
                        value={seg.officeCode}
                        onValueChange={(val) => updateSegment(seg.id, 'officeCode', val)}
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
                      onChange={(e) =>
                        updateSegment(seg.id, 'notes', e.target.value.slice(0, 500))
                      }
                      maxLength={500}
                      rows={2}
                      disabled={loading}
                      placeholder="Add notes..."
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      {seg.notes.length}/500
                    </div>
                  </div>

                  {/* Segment errors */}
                  {segErrors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded p-2 space-y-1">
                      {segErrors.map((err, i) => (
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

          {/* General/server errors */}
          {generalError && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-600 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              {generalError}
            </div>
          )}

          {/* Non-segment server errors */}
          {serverErrors.filter((e) => !e.field?.startsWith('segments[')).length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded p-3 space-y-1">
              {serverErrors
                .filter((e) => !e.field?.startsWith('segments['))
                .map((err, i) => (
                  <div key={i} className="text-sm text-red-600 flex items-start gap-1">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    {err.field ? <strong className="mr-1">{err.field}:</strong> : null}
                    <span>{err.message}</span>
                  </div>
                ))}
            </div>
          )}
        </div>

        <DialogFooter className="">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {loading ? 'Saving…' : 'Save Schedule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
