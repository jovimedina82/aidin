'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { Button } from './ui/button'
import { Calendar, MapPin, Coffee, Home, HeartPulse, Check, Moon, Loader2, Clock, X, ChevronRight, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from './AuthProvider'

// Status to color mapping
const STATUS_COLORS = {
  'Available': 'bg-green-100 text-green-800 border-green-300',
  'In Office': 'bg-blue-100 text-blue-800 border-blue-300',
  'Working Remote': 'bg-purple-100 text-purple-800 border-purple-300',
  'Out of Office': 'bg-orange-100 text-orange-800 border-orange-300',
  'After Hours': 'bg-gray-100 text-gray-800 border-gray-300',
  'Vacation': 'bg-orange-100 text-orange-800 border-orange-300',
  'Sick': 'bg-red-100 text-red-800 border-red-300',
  'Default': 'bg-blue-50 text-blue-700 border-blue-200'
}

// Calendar day colors (for the grid)
const DAY_BG_COLORS = {
  'Available': 'bg-green-500/20 hover:bg-green-500/30 border-green-500/40',
  'In Office': 'bg-blue-500/20 hover:bg-blue-500/30 border-blue-500/40',
  'Working Remote': 'bg-purple-500/20 hover:bg-purple-500/30 border-purple-500/40',
  'Out of Office': 'bg-orange-500/20 hover:bg-orange-500/30 border-orange-500/40',
  'After Hours': 'bg-gray-300/20 hover:bg-gray-300/30 border-gray-300/40',
  'Vacation': 'bg-orange-500/20 hover:bg-orange-500/30 border-orange-500/40',
  'Sick': 'bg-red-500/20 hover:bg-red-500/30 border-red-500/40',
  'Default': 'bg-blue-400/20 hover:bg-blue-400/30 border-blue-400/40'
}

// Status to icon mapping
const STATUS_ICONS = {
  'Available': Check,
  'In Office': MapPin,
  'Working Remote': Home,
  'Out of Office': Coffee,
  'After Hours': Moon,
  'Vacation': Coffee,
  'Sick': HeartPulse,
  'Default': Clock
}

function getStatusColor(status) {
  for (const [key, color] of Object.entries(STATUS_COLORS)) {
    if (status.includes(key)) {
      return color
    }
  }
  return 'bg-gray-100 text-gray-800 border-gray-300'
}

function getDayBgColor(status) {
  for (const [key, color] of Object.entries(DAY_BG_COLORS)) {
    if (status.includes(key)) {
      return color
    }
  }
  return 'bg-gray-200/20 hover:bg-gray-200/30 border-gray-300/40'
}

function getStatusIcon(status) {
  for (const [key, Icon] of Object.entries(STATUS_ICONS)) {
    if (status.includes(key)) {
      return Icon
    }
  }
  return Clock
}

export default function StaffWeekView({ userId, userName, userAvatar, isOpen, onClose }) {
  const { makeAuthenticatedRequest, user: currentUser } = useAuth()
  const [weekView, setWeekView] = useState(null)
  const [loading, setLoading] = useState(true)
  const [userDetails, setUserDetails] = useState(null)
  const [selectedDayIndex, setSelectedDayIndex] = useState(0)

  // Check if the current user is viewing their own schedule
  const isOwnSchedule = currentUser?.id === userId

  const fetchWeekView = async () => {
    setLoading(true)
    try {
      const response = await makeAuthenticatedRequest(`/api/staff-presence/week-view?userId=${userId}`)
      if (response.ok) {
        const data = await response.json()
        setWeekView(data.weekView)
        setUserDetails(data.user)
      }
    } catch (error) {
      console.error('Error fetching week view:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSchedule = async (scheduleId) => {
    if (!window.confirm('Are you sure you want to delete this schedule?')) {
      return
    }

    try {
      const response = await makeAuthenticatedRequest(`/api/staff-presence?id=${scheduleId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Schedule deleted successfully')
        // Refresh the week view
        fetchWeekView()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to delete schedule')
      }
    } catch (error) {
      console.error('Error deleting schedule:', error)
      toast.error('Failed to delete schedule')
    }
  }

  useEffect(() => {
    if (isOpen && userId) {
      fetchWeekView()
      setSelectedDayIndex(0) // Reset to first day when opening
    }
  }, [isOpen, userId])

  if (!isOpen) return null

  const getInitials = (firstName, lastName) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase()
  }

  const selectedDay = weekView && weekView.length > 0 ? weekView[selectedDayIndex] : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <Card className="w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <CardHeader className="border-b bg-gradient-to-r from-primary/5 to-primary/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 ring-2 ring-primary/20">
                <AvatarImage src={userAvatar} alt={userName} />
                <AvatarFallback className="text-lg">
                  {userDetails ? getInitials(userDetails.firstName, userDetails.lastName) : '?'}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-2xl">{userName}'s Schedule</CardTitle>
                <CardDescription className="text-base">
                  {userDetails?.jobTitle || 'Staff Member'}
                </CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>

        {/* Content */}
        <CardContent className="flex-1 overflow-hidden p-0">
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
                <p className="text-muted-foreground text-lg">Loading schedule...</p>
              </div>
            </div>
          ) : weekView && weekView.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 h-full">
              {/* Calendar Grid - Left Side */}
              <div className="lg:col-span-1 border-r bg-muted/30 p-6 overflow-y-auto">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Next 7 Days
                  </h3>
                  <p className="text-xs text-muted-foreground">Click a day to see details</p>
                </div>

                <div className="space-y-2">
                  {weekView.map((day, index) => {
                    const isToday = index === 0
                    const isSelected = index === selectedDayIndex
                    const date = new Date(day.date)

                    // Get primary status for the day (first schedule or default)
                    const primarySchedule = day.schedules?.[0]
                    const primaryStatus = primarySchedule?.status || 'No Schedule'
                    const StatusIcon = getStatusIcon(primaryStatus)
                    const dayBgColor = getDayBgColor(primaryStatus)

                    return (
                      <button
                        key={day.date}
                        onClick={() => setSelectedDayIndex(index)}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-all duration-200 ${
                          isSelected
                            ? 'border-primary bg-primary/10 shadow-md scale-[1.02]'
                            : `border-transparent ${dayBgColor}`
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold text-sm">
                              {day.dayOfWeek}
                            </span>
                            {isToday && (
                              <Badge variant="default" className="text-xs px-1.5 py-0">
                                Today
                              </Badge>
                            )}
                          </div>
                          <ChevronRight className={`h-4 w-4 transition-transform ${
                            isSelected ? 'rotate-90 text-primary' : 'text-muted-foreground'
                          }`} />
                        </div>

                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                          <span>{day.month} {day.dayNumber}</span>
                        </div>

                        {/* Status preview */}
                        <div className="flex items-center gap-2">
                          <StatusIcon className="h-4 w-4" />
                          <span className="text-xs font-medium truncate">
                            {primaryStatus.split(' - ')[0]}
                          </span>
                        </div>

                        {/* Schedule count badge */}
                        {day.schedules && day.schedules.length > 1 && (
                          <Badge variant="outline" className="text-xs mt-2">
                            +{day.schedules.length - 1} more
                          </Badge>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Day Details - Right Side */}
              <div className="lg:col-span-2 p-6 overflow-y-auto">
                {selectedDay ? (
                  <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                    {/* Day Header */}
                    <div className="mb-6">
                      <div className="flex items-baseline gap-3 mb-2">
                        <h2 className="text-3xl font-bold">{selectedDay.dayOfWeek}</h2>
                        <span className="text-xl text-muted-foreground">
                          {selectedDay.month} {selectedDay.dayNumber}
                        </span>
                        {selectedDayIndex === 0 && (
                          <Badge variant="default" className="ml-2">Today</Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground">
                        {selectedDay.schedules?.length || 0} schedule{selectedDay.schedules?.length !== 1 ? 's' : ''}
                      </p>
                    </div>

                    {/* Schedules */}
                    <div className="space-y-4">
                      {selectedDay.schedules && selectedDay.schedules.length > 0 ? (
                        selectedDay.schedules.map((schedule, idx) => {
                          const StatusIcon = getStatusIcon(schedule.status)
                          const colorClass = getStatusColor(schedule.status)

                          return (
                            <div
                              key={idx}
                              className={`border-2 rounded-xl p-5 ${colorClass} animate-in fade-in slide-in-from-bottom-2 duration-300 shadow-sm hover:shadow-md transition-shadow`}
                              style={{ animationDelay: `${idx * 50}ms` }}
                            >
                              {/* Status Header */}
                              <div className="flex items-start gap-4 mb-4">
                                <div className="p-3 rounded-lg bg-white/50">
                                  <StatusIcon className="h-6 w-6" />
                                </div>
                                <div className="flex-1">
                                  <h3 className="font-semibold text-lg mb-1">
                                    {schedule.status}
                                  </h3>
                                  {schedule.timeRange && (
                                    <div className="flex items-center gap-2 text-sm">
                                      <Clock className="h-4 w-4" />
                                      <span className="font-medium">{schedule.timeRange}</span>
                                    </div>
                                  )}
                                </div>
                                {/* Delete button - only show for own schedules */}
                                {schedule.id && isOwnSchedule && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 opacity-60 hover:opacity-100 hover:bg-red-100 hover:text-red-600"
                                    onClick={() => handleDeleteSchedule(schedule.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>

                              {/* Location */}
                              {schedule.location && (
                                <div className="flex items-center gap-2 mb-3 p-3 bg-white/30 rounded-lg">
                                  <MapPin className="h-4 w-4" />
                                  <span className="text-sm font-medium">{schedule.location}</span>
                                </div>
                              )}

                              {/* Notes */}
                              {schedule.notes && (
                                <div className="mt-3 p-3 bg-white/30 rounded-lg">
                                  <p className="text-sm italic">{schedule.notes}</p>
                                </div>
                              )}

                              {/* Type indicator */}
                              {schedule.type === 'default-office-hours' && (
                                <div className="mt-3 pt-3 border-t border-current/20">
                                  <p className="text-xs uppercase tracking-wide opacity-70">
                                    Standard Office Hours
                                  </p>
                                </div>
                              )}
                              {schedule.type === 'specific-schedule' && (
                                <div className="mt-3 pt-3 border-t border-current/20">
                                  <p className="text-xs uppercase tracking-wide opacity-70">
                                    Custom Schedule
                                  </p>
                                </div>
                              )}
                              {schedule.type === 'time-off' && (
                                <div className="mt-3 pt-3 border-t border-current/20">
                                  <p className="text-xs uppercase tracking-wide opacity-70">
                                    Time Off
                                  </p>
                                </div>
                              )}
                            </div>
                          )
                        })
                      ) : (
                        <div className="text-center py-12 border-2 border-dashed rounded-xl">
                          <Calendar className="h-12 w-12 mx-auto mb-4 opacity-30" />
                          <p className="text-muted-foreground">No schedule for this day</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">Select a day to view details</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <Calendar className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p className="text-muted-foreground text-lg">No schedule information available</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
