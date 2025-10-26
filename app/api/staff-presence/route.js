import { NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"

// Helper function to determine presence priority (lower = higher priority)
function getPresencePriority(status) {
  const priorities = {
    'VACATION': 1,
    'SICK': 1,
    'REMOTE': 2,
    'IN_OFFICE': 2,
    'AVAILABLE': 2,
    'AFTER_HOURS': 3
  }
  return priorities[status] || 99
}

// GET - Fetch staff presence (all staff or specific user)
export async function GET(request) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const includeInactive = searchParams.get('includeInactive') === 'true'

    // If userId specified, get that user's presence
    if (userId) {
      const now = new Date()
      const presence = await prisma.staffPresence.findFirst({
        where: {
          userId,
          ...(includeInactive ? {} : {
            isActive: true,
            startDate: { lte: now },
            OR: [
              { endDate: null },
              { endDate: { gte: now } }
            ]
          })
        },
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              jobTitle: true,
              avatar: true
            }
          }
        }
      })

      return NextResponse.json({ presence })
    }

    // Otherwise, get all staff presences (only staff members)
    const now = new Date()

    console.log('🔍 Staff Presence Query:', {
      now: now.toISOString()
    })

    const allPresence = await prisma.staffPresence.findMany({
      where: {
        isActive: true,
        startDate: { lte: now }, // Only show presences that have already started (current status)
        OR: [
          { endDate: null }, // No end date (indefinite)
          { endDate: { gte: now } } // Or end date is in the future (not expired)
        ],
        user: {
          roles: {
            some: {
              role: {
                name: {
                  in: ['Admin', 'Manager', 'Staff']
                }
              }
            }
          }
        }
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            jobTitle: true,
            avatar: true,
            departments: {
              include: {
                department: {
                  select: {
                    name: true,
                    color: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: [
        { status: 'asc' },
        { user: { lastName: 'asc' } }
      ]
    })

    console.log(`📊 Found ${allPresence.length} staff presence records`)
    allPresence.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.user.firstName} ${p.user.lastName} - ${p.status} (start: ${p.startDate}, end: ${p.endDate})`)
    })

    // Check if each staff member is currently after hours
    // 'now' is already declared above at line 51
    const currentDay = now.getDay() // 0 = Sunday, 1 = Monday, etc.
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

    // Fetch office hours for all users
    const userIds = allPresence.map(p => p.userId)
    const officeHours = await prisma.officeHours.findMany({
      where: {
        userId: { in: userIds },
        isActive: true
      }
    })

    // Create a map of userId -> office hours
    const officeHoursMap = {}
    officeHours.forEach(oh => {
      if (!officeHoursMap[oh.userId]) {
        officeHoursMap[oh.userId] = []
      }
      officeHoursMap[oh.userId].push(oh)
    })

    // Add isAfterHours flag to each presence
    const presencesWithAfterHours = allPresence.map(presence => {
      const userOfficeHours = officeHoursMap[presence.userId] || []
      const todayHours = userOfficeHours.find(oh => oh.dayOfWeek === currentDay)

      let isAfterHours = false
      if (userOfficeHours.length > 0) {
        // User has office hours configured
        if (!todayHours) {
          // No office hours for today, so it's after hours
          isAfterHours = true
        } else {
          // Check if current time is outside office hours
          isAfterHours = currentTime < todayHours.startTime || currentTime > todayHours.endTime
        }
      }

      return {
        ...presence,
        isAfterHours
      }
    })

    // Deduplicate by user - only show one presence per user
    // Priority: VACATION/SICK > REMOTE/IN_OFFICE/AVAILABLE > Other
    const userPresenceMap = new Map()

    presencesWithAfterHours.forEach(presence => {
      const existing = userPresenceMap.get(presence.userId)

      if (!existing) {
        // First presence for this user
        userPresenceMap.set(presence.userId, presence)
      } else {
        // Multiple presences for same user - pick higher priority one
        const newPriority = getPresencePriority(presence.status)
        const existingPriority = getPresencePriority(existing.status)

        if (newPriority < existingPriority) {
          // Lower number = higher priority
          userPresenceMap.set(presence.userId, presence)
        } else if (newPriority === existingPriority) {
          // Same priority - pick the most recently created
          if (new Date(presence.createdAt) > new Date(existing.createdAt)) {
            userPresenceMap.set(presence.userId, presence)
          }
        }
      }
    })

    const uniquePresences = Array.from(userPresenceMap.values())

    console.log(`✅ Returning ${uniquePresences.length} unique staff presences to client`)
    uniquePresences.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.user.firstName} ${p.user.lastName} - ${p.status} at ${p.officeLocation || 'N/A'}`)
    })

    return NextResponse.json({ presences: uniquePresences })
  } catch (error) {
    console.error('Error fetching staff presence:', error)
    return NextResponse.json({ error: 'Failed to fetch staff presence' }, { status: 500 })
  }
}

