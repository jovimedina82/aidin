import { NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"

// Helper function to resolve status for a specific datetime with priority
function resolveStatusAtTime(datetime, presences, officeHours, defaultLocation = 'Main Office') {
  const dayOfWeek = datetime.getDay()
  const timeStr = `${String(datetime.getHours()).padStart(2, '0')}:${String(datetime.getMinutes()).padStart(2, '0')}`

  // Priority 1: Check for time-off (VACATION/SICK) that covers this datetime
  const activeTimeOff = presences.find(p =>
    (p.status === 'VACATION' || p.status === 'SICK') &&
    new Date(p.startDate) <= datetime &&
    (p.endDate === null || new Date(p.endDate) >= datetime)
  )

  if (activeTimeOff) {
    return {
      status: activeTimeOff.status === 'VACATION' ? 'Out of Office - Vacation' : 'Out of Office - Sick',
      type: 'time-off',
      location: null,
      notes: activeTimeOff.notes,
      startDate: activeTimeOff.startDate,
      endDate: activeTimeOff.endDate,
      priority: 1
    }
  }

  // Priority 2: Check for specific schedule windows
  const activeSchedule = presences.find(p =>
    (p.status === 'AVAILABLE' || p.status === 'IN_OFFICE' || p.status === 'REMOTE') &&
    new Date(p.startDate) <= datetime &&
    (p.endDate === null || new Date(p.endDate) >= datetime)
  )

  if (activeSchedule) {
    let statusLabel = ''
    if (activeSchedule.status === 'AVAILABLE') {
      statusLabel = activeSchedule.officeLocation ? `Available - ${formatLocation(activeSchedule.officeLocation)}` : 'Available'
    } else if (activeSchedule.status === 'IN_OFFICE') {
      statusLabel = activeSchedule.officeLocation ? `In Office - ${formatLocation(activeSchedule.officeLocation)}` : 'In Office'
    } else if (activeSchedule.status === 'REMOTE') {
      statusLabel = 'Working Remote'
    }

    return {
      status: statusLabel,
      type: 'specific-schedule',
      location: activeSchedule.officeLocation,
      notes: activeSchedule.notes,
      startDate: activeSchedule.startDate,
      endDate: activeSchedule.endDate,
      priority: 2
    }
  }

  // Priority 3: Check default office hours
  const todayOfficeHours = officeHours.find(oh => oh.dayOfWeek === dayOfWeek && oh.isActive)

  if (todayOfficeHours) {
    // Check if current time is within office hours
    if (timeStr >= todayOfficeHours.startTime && timeStr <= todayOfficeHours.endTime) {
      return {
        status: `Default: ${defaultLocation}`,
        type: 'default-office-hours',
        location: defaultLocation,
        timeRange: `${formatTime(todayOfficeHours.startTime)} - ${formatTime(todayOfficeHours.endTime)}`,
        priority: 3
      }
    }
  }

  // Outside office hours or no office hours set
  return {
    status: 'After Hours',
    type: 'after-hours',
    location: null,
    priority: 4
  }
}

// Helper to format office location enum to display name
function formatLocation(location) {
  const locationMap = {
    'NEWPORT': 'Newport',
    'LAGUNA_BEACH': 'Laguna Beach',
    'DANA_POINT': 'Dana Point'
  }
  return locationMap[location] || location
}

// Helper to format time (HH:MM to human-readable)
function formatTime(timeStr) {
  const [hours, minutes] = timeStr.split(':')
  const hour = parseInt(hours)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${displayHour}:${minutes}${ampm}`
}

// Helper to convert Date object to HH:MM string
function formatTimeString(date) {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

// GET - Fetch week view for a user (next 7 days)
export async function GET(request) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    // Fetch all presences for this user
    const presences = await prisma.staffPresence.findMany({
      where: {
        userId,
        isActive: true
      },
      orderBy: { startDate: 'asc' }
    })

    // Fetch office hours for this user
    const officeHours = await prisma.officeHours.findMany({
      where: {
        userId,
        isActive: true
      }
    })

    // Get user details for default location
    const userDetails = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        officeLocation: true,
        jobTitle: true,
        avatar: true,
        email: true
      }
    })

    const defaultLocation = userDetails?.officeLocation || 'Main Office'

    // Calculate schedule for next 7 days
    const weekView = []
    const now = new Date()

    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(now)
      currentDate.setDate(now.getDate() + i)
      currentDate.setHours(0, 0, 0, 0)

      const dayData = {
        date: currentDate.toISOString(),
        dayOfWeek: currentDate.toLocaleDateString('en-US', { weekday: 'long' }),
        dayNumber: currentDate.getDate(),
        month: currentDate.toLocaleDateString('en-US', { month: 'short' }),
        schedules: []
      }

      // Check status at start of business day (9 AM)
      const morningCheck = new Date(currentDate)
      morningCheck.setHours(9, 0, 0, 0)
      const morningStatus = resolveStatusAtTime(morningCheck, presences, officeHours, defaultLocation)

      // Check status at end of business day (5 PM)
      const eveningCheck = new Date(currentDate)
      eveningCheck.setHours(17, 0, 0, 0)
      const eveningStatus = resolveStatusAtTime(eveningCheck, presences, officeHours, defaultLocation)

      // First check if this day has office hours enabled
      const officeHoursForDay = officeHours.find(oh => oh.dayOfWeek === currentDate.getDay() && oh.isActive)

      // If office hours are disabled for this day, skip it entirely (don't show as working day)
      if (!officeHoursForDay) {
        // Check if there are time-off schedules (VACATION/SICK) - these should still be shown
        const timeOffSchedules = presences.filter(p => {
          if (p.status !== 'VACATION' && p.status !== 'SICK') return false

          const startDate = new Date(p.startDate)
          const endDate = p.endDate ? new Date(p.endDate) : null

          const dayStart = new Date(currentDate)
          dayStart.setHours(0, 0, 0, 0)
          const dayEnd = new Date(currentDate)
          dayEnd.setHours(23, 59, 59, 999)

          return startDate <= dayEnd && (endDate === null || endDate >= dayStart)
        })

        // Only show time-off on non-working days, otherwise skip the day
        if (timeOffSchedules.length > 0) {
          timeOffSchedules.forEach(schedule => {
            const startTime = new Date(schedule.startDate)
            const endTime = schedule.endDate ? new Date(schedule.endDate) : null

            let statusLabel = schedule.status === 'VACATION' ? 'Vacation' : 'Out Sick'

            dayData.schedules.push({
              id: schedule.id,
              status: statusLabel,
              type: 'time-off',
              startTime: startTime.toISOString(),
              endTime: endTime ? endTime.toISOString() : null,
              location: null,
              notes: schedule.notes,
              timeRange: 'All day'
            })
          })
        } else {
          // This day is not a working day - don't add it to the week view
          continue
        }
      } else {
        // This is a working day - check for specific schedules
        const daySchedules = presences.filter(p => {
          const startDate = new Date(p.startDate)
          const endDate = p.endDate ? new Date(p.endDate) : null

          const dayStart = new Date(currentDate)
          dayStart.setHours(0, 0, 0, 0)
          const dayEnd = new Date(currentDate)
          dayEnd.setHours(23, 59, 59, 999)

          // Check if this presence overlaps with the current day
          return startDate <= dayEnd && (endDate === null || endDate >= dayStart)
        })

        // Check if there are time-off schedules (VACATION/SICK) - these override everything
        const timeOffSchedules = daySchedules.filter(s => s.status === 'VACATION' || s.status === 'SICK')

        if (timeOffSchedules.length > 0) {
          // Time-off overrides everything - show it as all day
          timeOffSchedules.forEach(schedule => {
            const startTime = new Date(schedule.startDate)
            const endTime = schedule.endDate ? new Date(schedule.endDate) : null

            let statusLabel = schedule.status === 'VACATION' ? 'Vacation' : 'Out Sick'

            dayData.schedules.push({
              id: schedule.id,
              status: statusLabel,
              type: 'time-off',
              startTime: startTime.toISOString(),
              endTime: endTime ? endTime.toISOString() : null,
              location: null,
              notes: schedule.notes,
              timeRange: 'All day'
            })
          })
        } else if (daySchedules.length > 0) {
          // Has specific schedules - need to split the day into segments
          // Parse office hours for this day
          const [officeStartHour, officeStartMinute] = officeHoursForDay.startTime.split(':').map(Number)
          const [officeEndHour, officeEndMinute] = officeHoursForDay.endTime.split(':').map(Number)

          const officeStart = new Date(currentDate)
          officeStart.setHours(officeStartHour, officeStartMinute, 0, 0)

          const officeEnd = new Date(currentDate)
          officeEnd.setHours(officeEndHour, officeEndMinute, 0, 0)

          // Build time segments for the day
          const segments = []

          // Sort schedules by start time
          const sortedSchedules = [...daySchedules]
            .filter(s => s.status !== 'VACATION' && s.status !== 'SICK')
            .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))

          let currentTime = new Date(officeStart)

          sortedSchedules.forEach(schedule => {
            const scheduleStart = new Date(schedule.startDate)
            const scheduleEnd = schedule.endDate ? new Date(schedule.endDate) : new Date(officeEnd)

            // Clamp schedule times to the current day
            const effectiveStart = scheduleStart < officeStart ? officeStart : (scheduleStart > officeEnd ? officeEnd : scheduleStart)
            const effectiveEnd = scheduleEnd > officeEnd ? officeEnd : (scheduleEnd < officeStart ? officeStart : scheduleEnd)

            // If there's a gap before this schedule, fill it with default
            if (currentTime < effectiveStart) {
              segments.push({
                status: `Available - ${formatLocation(defaultLocation)}`,
                type: 'default-office-hours',
                startTime: new Date(currentTime).toISOString(),
                endTime: new Date(effectiveStart).toISOString(),
                location: defaultLocation,
                notes: null,
                timeRange: `${formatTime(formatTimeString(currentTime))} - ${formatTime(formatTimeString(effectiveStart))}`
              })
            }

            // Add the custom schedule
            let statusLabel = ''
            if (schedule.status === 'AVAILABLE') {
              statusLabel = schedule.officeLocation ? `Available - ${formatLocation(schedule.officeLocation)}` : 'Available'
            } else if (schedule.status === 'IN_OFFICE') {
              statusLabel = schedule.officeLocation ? `In Office - ${formatLocation(schedule.officeLocation)}` : 'In Office'
            } else if (schedule.status === 'REMOTE') {
              statusLabel = 'Working Remote'
            }

            segments.push({
              id: schedule.id,
              status: statusLabel,
              type: 'specific-schedule',
              startTime: effectiveStart.toISOString(),
              endTime: effectiveEnd.toISOString(),
              location: schedule.officeLocation,
              notes: schedule.notes,
              timeRange: `${formatTime(formatTimeString(effectiveStart))} - ${formatTime(formatTimeString(effectiveEnd))}`
            })

            currentTime = new Date(effectiveEnd)
          })

          // Fill any remaining time until end of office hours with default
          if (currentTime < officeEnd) {
            segments.push({
              status: `Available - ${formatLocation(defaultLocation)}`,
              type: 'default-office-hours',
              startTime: new Date(currentTime).toISOString(),
              endTime: new Date(officeEnd).toISOString(),
              location: defaultLocation,
              notes: null,
              timeRange: `${formatTime(formatTimeString(currentTime))} - ${formatTime(formatTimeString(officeEnd))}`
            })
          }

          dayData.schedules = segments
        } else {
          // No specific schedules - use default office hours
          dayData.schedules.push({
            status: `Available - ${formatLocation(defaultLocation)}`,
            type: 'default-office-hours',
            location: defaultLocation,
            timeRange: `${formatTime(officeHoursForDay.startTime)} - ${formatTime(officeHoursForDay.endTime)}`,
            notes: null
          })
        }
      }

      weekView.push(dayData)
    }

    return NextResponse.json({
      user: userDetails,
      weekView,
      defaultLocation
    })
  } catch (error) {
    console.error('Error fetching week view:', error)
    return NextResponse.json({ error: 'Failed to fetch week view' }, { status: 500 })
  }
}

// Helper to format time range
function formatTimeRange(startTime, endTime, dayDate) {
  const start = new Date(startTime)
  const end = endTime ? new Date(endTime) : null

  // Check if start and end are on the same day as dayDate
  const dayStart = new Date(dayDate)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(dayDate)
  dayEnd.setHours(23, 59, 59, 999)

  const startsBeforeDay = start < dayStart
  const endsAfterDay = !end || end > dayEnd
  const startsDuringDay = start >= dayStart && start <= dayEnd
  const endsDuringDay = end && end >= dayStart && end <= dayEnd

  // Determine the effective start time for this day
  let effectiveStart
  if (startsBeforeDay) {
    effectiveStart = dayStart
  } else if (startsDuringDay) {
    effectiveStart = start
  } else {
    // Starts after this day, shouldn't happen
    return 'Invalid time'
  }

  // Determine the effective end time for this day
  let effectiveEnd
  if (!end) {
    // No end date means it continues indefinitely
    effectiveEnd = dayEnd
  } else if (endsAfterDay) {
    effectiveEnd = dayEnd
  } else if (endsDuringDay) {
    effectiveEnd = end
  } else {
    // Ends before this day, shouldn't happen
    return 'Invalid time'
  }

  // Extract time components
  const startHour = effectiveStart.getHours()
  const startMinute = effectiveStart.getMinutes()
  const endHour = effectiveEnd.getHours()
  const endMinute = effectiveEnd.getMinutes()

  // Check if this covers the full work day (0:00-23:59)
  const isFullDay = (startHour === 0 && startMinute === 0) && (endHour === 23 && endMinute === 59)

  if (isFullDay) {
    return 'All day'
  }

  // Format the time strings
  const startTimeStr = `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`
  const endTimeStr = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`

  return `${formatTime(startTimeStr)} - ${formatTime(endTimeStr)}`
}
