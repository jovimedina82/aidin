/**
 * Comments Policy Layer
 * Phase 7: Authorization guards for comments
 */

import type { CommentVisibility } from './domain'
import * as users from '../users'

export interface PolicyUser {
  id: string
  email: string
  roles: string[]
}

export interface TicketContext {
  id: string
  requesterId: string
}

/**
 * Check if user can create a comment with given visibility
 *
 * Rules:
 * - ADMIN/STAFF: can create public or internal comments
 * - CLIENT: can only create public comments on tickets they own
 */
export function canCreate(
  user: PolicyUser,
  ticket: TicketContext,
  visibility: CommentVisibility
): boolean {
  if (!user || !user.roles || user.roles.length === 0) {
    return false
  }

  // Map to UserDTO for RBAC
  const userDTO: users.UserDTO = {
    id: user.id,
    email: user.email,
    roles: user.roles as users.Role[],
    firstName: '',
    lastName: '',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  // Check if user has COMMENT_CREATE permission
  if (!users.rbac.can(userDTO, users.rbac.Action.COMMENT_CREATE)) {
    return false
  }

  const hasStaffRole = user.roles.some((r) =>
    ['Admin', 'Staff', 'Manager'].includes(r)
  )

  // ADMIN/STAFF can create any visibility
  if (hasStaffRole) {
    return true
  }

  // CLIENT can only create public comments on tickets they own
  const isOwner = ticket.requesterId === user.id
  const isPublic = visibility === 'public'

  return isOwner && isPublic
}

/**
 * Check if user can read a comment with given visibility
 *
 * Rules:
 * - ADMIN/STAFF: can read all comments (public + internal)
 * - CLIENT: can only read public comments on tickets they own
 */
export function canRead(
  user: PolicyUser,
  ticket: TicketContext,
  visibility: CommentVisibility
): boolean {
  if (!user || !user.roles || user.roles.length === 0) {
    return false
  }

  // Map to UserDTO for RBAC
  const userDTO: users.UserDTO = {
    id: user.id,
    email: user.email,
    roles: user.roles as users.Role[],
    firstName: '',
    lastName: '',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  // Check if user has COMMENT_READ permission
  if (!users.rbac.can(userDTO, users.rbac.Action.COMMENT_READ)) {
    return false
  }

  const hasStaffRole = user.roles.some((r) =>
    ['Admin', 'Staff', 'Manager'].includes(r)
  )

  // ADMIN/STAFF can read all comments
  if (hasStaffRole) {
    return true
  }

  // CLIENT can only read public comments on tickets they own
  const isOwner = ticket.requesterId === user.id
  const isPublic = visibility === 'public'

  return isOwner && isPublic
}
