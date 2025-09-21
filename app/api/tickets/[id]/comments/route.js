import { NextResponse } from 'next/server'
import { PrismaClient } from '../../../../../lib/generated/prisma/index.js'
import { getCurrentUser } from '../../../../../lib/auth.js'

const prisma = new PrismaClient()

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

    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    console.error('Error creating comment:', error)
    return NextResponse.json(
      { error: 'Failed to create comment' },
      { status: 500 }
    )
  }
}