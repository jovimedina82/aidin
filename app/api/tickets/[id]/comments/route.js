/**
 * Comments API Routes
 * Phase 7: Refactored to use modules/comments
 */

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import * as comments from '@/modules/comments'

/**
 * GET /api/tickets/:id/comments
 * List comments for a ticket (filtered by user permissions)
 */
export async function GET(request, { params }) {
  try {
    // Phase 3: Require authentication
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Phase 7: Use comments.service.list with policy checks
    try {
      const commentsList = await comments.service.list(params.id, {
        id: user.id,
        email: user.email,
        roles: user.roles,
      })

      return NextResponse.json(commentsList)
    } catch (error) {
      if (error.message === 'Ticket not found') {
        return NextResponse.json(
          { error: 'Ticket not found' },
          { status: 404 }
        )
      }
      if (error.message.includes('Forbidden')) {
        return NextResponse.json(
          { error: error.message },
          { status: 403 }
        )
      }
      throw error
    }
  } catch (error) {
    console.error('Error listing comments:', error)
    return NextResponse.json(
      { error: 'Failed to list comments' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/tickets/:id/comments
 * Add a comment to a ticket
 */
export async function POST(request, { params }) {
  try {
    // Phase 3: Require authentication
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Parse request body
    const data = await request.json()

    // Phase 7: Use comments.service.add with policy checks
    try {
      const comment = await comments.service.add(params.id, {
        id: user.id,
        email: user.email,
        roles: user.roles,
      }, {
        content: data.content,
        body: data.body,
        visibility: data.visibility,
        isInternal: data.isInternal,
      })

      return NextResponse.json(comment, { status: 201 })
    } catch (error) {
      if (error.message === 'Ticket not found') {
        return NextResponse.json(
          { error: 'Ticket not found' },
          { status: 404 }
        )
      }
      if (error.message.includes('Forbidden')) {
        return NextResponse.json(
          { error: error.message },
          { status: 403 }
        )
      }
      throw error
    }
  } catch (error) {
    console.error('Error creating comment:', error)
    return NextResponse.json(
      { error: 'Failed to create comment' },
      { status: 500 }
    )
  }
}