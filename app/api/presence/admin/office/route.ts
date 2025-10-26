/**
 * Admin routes for managing office locations
 *
 * POST /api/presence/admin/office - Create new office
 * PATCH /api/presence/admin/office - Update office (isActive, etc.)
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

const CreateOfficeSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  isActive: z.boolean().default(true),
})

const UpdateOfficeSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
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
    const validated = CreateOfficeSchema.parse(body)

    // 3. Check if code already exists
    const existing = await prisma.presenceOfficeLocation.findUnique({
      where: { code: validated.code },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Office code already exists' },
        { status: 409 }
      )
    }

    // 4. Create office
    const office = await prisma.presenceOfficeLocation.create({
      data: validated,
    })

    // 5. Bust cache
    bustRegistryCache()

    // 6. Audit log
    await logEvent({
      action: 'presence.admin.create_office',
      entityType: 'setting',
      entityId: office.id,
      actorEmail: currentUser.email,
      actorId: currentUser.id,
      actorType: 'human',
      newValues: validated,
      redactionLevel: 1,
    })

    return NextResponse.json({ success: true, office })
  } catch (error: any) {
    console.error('❌ Error creating office:', error)

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 422 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create office', details: error.message },
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
    const validated = UpdateOfficeSchema.parse(body)

    const { id, ...updateData } = validated

    // 3. Update office
    const office = await prisma.presenceOfficeLocation.update({
      where: { id },
      data: updateData,
    })

    // 4. Bust cache
    bustRegistryCache()

    // 5. Audit log
    await logEvent({
      action: 'presence.admin.update_office',
      entityType: 'setting',
      entityId: office.id,
      actorEmail: currentUser.email,
      actorId: currentUser.id,
      actorType: 'human',
      newValues: updateData,
      redactionLevel: 1,
    })

    return NextResponse.json({ success: true, office })
  } catch (error: any) {
    console.error('❌ Error updating office:', error)

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 422 }
      )
    }

    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Office not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update office', details: error.message },
      { status: 500 }
    )
  }
}
