/**
 * Admin routes for managing presence status types
 *
 * POST /api/presence/admin/status - Create new status
 * PATCH /api/presence/admin/status - Update status (isActive, etc.)
 *
 * Requires: Admin role
 * Features: Cache busting after mutations
 */

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { isAdmin } from '@/lib/role-utils'
import { prisma } from '@/lib/prisma'
import { bustRegistryCache } from '@/lib/presence/registry'
import { logEvent } from '@/lib/audit/logger'
import { z } from 'zod'

const CreateStatusSchema = z.object({
  code: z.string().min(1).max(50),
  label: z.string().min(1).max(100),
  category: z.string().default('presence'),
  requiresOffice: z.boolean().default(false),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().optional(),
  isActive: z.boolean().default(true),
})

const UpdateStatusSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1).max(100).optional(),
  category: z.string().optional(),
  requiresOffice: z.boolean().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().optional(),
  isActive: z.boolean().optional(),
})

export async function POST(request: Request) {
  try {
    // 1. Authentication & Authorization
    const currentUser = await getCurrentUser(request)

    if (!currentUser || !isAdmin(currentUser)) {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }

    // 2. Parse and validate
    const body = await request.json()
    const validated = CreateStatusSchema.parse(body)

    // 3. Check if code already exists
    const existing = await prisma.presenceStatusType.findUnique({
      where: { code: validated.code },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Status code already exists' },
        { status: 409 }
      )
    }

    // 4. Create status
    const status = await prisma.presenceStatusType.create({
      data: validated,
    })

    // 5. Bust cache
    bustRegistryCache()

    // 6. Audit log
    await logEvent({
      action: 'presence.admin.create_status',
      entityType: 'presence_status_type',
      entityId: status.id,
      actorEmail: currentUser.email,
      actorId: currentUser.id,
      actorType: 'human',
      newValues: validated,
      redactionLevel: 1,
    })

    return NextResponse.json({ success: true, status })
  } catch (error: any) {
    console.error('❌ Error creating status:', error)

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 422 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create status', details: error.message },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    // 1. Authentication & Authorization
    const currentUser = await getCurrentUser(request)

    if (!currentUser || !isAdmin(currentUser)) {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }

    // 2. Parse and validate
    const body = await request.json()
    const validated = UpdateStatusSchema.parse(body)

    const { id, ...updateData } = validated

    // 3. Update status
    const status = await prisma.presenceStatusType.update({
      where: { id },
      data: updateData,
    })

    // 4. Bust cache
    bustRegistryCache()

    // 5. Audit log
    await logEvent({
      action: 'presence.admin.update_status',
      entityType: 'presence_status_type',
      entityId: status.id,
      actorEmail: currentUser.email,
      actorId: currentUser.id,
      actorType: 'human',
      newValues: updateData,
      redactionLevel: 1,
    })

    return NextResponse.json({ success: true, status })
  } catch (error: any) {
    console.error('❌ Error updating status:', error)

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 422 }
      )
    }

    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Status not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update status', details: error.message },
      { status: 500 }
    )
  }
}
