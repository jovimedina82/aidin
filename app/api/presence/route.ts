import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireModule } from '@/lib/auth/guards'
import { UpdatePresenceSchema } from '@/lib/validation/presence'
import { withAppRouterAudit } from '@/lib/audit/middleware'
import { logEvent } from '@/lib/audit/logger'
import { ZodError } from 'zod'

/**
 * POST /api/presence - Update staff presence
 * Requires: staff-directory module access (Admin/Manager bypass)
 * Features: Zod validation, module guards, audit logging, timezone-safe dates
 */
export async function POST(request: Request) {
  try {
    // 1) Auth + Module Guard (admin bypass)
    const user = await requireModule(request, 'staff-directory')

    // 2) Parse and validate request body
    const body = await request.json()
    let validated

    try {
      validated = UpdatePresenceSchema.parse(body)
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: error.errors.map((e) => ({
              field: e.path.join('.'),
              message: e.message
            }))
          },
          { status: 422 }
        )
      }
      throw error
    }

    // 3) Run handler with audit context
    return await withAppRouterAudit(async (req, currentUser) => {
      const { status, officeLocation, notes, startDate, endDate } = validated

      // Check for overlapping schedules and deactivate them
      const newStart = new Date(startDate)
      const newEnd = endDate ? new Date(endDate) : null

      // Find overlapping active schedules
      const overlappingSchedules = await prisma.staffPresence.findMany({
        where: {
          userId: currentUser.id,
          isActive: true,
          OR: [
            // Existing schedule starts during new schedule
            newEnd ? {
              AND: [
                { startDate: { gte: newStart } },
                { startDate: { lte: newEnd } }
              ]
            } : { startDate: { gte: newStart } },
            // Existing schedule ends during new schedule
            newEnd ? {
              AND: [
                { endDate: { gte: newStart } },
                { endDate: { lte: newEnd } }
              ]
            } : { endDate: { gte: newStart } },
            // Existing schedule contains new schedule
            {
              startDate: { lte: newStart },
              OR: [
                { endDate: null },
                { endDate: newEnd ? { gte: newEnd } : { gte: newStart } }
              ]
            }
          ]
        }
      })

      // Use transaction to ensure atomic update
      const presence = await prisma.$transaction(async (tx) => {
        // Deactivate overlapping schedules
        if (overlappingSchedules.length > 0) {
          await tx.staffPresence.updateMany({
            where: {
              id: { in: overlappingSchedules.map(s => s.id) }
            },
            data: { isActive: false }
          })
        }

        // Create new presence record
        return await tx.staffPresence.create({
          data: {
            userId: currentUser.id,
            status,
            officeLocation: (status === 'IN_OFFICE' || status === 'AVAILABLE') ? officeLocation : null,
            notes: notes || null,
            startDate: newStart,
            endDate: newEnd,
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
      })

      // 4) Audit log
      await logEvent({
        action: 'staff_presence.update',
        entityType: 'setting',
        entityId: presence.id,
        actorEmail: currentUser.email,
        actorId: currentUser.id,
        actorType: 'human',
        newValues: {
          status,
          officeLocation,
          startDate,
          endDate,
          deactivatedCount: overlappingSchedules.length
        },
        metadata: {
          userId: currentUser.id,
          userName: `${currentUser.firstName} ${currentUser.lastName}`
        },
        redactionLevel: 1
      })

      return NextResponse.json({ success: true, presence })
    })(request, user)

  } catch (error: any) {
    // Handle auth/guard errors (these are already NextResponse objects)
    if (error instanceof NextResponse || error?.status) {
      return error
    }

    // Log unexpected errors
    console.error('❌ Error updating presence:', error)

    return NextResponse.json(
      {
        error: 'Failed to update presence',
        details: error.message
      },
      { status: 500 }
    )
  }
}
