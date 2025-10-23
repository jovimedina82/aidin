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
import { Label } from './ui/label'
import { Switch } from './ui/switch'
import { Clock } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from './AuthProvider'

const DAYS_OF_WEEK = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
]

const DEFAULT_HOURS = {
  startTime: '09:00',
  endTime: '17:00',
  isActive: true
}

export default function OfficeHoursEditor({ triggerButton, userId }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [schedule, setSchedule] = useState({})
  const { makeAuthenticatedRequest } = useAuth()

  // Initialize default schedule (Monday-Friday 9-5)
  useEffect(() => {
    if (open) {
      fetchOfficeHours()
    }
  }, [open])

  const fetchOfficeHours = async () => {
    try {
      const url = userId ? `/api/office-hours?userId=${userId}` : '/api/office-hours'
      const response = await makeAuthenticatedRequest(url)
      if (response.ok) {
        const data = await response.json()
        const scheduleMap = {}

        // Convert array to map
        data.officeHours.forEach(hour => {
          scheduleMap[hour.dayOfWeek] = {
            startTime: hour.startTime,
            endTime: hour.endTime,
            isActive: hour.isActive
          }
        })

        // Fill in defaults for days without hours
        DAYS_OF_WEEK.forEach(day => {
          if (!scheduleMap[day.value]) {
            // Default: Monday-Friday active, weekends inactive
            scheduleMap[day.value] = {
              startTime: '09:00',
              endTime: '17:00',
              isActive: day.value >= 1 && day.value <= 5
            }
          }
        })

        setSchedule(scheduleMap)
      }
    } catch (error) {
      console.error('Error fetching office hours:', error)
      // Set default schedule on error
      const defaultSchedule = {}
      DAYS_OF_WEEK.forEach(day => {
        defaultSchedule[day.value] = {
          ...DEFAULT_HOURS,
          isActive: day.value >= 1 && day.value <= 5 // Monday-Friday active
        }
      })
      setSchedule(defaultSchedule)
    }
  }

  const handleDayToggle = (dayValue) => {
    setSchedule(prev => ({
      ...prev,
      [dayValue]: {
        ...prev[dayValue],
        isActive: !prev[dayValue]?.isActive
      }
    }))
  }

  const handleTimeChange = (dayValue, field, value) => {
    setSchedule(prev => ({
      ...prev,
      [dayValue]: {
        ...prev[dayValue],
        [field]: value
      }
    }))
  }

  const handleSubmit = async () => {
    // Validate times
    for (const dayValue in schedule) {
      const day = schedule[dayValue]
      if (day.isActive) {
        const [startHour, startMin] = day.startTime.split(':').map(Number)
        const [endHour, endMin] = day.endTime.split(':').map(Number)
        const startMinutes = startHour * 60 + startMin
        const endMinutes = endHour * 60 + endMin

        if (endMinutes <= startMinutes) {
          toast.error('End time must be after start time')
          return
        }
      }
    }

    setLoading(true)
    try {
      const scheduleArray = Object.entries(schedule).map(([dayOfWeek, hours]) => ({
        dayOfWeek: parseInt(dayOfWeek),
        ...hours
      }))

      const payload = { schedule: scheduleArray }
      if (userId) {
        payload.userId = userId
      }

      const response = await makeAuthenticatedRequest('/api/office-hours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error('Failed to update office hours')
      }

      toast.success('Office hours updated successfully')
      setOpen(false)
    } catch (error) {
      console.error('Error updating office hours:', error)
      toast.error('Failed to update office hours')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button variant="outline" size="sm">
            <Clock className="mr-2 h-4 w-4" />
            Set Office Hours
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Set Your Office Hours</DialogTitle>
          <DialogDescription>
            Configure your working hours for each day of the week. This helps colleagues know when you're available.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {DAYS_OF_WEEK.map((day) => {
            const daySchedule = schedule[day.value] || DEFAULT_HOURS
            return (
              <div
                key={day.value}
                className={`flex items-center gap-4 p-3 rounded-lg border ${
                  daySchedule.isActive ? 'bg-accent/50' : 'bg-muted/30'
                }`}
              >
                {/* Day name and toggle */}
                <div className="flex items-center gap-3 w-32">
                  <Switch
                    checked={daySchedule.isActive}
                    onCheckedChange={() => handleDayToggle(day.value)}
                  />
                  <Label className="font-medium cursor-pointer" onClick={() => handleDayToggle(day.value)}>
                    {day.label}
                  </Label>
                </div>

                {/* Time inputs */}
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="time"
                    value={daySchedule.startTime}
                    onChange={(e) => handleTimeChange(day.value, 'startTime', e.target.value)}
                    disabled={!daySchedule.isActive}
                    className="px-3 py-1.5 border rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <span className="text-muted-foreground">to</span>
                  <input
                    type="time"
                    value={daySchedule.endTime}
                    onChange={(e) => handleTimeChange(day.value, 'endTime', e.target.value)}
                    disabled={!daySchedule.isActive}
                    className="px-3 py-1.5 border rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            )
          })}

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              <strong>💡 Tip:</strong> Toggle days off, and set your exact working hours for each day.
              This will be visible to your colleagues in the staff directory.
            </p>
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
            {loading ? 'Saving...' : 'Save Office Hours'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
