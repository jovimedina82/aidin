'use client'

import { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
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
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Calendar } from './ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { CalendarIcon, Plus, Trash2, Edit, CalendarClock } from 'lucide-react'
import { format, addHours, setHours, setMinutes } from 'date-fns'
import { toast } from 'sonner'
import { useAuth } from './AuthProvider'

export default function HolidayManager() {
  const [holidays, setHolidays] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingHoliday, setEditingHoliday] = useState(null)
  const { makeAuthenticatedRequest } = useAuth()

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [holidayDate, setHolidayDate] = useState(null)
  const [startEarly, setStartEarly] = useState(false)

  useEffect(() => {
    fetchHolidays()
  }, [])

  const fetchHolidays = async () => {
    setLoading(true)
    try {
      const response = await makeAuthenticatedRequest('/api/holidays')
      if (response.ok) {
        const data = await response.json()
        setHolidays(data.holidays || [])
      }
    } catch (error) {
      console.error('Error fetching holidays:', error)
    } finally {
      setLoading(false)
    }
  }

  const openAddDialog = () => {
    setEditingHoliday(null)
    setName('')
    setDescription('')
    setHolidayDate(null)
    setStartEarly(false)
    setDialogOpen(true)
  }

  const openEditDialog = (holiday) => {
    setEditingHoliday(holiday)
    setName(holiday.name)
    setDescription(holiday.description || '')
    setHolidayDate(new Date(holiday.endDate))
    // Check if it starts early (more than 1 hour before the day)
    const start = new Date(holiday.startDate)
    const end = new Date(holiday.endDate)
    setStartEarly(start.getDate() !== end.getDate())
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!name || !holidayDate) {
      toast.error('Please provide holiday name and date')
      return
    }

    try {
      // Calculate start and end dates
      // End date is always 5pm on the holiday day
      const endDate = setHours(setMinutes(new Date(holidayDate), 0), 17)

      // Start date:
      // - If "start early" is checked: 2 hours before end of previous day (10pm)
      // - Otherwise: start of the holiday day (12am)
      let startDate
      if (startEarly) {
        // Start at 10pm the day before (2 hours before end of day)
        startDate = addHours(setHours(setMinutes(new Date(holidayDate), 0), 22), -24)
      } else {
        // Start at beginning of the holiday day
        startDate = setHours(setMinutes(new Date(holidayDate), 0), 0)
      }

      const payload = {
        name,
        description: description || null,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      }

      let response
      if (editingHoliday) {
        response = await makeAuthenticatedRequest(`/api/holidays/${editingHoliday.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      } else {
        response = await makeAuthenticatedRequest('/api/holidays', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      }

      if (!response.ok) {
        throw new Error('Failed to save holiday')
      }

      toast.success(`Holiday ${editingHoliday ? 'updated' : 'created'} successfully`)
      setDialogOpen(false)
      fetchHolidays()
    } catch (error) {
      console.error('Error saving holiday:', error)
      toast.error('Failed to save holiday')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this holiday?')) {
      return
    }

    try {
      const response = await makeAuthenticatedRequest(`/api/holidays/${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete holiday')
      }

      toast.success('Holiday deleted successfully')
      fetchHolidays()
    } catch (error) {
      console.error('Error deleting holiday:', error)
      toast.error('Failed to delete holiday')
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5" />
              Company Holidays
            </CardTitle>
            <CardDescription>
              Manage official company holidays and office closures
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openAddDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Add Holiday
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>{editingHoliday ? 'Edit Holiday' : 'Add New Holiday'}</DialogTitle>
                <DialogDescription>
                  Set up a company holiday. You can optionally start it early (2 hours before the actual day).
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* Name */}
                <div className="space-y-2">
                  <Label>Holiday Name *</Label>
                  <Input
                    placeholder="e.g., Thanksgiving, Christmas"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label>Description (optional)</Label>
                  <Textarea
                    placeholder="Additional details about this holiday"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                  />
                </div>

                {/* Holiday Date */}
                <div className="space-y-2">
                  <Label>Holiday Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {holidayDate ? format(holidayDate, 'PPP') : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={holidayDate}
                        onSelect={setHolidayDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Start Early Option */}
                <div className="flex items-center space-x-2 p-3 bg-accent/50 rounded-lg">
                  <input
                    type="checkbox"
                    id="startEarly"
                    checked={startEarly}
                    onChange={(e) => setStartEarly(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <label
                    htmlFor="startEarly"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Start holiday early (2 hours before the day)
                  </label>
                </div>

                {holidayDate && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                    <p className="font-medium text-blue-900 mb-1">Holiday Schedule:</p>
                    <p className="text-blue-800">
                      {startEarly ? (
                        <>
                          <strong>Starts:</strong> {format(addHours(setHours(holidayDate, 22), -24), 'PPP')} at 10:00 PM<br />
                          <strong>Ends:</strong> {format(holidayDate, 'PPP')} at 5:00 PM
                        </>
                      ) : (
                        <>
                          <strong>Starts:</strong> {format(holidayDate, 'PPP')} at 12:00 AM<br />
                          <strong>Ends:</strong> {format(holidayDate, 'PPP')} at 5:00 PM
                        </>
                      )}
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={handleSubmit}>
                  {editingHoliday ? 'Update Holiday' : 'Add Holiday'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground mt-2">Loading holidays...</p>
          </div>
        ) : holidays.length === 0 ? (
          <div className="text-center py-12">
            <CalendarClock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">No holidays configured</p>
            <p className="text-sm text-muted-foreground">Add your first company holiday to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {holidays.map((holiday) => (
              <div
                key={holiday.id}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
              >
                <div className="flex-1">
                  <p className="font-medium">{holiday.name}</p>
                  {holiday.description && (
                    <p className="text-sm text-muted-foreground">{holiday.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(holiday.startDate), 'PPP')} - {format(new Date(holiday.endDate), 'PPP p')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(holiday)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(holiday.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
