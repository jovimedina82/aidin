/**
 * DELETE /api/presence/segment/:id
 *
 * Delete a single segment.
 * Authorization: Must be owner or admin.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { isRequester, canEditSchedule } from '@/lib/role-utils'
import { prisma } from '@/lib/prisma'
import { logEvent } from '@/lib/audit/logger'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Authentication
    const currentUser = await getCurrentUser(request)

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const segmentId = params.id

    // 2. Fetch segment
    const segment = await prisma.staffPresence.findUnique({
      where: { id: segmentId },
      include: {
        status: { select: { label: true } },
      },
    })

    if (!segment) {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 })
    }

    // 3. Authorization: Requesters cannot delete, Staff can delete own, Admins can delete any
    if (isRequester(currentUser)) {
      return NextResponse.json(
        { error: 'Forbidden: Requesters cannot delete schedules' },
        { status: 403 }
      )
    }

    if (!canEditSchedule(currentUser, segment.userId)) {
      return NextResponse.json(
        { error: 'Forbidden: You can only delete your own segments' },
        { status: 403 }
      )
    }

    // 4. Delete segment
    await prisma.staffPresence.delete({
      where: { id: segmentId },
    })

    // 5. Audit log
    await logEvent({
      action: 'presence.delete_segment',
      entityType: 'user',
      entityId: segmentId,
      actorEmail: currentUser.email,
      actorId: currentUser.id,
      actorType: 'human',
      prevValues: {
        status: segment.status.label,
        startAt: segment.startAt,
        endAt: segment.endAt,
      },
      metadata: {
        targetUserId: segment.userId,
      },
      redactionLevel: 1,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('❌ Error deleting segment:', error)

    return NextResponse.json(
      {
        error: 'Failed to delete segment',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
