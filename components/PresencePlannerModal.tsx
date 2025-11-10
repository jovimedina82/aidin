'use client'

import { useEffect, useMemo, useState, useRef, type FC } from 'react'
import { add, format, isAfter, isEqual, startOfDay, parseISO } from 'date-fns' // ⭐ FIX: startOfDay
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

const DATE_STORAGE_KEY = 'presence:lastSelectedDate' // ⭐ FIX

export default function PresencePlannerModal({
  isOpen,
  onClose,
  userId,
  onSuccess,
}: PresencePlannerModalProps) {
  // ⭐ FIX: initialize from localStorage if present, and normalize to startOfDay
  const [date, setDate] = useState<Date>(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(DATE_STORAGE_KEY) : null
      if (raw) {
        const d = parseISO(raw)
        return startOfDay(d)
      }
    } catch {}
    return startOfDay(new Date())
  })

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

  // ⭐ FIX: persist selected date whenever it changes
  useEffect(() => {
    try {
      if (date) {
        localStorage.setItem(DATE_STORAGE_KEY, date.toISOString()) // keep ISO (UTC), compare/display in local safely
      }
    } catch {}
  }, [date])

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

    segments.forEach((seg, idx) => {
      const prefix = `segments[${idx}]`

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

      if (!seg.statusCode) {
        errs.push({ field: `${prefix}.statusCode`, message: 'Status is required' })
      } else {
        const st = getStatus(seg.statusCode)
        if (st?.requiresOffice && !seg.officeCode) {
          errs.push({ field: `${prefix}.officeCode`, message: 'Office is required for this status' })
        }
      }
    })

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

  const newSegmentsMinutes = useMemo(
    () =>
      calculateTotalMinutes(
        segments
          .filter((s) => s.from && s.to)
          .map((s) => ({ from: s.from, to: s.to, statusCode: s.statusCode }))
      ),
    [segments]
  )

  const totalMinutes = existingMinutes + newSegmentsMinutes
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

      // ⭐ FIX: keep the currently selected date persisted; do NOT force "today"
      // Reset only the repeat/segments, not `date`.
      setRepeatUntil(undefined)
      setSegments([newSegment()])

      // Optionally close dialog
      onClose()
    } catch (e: any) {
      setGeneralError(e?.message || 'Failed to save schedule')
    } finally {
      setLoading(false)
    }
  }

  function handleClose(open: boolean) {
    if (!open) {
      // ⭐ FIX: do not reset `date` on close
      setServerErrors([])
      setGeneralError('')
      setRepeatUntil(undefined)
      setSegments([newSegment()])
      onClose()
    }
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
                  selected={date ?? undefined}
                  // ⭐ FIX: normalize to startOfDay and guard undefined
                  onSelect={(d) => {
                    if (d) {
                      const normalized = startOfDay(d)
                      setDate(normalized)
                      setDatePopoverOpen(false)
                    }
                  }}
                  // provide required props to satisfy Calendar component types
                  className=""
                  classNames={{}}
                  formatters={{}}
                  components={{}}
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
                    {repeatUntil ? format(repeatUntil, 'PPP') : 'Select repeat end'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent {...({ className: 'w-auto p-0', align: 'start' } as any)}>
                  <Calendar
                    mode="single"
                    selected={repeatUntil ?? undefined}
                    onSelect={(d) => {
                      // ⭐ FIX: normalize and close popover only when a date is chosen
                      const val = d ? startOfDay(d) : undefined
                      setRepeatUntil(val)
                      if (val) setRepeatPopoverOpen(false)
                    }}
                    disabled={(d) =>
                      !isAfter(startOfDay(d), startOfDay(date)) ||
                      isAfter(startOfDay(d), startOfDay(maxRepeatDate)) ||
                      isEqual(startOfDay(d), startOfDay(date))
                    }
                    // provide required props to satisfy Calendar component types
                    className=""
                    classNames={{}}
                    formatters={{}}
                    components={{}}
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

                  {/* Status */}
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

                  {/* Office (only if required) */}
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

          {generalError && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-600 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              {generalError}
            </div>
          )}

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
