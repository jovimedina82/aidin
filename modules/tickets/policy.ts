/**
 * Tickets Policy/Authorization
 * Phase 4 Implementation - Real authorization guards
 */

import { TicketDTO } from './domain'
import { users } from '@/modules'

/**
 * User type for policy checks
 * Matches the shape returned by auth middleware
 */
export interface PolicyUser {
  id: string
  email: string
  roles: string[]
}

/**
 * Check if user can create tickets
 * Phase 4: ADMIN ✅, STAFF ✅, CLIENT ✅
 */
export function canCreate(user: PolicyUser): boolean {
  if (!user || !user.roles || user.roles.length === 0) {
    return false
  }

  // All authenticated users with roles can create tickets
  // RBAC will enforce TICKET_CREATE permission
  const userDTO = {
    id: user.id,
    email: user.email,
    roles: user.roles as users.Role[],
    firstName: '',
    lastName: '',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  return users.rbac.can(userDTO, users.rbac.Action.TICKET_CREATE)
}

/**
 * Check if user can view a specific ticket
 * Phase 4: ADMIN ✅, STAFF ✅, CLIENT ✅ (if ticket.requesterId === user.id)
 */
export function canView(user: PolicyUser, ticket: TicketDTO): boolean {
  if (!user || !user.roles || user.roles.length === 0) {
    return false
  }

  const userDTO = {
    id: user.id,
    email: user.email,
    roles: user.roles as users.Role[],
    firstName: '',
    lastName: '',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  // Use RBAC canOn for resource ownership checking
  return users.rbac.canOn(userDTO, users.rbac.Action.TICKET_READ, ticket)
}

// Legacy functions (still stubbed for future phases)
export function canViewTicket(user: any, ticket: TicketDTO): boolean {
  // Delegate to new canView function
  return canView(user, ticket)
}

export function canUpdateTicket(user: any, ticket: TicketDTO): boolean {
  // TODO: Future phase - Implement update authorization logic
  return false
}

export function canDeleteTicket(user: any, ticket: TicketDTO): boolean {
  // TODO: Future phase - Implement delete authorization logic
  return false
}

export function canAssignTicket(user: any, ticket: TicketDTO): boolean {
  // TODO: Future phase - Implement assign authorization logic
  return false
}

/**
 * Check if user can transition a ticket to a new status
 * Phase 8: ADMIN/STAFF can transition any ticket; CLIENT can only close their own tickets
 */
export function canTransition(
  user: PolicyUser,
  ticket: TicketDTO,
  nextStatus: any
): boolean {
  if (!user || !user.roles || user.roles.length === 0) {
    return false
  }

  const userDTO = {
    id: user.id,
    email: user.email,
    roles: user.roles as users.Role[],
    firstName: '',
    lastName: '',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  // Check if user has TICKET_UPDATE permission
  if (!users.rbac.can(userDTO, users.rbac.Action.TICKET_UPDATE)) {
    return false
  }

  const hasStaffRole = user.roles.some((r) =>
    ['Admin', 'Staff', 'Manager'].includes(r)
  )

  // ADMIN/STAFF can transition any ticket
  if (hasStaffRole) {
    return true
  }

  // CLIENT can only transition their own tickets to CLOSED
  const isOwner = ticket.requesterId === user.id
  const isClosing = nextStatus === 'CLOSED'

  return isOwner && isClosing
}

/**
 * Check if user can assign a ticket
 * Phase 8: ADMIN/STAFF can assign any ticket; CLIENT cannot assign
 */
export function canAssign(
  user: PolicyUser,
  ticket: TicketDTO,
  assigneeId: string | null
): boolean {
  if (!user || !user.roles || user.roles.length === 0) {
    return false
  }

  const userDTO = {
    id: user.id,
    email: user.email,
    roles: user.roles as users.Role[],
    firstName: '',
    lastName: '',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  // Check if user has TICKET_ASSIGN permission
  if (!users.rbac.can(userDTO, users.rbac.Action.TICKET_ASSIGN)) {
    return false
  }

  const hasStaffRole = user.roles.some((r) =>
    ['Admin', 'Staff', 'Manager'].includes(r)
  )

  // Only ADMIN/STAFF can assign
  return hasStaffRole
}
