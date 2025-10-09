import { NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"
import { logEvent } from '@/lib/audit'


export async function GET(request, { params }) {
  try {
    const comments = await prisma.ticketComment.findMany({
      where: {
        ticketId: params.id
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    return NextResponse.json(comments)
  } catch (error) {
    console.error('Error fetching comments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    )
  }
}

export async function POST(request, { params }) {
  try {
    // Get the authenticated user
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const data = await request.json()

    // Get ticket info for audit log
    const ticket = await prisma.ticket.findUnique({
      where: { id: params.id },
      select: { ticketNumber: true }
    })

    const comment = await prisma.ticketComment.create({
      data: {
        ticketId: params.id,
        userId: user.id,
        content: data.content,
        isPublic: data.isInternal ? false : true // Convert isInternal to isPublic
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    })

    // Log comment creation to audit trail
    await logEvent({
      action: 'comment.created',
      actorId: user.id,
      actorEmail: user.email,
      actorType: 'human',
      entityType: 'comment',
      entityId: comment.id,
      targetId: params.id,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || null,
      newValues: {
        ticketId: params.id,
        isPublic: comment.isPublic,
        contentLength: data.content?.length || 0,
        contentPreview: data.content?.substring(0, 200) || ''
      },
      metadata: {
        isInternal: data.isInternal || false,
        ticketNumber: ticket?.ticketNumber || 'unknown',
        commentSummary: data.content?.substring(0, 200) || ''
      }
    })

    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    console.error('Error creating comment:', error)
    return NextResponse.json(
      { error: 'Failed to create comment' },
      { status: 500 }
    )
  }
}