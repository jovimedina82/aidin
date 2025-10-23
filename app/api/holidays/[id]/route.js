import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

// PATCH /api/holidays/[id] - Update a holiday (Admin only)
export async function PATCH(request, { params }) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    // Check if user is admin
    const isAdmin = user.roles?.some(role => ['Admin', 'Manager'].includes(role.role?.name || role.name))
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { id } = params
    const body = await request.json()
    const { name, description, startDate, endDate, isActive } = body

    // Build update data
    const updateData = { updatedAt: new Date() }

    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (isActive !== undefined) updateData.isActive = isActive

    if (startDate !== undefined) {
      const start = new Date(startDate)
      if (isNaN(start.getTime())) {
        return NextResponse.json({ error: 'Invalid start date' }, { status: 400 })
      }
      updateData.startDate = start
    }

    if (endDate !== undefined) {
      const end = new Date(endDate)
      if (isNaN(end.getTime())) {
        return NextResponse.json({ error: 'Invalid end date' }, { status: 400 })
      }
      updateData.endDate = end
    }

    // Update holiday
    const holiday = await prisma.holiday.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json({
      success: true,
      message: 'Holiday updated successfully',
      holiday
    })
  } catch (error) {
    console.error('Error updating holiday:', error)
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Holiday not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to update holiday' }, { status: 500 })
  }
}

// DELETE /api/holidays/[id] - Delete a holiday (Admin only)
export async function DELETE(request, { params }) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    // Check if user is admin
    const isAdmin = user.roles?.some(role => ['Admin', 'Manager'].includes(role.role?.name || role.name))
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { id } = params

    // Delete holiday
    await prisma.holiday.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: 'Holiday deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting holiday:', error)
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Holiday not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to delete holiday' }, { status: 500 })
  }
}
