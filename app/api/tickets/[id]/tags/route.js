import { NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"

// GET - Get tags for a specific ticket
export async function GET(request, { params }) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ticketId = params.id

    const ticketTags = await prisma.ticketTag.findMany({
      where: { ticketId },
      include: {
        tag: true
      }
    })

    const tags = ticketTags.map(tt => tt.tag)

    return NextResponse.json({ tags })
  } catch (error) {
    console.error('Error fetching ticket tags:', error)
    return NextResponse.json({ error: 'Failed to fetch ticket tags' }, { status: 500 })
  }
}

// POST - Add or replace tags for a ticket
export async function POST(request, { params }) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ticketId = params.id
    const body = await request.json()
    const { tagIds, mode = 'replace' } = body // mode can be 'replace' or 'add'

    if (!Array.isArray(tagIds)) {
      return NextResponse.json(
        { error: 'tagIds must be an array' },
        { status: 400 }
      )
    }

    // Check if user has permission to update this ticket
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { assigneeId: true, requesterId: true }
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    const isAdmin = user.roles?.some(role =>
      ['Admin', 'Manager', 'Staff'].includes(role.role?.name || role.name)
    )

    const isAssigneeOrRequester = ticket.assigneeId === user.id || ticket.requesterId === user.id

    if (!isAdmin && !isAssigneeOrRequester) {
      return NextResponse.json(
        { error: 'You do not have permission to update tags for this ticket' },
        { status: 403 }
      )
    }

    if (mode === 'replace') {
      // Remove all existing tags for this ticket
      await prisma.ticketTag.deleteMany({
        where: { ticketId }
      })
    }

    // Add new tags
    if (tagIds.length > 0) {
      await prisma.ticketTag.createMany({
        data: tagIds.map(tagId => ({
          ticketId,
          tagId,
          addedBy: user.id
        })),
        skipDuplicates: true
      })

      // Increment usage count for each tag
      await prisma.tag.updateMany({
        where: { id: { in: tagIds } },
        data: { usageCount: { increment: 1 } }
      })
    }

    // Fetch and return updated tags
    const ticketTags = await prisma.ticketTag.findMany({
      where: { ticketId },
      include: {
        tag: true
      }
    })

    const tags = ticketTags.map(tt => tt.tag)

    return NextResponse.json({ success: true, tags })
  } catch (error) {
    console.error('Error updating ticket tags:', error)
    return NextResponse.json({ error: 'Failed to update ticket tags' }, { status: 500 })
  }
}

// DELETE - Remove a specific tag from a ticket
export async function DELETE(request, { params }) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ticketId = params.id
    const { searchParams } = new URL(request.url)
    const tagId = searchParams.get('tagId')

    if (!tagId) {
      return NextResponse.json({ error: 'Tag ID is required' }, { status: 400 })
    }

    // Check if user has permission to update this ticket
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { assigneeId: true, requesterId: true }
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    const isAdmin = user.roles?.some(role =>
      ['Admin', 'Manager', 'Staff'].includes(role.role?.name || role.name)
    )

    const isAssigneeOrRequester = ticket.assigneeId === user.id || ticket.requesterId === user.id

    if (!isAdmin && !isAssigneeOrRequester) {
      return NextResponse.json(
        { error: 'You do not have permission to update tags for this ticket' },
        { status: 403 }
      )
    }

    await prisma.ticketTag.deleteMany({
      where: {
        ticketId,
        tagId
      }
    })

    return NextResponse.json({ success: true, message: 'Tag removed from ticket' })
  } catch (error) {
    console.error('Error removing ticket tag:', error)
    return NextResponse.json({ error: 'Failed to remove ticket tag' }, { status: 500 })
  }
}
