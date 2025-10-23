import { NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"

// PATCH - Update specific presence record
export async function PATCH(request, { params }) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const body = await request.json()
    const { status, officeLocation, notes, startDate, endDate, isActive } = body

    // Get the existing presence
    const existingPresence = await prisma.staffPresence.findUnique({
      where: { id }
    })

    if (!existingPresence) {
      return NextResponse.json({ error: 'Presence not found' }, { status: 404 })
    }

    // Check permissions
    const isAdmin = user.roles?.some(role =>
      ['Admin', 'Manager'].includes(role.role?.name || role.name)
    )

    if (existingPresence.userId !== user.id && !isAdmin) {
      return NextResponse.json(
        { error: 'You can only update your own presence' },
        { status: 403 }
      )
    }

    // If changing to IN_OFFICE, validate office location
    if (status === 'IN_OFFICE' && !officeLocation) {
      return NextResponse.json(
        { error: 'Office location is required when status is IN_OFFICE' },
        { status: 400 }
      )
    }

    // Update the presence
    const updatedPresence = await prisma.staffPresence.update({
      where: { id },
      data: {
        ...(status && { status }),
        officeLocation: status === 'IN_OFFICE' ? officeLocation : null,
        ...(notes !== undefined && { notes }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(isActive !== undefined && { isActive })
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

    return NextResponse.json({ success: true, presence: updatedPresence })
  } catch (error) {
    console.error('Error updating staff presence:', error)
    return NextResponse.json({ error: 'Failed to update staff presence' }, { status: 500 })
  }
}

// DELETE - Delete (deactivate) a presence record
export async function DELETE(request, { params }) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    // Get the existing presence
    const existingPresence = await prisma.staffPresence.findUnique({
      where: { id }
    })

    if (!existingPresence) {
      return NextResponse.json({ error: 'Presence not found' }, { status: 404 })
    }

    // Check permissions
    const isAdmin = user.roles?.some(role =>
      ['Admin', 'Manager'].includes(role.role?.name || role.name)
    )

    if (existingPresence.userId !== user.id && !isAdmin) {
      return NextResponse.json(
        { error: 'You can only delete your own presence' },
        { status: 403 }
      )
    }

    // Deactivate the presence (soft delete)
    await prisma.staffPresence.update({
      where: { id },
      data: { isActive: false }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting staff presence:', error)
    return NextResponse.json({ error: 'Failed to delete staff presence' }, { status: 500 })
  }
}
