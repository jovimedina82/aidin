/**
 * Comments Service Layer
 * Phase 7: Business logic orchestration with policy checks
 */

import { CommentDTO, CreateCommentDTO, UpdateCommentDTO, CreateCommentInput, ListCommentsOptions, CommentVisibility } from './domain'
import * as repo from './repo'
import * as policy from './policy'
import * as tickets from '../tickets'
import type { PolicyUser } from './policy'

/**
 * Add a comment to a ticket
 *
 * @throws Error if user cannot create comment with given visibility
 * @throws Error if ticket not found
 */
export async function add(
  ticketId: string,
  user: PolicyUser,
  input: CreateCommentInput
): Promise<CommentDTO> {
  // Fetch ticket to check ownership
  const ticket = await tickets.service.get(user, ticketId)
  if (!ticket) {
    throw new Error('Ticket not found')
  }

  // Determine visibility (default to public)
  let visibility: CommentVisibility = 'public'
  if (input.visibility) {
    visibility = input.visibility
  } else if (input.isInternal === true) {
    visibility = 'internal'
  }

  // Check policy: can user create comment with this visibility?
  const canCreateComment = policy.canCreate(
    user,
    { id: ticket.id, requesterId: ticket.requesterId },
    visibility
  )

  if (!canCreateComment) {
    throw new Error('Forbidden: Cannot create comment with this visibility')
  }

  // Get content
  const body = input.content || input.body || ''

  // Create comment via repo
  return repo.create(ticketId, user.id, body, visibility)
}

/**
 * List comments for a ticket
 *
 * Filters based on user permissions:
 * - ADMIN/STAFF: sees all comments (public + internal)
 * - CLIENT: only sees public comments on tickets they own
 *
 * @throws Error if ticket not found
 */
export async function list(
  ticketId: string,
  user: PolicyUser
): Promise<CommentDTO[]> {
  // Fetch ticket to check ownership
  const ticket = await tickets.service.get(user, ticketId)
  if (!ticket) {
    throw new Error('Ticket not found')
  }

  // Determine if user can see internal comments
  const hasStaffRole = user.roles.some((r) =>
    ['Admin', 'Staff', 'Manager'].includes(r)
  )

  // ADMIN/STAFF can see all comments
  if (hasStaffRole) {
    return repo.listByTicket(ticketId, { includeInternal: true })
  }

  // CLIENT can only see public comments on tickets they own
  const isOwner = ticket.requesterId === user.id
  if (!isOwner) {
    throw new Error('Forbidden: Cannot view comments on this ticket')
  }

  // Return only public comments
  return repo.listByTicket(ticketId, { includeInternal: false })
}

// Legacy functions preserved for backward compatibility
export async function addComment(data: CreateCommentDTO): Promise<CommentDTO> {
  throw new Error('NotImplemented: addComment() - Phase 3 (replaced by add() in Phase 7)')
}

export async function listComments(ticketId: string): Promise<CommentDTO[]> {
  throw new Error('NotImplemented: listComments() - Phase 3 (replaced by list() in Phase 7)')
}

export async function updateComment(id: string, data: UpdateCommentDTO): Promise<CommentDTO> {
  throw new Error('NotImplemented: updateComment() - Phase 3')
}

export async function deleteComment(id: string): Promise<void> {
  throw new Error('NotImplemented: deleteComment() - Phase 3')
}
