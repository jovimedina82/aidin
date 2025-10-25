'use client'

import { useState, useEffect } from 'react'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Calendar } from './ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { CalendarIcon, MapPin, Home, Coffee, HeartPulse, Check, Moon, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { useAuth } from './AuthProvider'

const STATUS_OPTIONS = [
  { value: 'AVAILABLE', label: 'Available', icon: Check, description: 'Ready to help' },
  { value: 'IN_OFFICE', label: 'In Office', icon: MapPin, description: 'Working from office' },
  { value: 'REMOTE', label: 'Working Remote', icon: Home, description: 'Working from home' },
  { value: 'VACATION', label: 'On Vacation', icon: Coffee, description: 'Out of office' },
  { value: 'SICK', label: 'Out Sick', icon: HeartPulse, description: 'Medical leave' },
  { value: 'AFTER_HOURS', label: 'After Hours', icon: Moon, description: 'Working outside office hours' }
]

const OFFICE_LOCATIONS = [
  { value: 'NEWPORT', label: 'Newport' },
  { value: 'LAGUNA_BEACH', label: 'Laguna Beach' },
  { value: 'DANA_POINT', label: 'Dana Point' }
]

export default function StaffPresenceSelector({ currentPresence, onUpdate, triggerButton }) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState(currentPresence?.status || 'AVAILABLE')
  const [officeLocation, setOfficeLocation] = useState(currentPresence?.officeLocation || '')
  const [notes, setNotes] = useState(currentPresence?.notes || '')
  const [startDate, setStartDate] = useState(() => {
    if (currentPresence?.startDate) {
      return new Date(currentPresence.startDate)
    }
    return new Date()
  })
  const [endDate, setEndDate] = useState(currentPresence?.endDate ? new Date(currentPresence.endDate) : null)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [loading, setLoading] = useState(false)
  const [officeHours, setOfficeHours] = useState([])
  const [isAfterHours, setIsAfterHours] = useState(false)
  const { makeAuthenticatedRequest } = useAuth()

  // Check if current time is within office hours
  const checkIfAfterHours = (hours) => {
    if (!hours || hours.length === 0) {
      // No office hours set, assume not after hours
      return false
    }

    const now = new Date()
    const currentDay = now.getDay() // 0 = Sunday, 1 = Monday, etc.
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

    // Find office hours for current day
    const todayHours = hours.find(h => h.dayOfWeek === currentDay && h.isActive)

    if (!todayHours) {
      // No office hours for today, so it's after hours
      return true
    }

    // Check if current time is outside office hours
    return currentTime < todayHours.startTime || currentTime > todayHours.endTime
  }

  // Fetch office hours when dialog opens
  useEffect(() => {
    if (open) {
      fetchOfficeHours()
      // Reset dates when dialog opens to ensure valid values
      if (!startDate || !(startDate instanceof Date) || isNaN(startDate.getTime())) {
        console.log('Resetting invalid startDate')
        setStartDate(new Date())
      }
    }
  }, [open])

  const fetchOfficeHours = async () => {
    try {
      const response = await makeAuthenticatedRequest('/api/office-hours')
      if (response.ok) {
        const data = await response.json()
        setOfficeHours(data.officeHours || [])
        setIsAfterHours(checkIfAfterHours(data.officeHours || []))
      }
    } catch (error) {
      console.error('Error fetching office hours:', error)
      // If we can't fetch office hours, assume not after hours
      setIsAfterHours(false)
    }
  }

  // Get filtered status options based on time
  const getAvailableStatusOptions = () => {
    if (isAfterHours) {
      // Show all options including After Hours
      return STATUS_OPTIONS
    } else {
      // Hide After Hours option during regular office hours
      return STATUS_OPTIONS.filter(opt => opt.value !== 'AFTER_HOURS')
    }
  }

  const handleSubmit = async () => {
    if (!status) {
      toast.error('Please select a status')
      return
    }

    if ((status === 'IN_OFFICE' || status === 'AVAILABLE') && !officeLocation) {
      toast.error('Please select an office location')
      return
    }

    // Validate start date
    if (!startDate || !(startDate instanceof Date) || isNaN(startDate.getTime())) {
      toast.error('Please select a valid start date')
      return
    }

    // Combine date and time for start
    const startDateTime = new Date(startDate)
    const [startHours, startMinutes] = startTime.split(':')
    startDateTime.setHours(parseInt(startHours), parseInt(startMinutes), 0, 0)

    // Combine date and time for end (if set)
    let endDateTime = null
    if (endDate) {
      // Validate end date
      if (!(endDate instanceof Date) || isNaN(endDate.getTime())) {
        toast.error('Please select a valid end date')
        return
      }

      endDateTime = new Date(endDate)
      const [endHours, endMinutes] = endTime.split(':')
      endDateTime.setHours(parseInt(endHours), parseInt(endMinutes), 0, 0)

      // Validate end is after start
      if (endDateTime <= startDateTime) {
        toast.error('End date/time must be after start date/time')
        return
      }
    }

    setLoading(true)
    try {
      const response = await makeAuthenticatedRequest('/api/staff-presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          officeLocation: (status === 'IN_OFFICE' || status === 'AVAILABLE') ? officeLocation : null,
          notes,
          startDate: startDateTime.toISOString(),
          endDate: endDateTime ? endDateTime.toISOString() : null
        })
      })

      const data = await response.json()

      if (!response.ok) {
        const errorMsg = data.details ? `${data.error}: ${data.details}` : (data.error || 'Failed to update presence')
        throw new Error(errorMsg)
      }

      toast.success('Your status has been updated')
      setOpen(false)

      if (onUpdate) {
        onUpdate(data.presence)
      }
    } catch (error) {
      console.error('Error updating presence:', error)
      toast.error(error.message || 'Failed to update status')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button variant="outline" size="sm">
            Update Status
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-[500px]"
        onInteractOutside={(e) => {
          // Prevent dialog from closing when clicking on calendar popover
          const target = e.target
          if (target instanceof Element && (
            target.closest('[role="dialog"]') ||
            target.closest('.rdp') ||
            target.closest('[data-radix-popper-content-wrapper]')
          )) {
            e.preventDefault()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Update Your Status</DialogTitle>
          <DialogDescription>
            Let your colleagues know where you are and when you'll be available
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Status Selection */}
          <div className="space-y-2">
            <Label>Status *</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Select your status" />
              </SelectTrigger>
              <SelectContent>
                {getAvailableStatusOptions().map((option) => {
                  const Icon = option.icon
                  return (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <div className="flex flex-col">
                          <span>{option.label}</span>
                          <span className="text-xs text-muted-foreground">{option.description}</span>
                        </div>
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Office Location (for AVAILABLE and IN_OFFICE) */}
          {(status === 'AVAILABLE' || status === 'IN_OFFICE') && (
            <div className="space-y-2">
              <Label>Office Location *</Label>
              <Select value={officeLocation} onValueChange={setOfficeLocation}>
                <SelectTrigger>
                  <SelectValue placeholder="Select office location" />
                </SelectTrigger>
                <SelectContent>
                  {OFFICE_LOCATIONS.map((location) => (
                    <SelectItem key={location.value} value={location.value}>
                      {location.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Back on Monday, Available after 2pm, etc."
              rows={2}
            />
          </div>

          {/* Start Date & Time */}
          <div className="space-y-2">
            <Label>Effective From *</Label>
            <div className="grid grid-cols-2 gap-2">
              <Popover modal={true}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate && startDate instanceof Date && !isNaN(startDate.getTime()) ? format(startDate, 'MMM d, yyyy') : <span>Date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[100]" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* End Date & Time */}
          <div className="space-y-2">
            <Label>Until (optional)</Label>
            <div className="grid grid-cols-2 gap-2">
              <Popover modal={true}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate && endDate instanceof Date && !isNaN(endDate.getTime()) ? format(endDate, 'MMM d, yyyy') : <span>No end date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[100]" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                    disabled={(date) => date < startDate}
                  />
                  <div className="p-2 border-t">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => setEndDate(null)}
                    >
                      Clear end date
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="pl-10"
                  disabled={!endDate}
                />
              </div>
            </div>
            {endDate && endDate instanceof Date && !isNaN(endDate.getTime()) && startDate && startDate instanceof Date && !isNaN(startDate.getTime()) && (
              <p className="text-xs text-muted-foreground">
                Specific schedule window: {format(startDate, 'MMM d')} at {startTime} → {format(endDate, 'MMM d')} at {endTime}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Updating...' : 'Update Status'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