// POST - Create or update staff presence
export async function POST(request) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { status, officeLocation, notes, startDate, endDate, userId } = body

    console.log('📋 Creating staff presence:', {
      userId: user.id,
      status,
      officeLocation,
      startDate,
      endDate,
      hasNotes: !!notes
    })

    // Validate required fields
    if (!status || !startDate) {
      return NextResponse.json(
        { error: 'Status and start date are required' },
        { status: 400 }
      )
    }

    // If IN_OFFICE or AVAILABLE, office location is required
    if ((status === 'IN_OFFICE' || status === 'AVAILABLE') && !officeLocation) {
      return NextResponse.json(
        { error: 'Office location is required when status is IN_OFFICE or AVAILABLE' },
        { status: 400 }
      )
    }

    // Users can only update their own presence
    const targetUserId = userId || user.id

    if (targetUserId !== user.id) {
      return NextResponse.json(
        { error: 'You can only update your own presence' },
        { status: 403 }
      )
    }

    // Note: When creating a new schedule, we deactivate any overlapping schedules
    // This prevents confusion and ensures the new schedule is what the user intends

    // Check for overlapping schedules and deactivate them
    const newStart = new Date(startDate)
    const newEnd = endDate ? new Date(endDate) : null

    // Find all schedules that overlap with the new one
    const overlappingSchedules = await prisma.staffPresence.findMany({
      where: {
        userId: targetUserId,
        isActive: true,
        OR: [
          // Existing schedule starts during new schedule
          {
            startDate: { gte: newStart },
            startDate: newEnd ? { lte: newEnd } : {}
          },
          // Existing schedule ends during new schedule
          {
            endDate: { gte: newStart },
            endDate: newEnd ? { lte: newEnd } : {}
          },
          // Existing schedule contains new schedule
          {
            startDate: { lte: newStart },
            OR: [
              { endDate: null },
              { endDate: newEnd ? { gte: newEnd } : { gte: newStart } }
            ]
          },
          // New schedule contains existing schedule (covered by above, but being explicit)
          newEnd ? {
            startDate: { gte: newStart },
            endDate: { lte: newEnd }
          } : {}
        ]
      }
    })

    // Deactivate overlapping schedules
    if (overlappingSchedules.length > 0) {
      await prisma.staffPresence.updateMany({
        where: {
          id: { in: overlappingSchedules.map(s => s.id) }
        },
        data: {
          isActive: false
        }
      })
    }

    // Create new presence record
    const presence = await prisma.staffPresence.create({
      data: {
        userId: targetUserId,
        status,
        officeLocation: (status === 'IN_OFFICE' || status === 'AVAILABLE') ? officeLocation : null,
        notes,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        isActive: true
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            jobTitle: true,
            avatar: true
          }
        }
      }
    })

    return NextResponse.json({ success: true, presence })
  } catch (error) {
    console.error('❌ Error creating staff presence:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    })
    return NextResponse.json({
      error: 'Failed to create staff presence',
      details: error.message
    }, { status: 500 })
  }
}

// DELETE - Delete a staff presence
export async function DELETE(request) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const presenceId = searchParams.get('id')

    if (!presenceId) {
      return NextResponse.json({ error: 'Presence ID is required' }, { status: 400 })
    }

    // Fetch the presence to check ownership
    const presence = await prisma.staffPresence.findUnique({
      where: { id: presenceId }
    })

    if (!presence) {
      return NextResponse.json({ error: 'Presence not found' }, { status: 404 })
    }

    // Check if user has permission to delete this presence
    // Only the user who created the schedule can delete it
    if (presence.userId !== user.id) {
      return NextResponse.json(
        { error: 'You can only delete your own presence' },
        { status: 403 }
      )
    }

    // Delete the presence (soft delete by setting isActive to false)
    await prisma.staffPresence.update({
      where: { id: presenceId },
      data: { isActive: false }
    })

    return NextResponse.json({ success: true, message: 'Schedule deleted successfully' })
  } catch (error) {
    console.error('Error deleting staff presence:', error)
    return NextResponse.json({ error: 'Failed to delete staff presence' }, { status: 500 })
  }
}
