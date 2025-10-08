/**
 * Tickets Workflow Layer
 * Phase 8: Status transitions and auto-assignment orchestration
 */

import { Status, TicketDTO, StatusTransitionMap } from './domain'
import * as policy from './policy'
import * as repo from './repo'
import { config } from '@/lib/config'

/**
 * Allowed status transitions map
 * Phase 8: Defines valid state machine transitions
 */
export const ALLOWED_TRANSITIONS: StatusTransitionMap = {
  [Status.NEW]: [Status.OPEN, Status.CLOSED],
  [Status.OPEN]: [Status.PENDING, Status.ON_HOLD, Status.SOLVED, Status.CLOSED],
  [Status.PENDING]: [Status.OPEN, Status.SOLVED],
  [Status.ON_HOLD]: [Status.OPEN, Status.SOLVED],
  [Status.SOLVED]: [Status.CLOSED, Status.OPEN],
  [Status.CLOSED]: [], // Terminal state - no transitions allowed
}

/**
 * Check if a status transition is valid
 */
export function isValidTransition(
  currentStatus: Status,
  nextStatus: Status
): boolean {
  const allowedNextStates = ALLOWED_TRANSITIONS[currentStatus] || []
  return allowedNextStates.includes(nextStatus)
}

/**
 * Transition a ticket to a new status
 *
 * @throws Error if transition is invalid or user lacks permission
 */
export async function transition(
  currentUser: policy.PolicyUser,
  ticket: TicketDTO,
  nextStatus: Status
): Promise<TicketDTO> {
  // Check if user can transition
  if (!policy.canTransition(currentUser, ticket, nextStatus)) {
    throw new Error('Forbidden: Cannot transition this ticket')
  }

  // Validate transition is allowed by state machine
  if (!isValidTransition(ticket.status, nextStatus)) {
    throw new Error(
      `Invalid transition: Cannot move from ${ticket.status} to ${nextStatus}`
    )
  }

  // Determine if we need to set/clear resolvedAt
  const opts: { resolvedAt?: Date | null } = {}

  // Set resolvedAt when moving TO SOLVED
  if (nextStatus === Status.SOLVED && ticket.status !== Status.SOLVED) {
    opts.resolvedAt = new Date()
  }

  // Clear resolvedAt when moving OFF SOLVED
  if (ticket.status === Status.SOLVED && nextStatus !== Status.SOLVED) {
    opts.resolvedAt = null
  }

  // Update status via repository
  return repo.updateStatus(ticket.id, nextStatus, opts)
}

/**
 * Auto-assign a ticket to an agent
 *
 * Strategy:
 * 1. If AUTO_ASSIGN_ENABLED is false, do nothing
 * 2. If ticket already has assignee, do nothing
 * 3. Otherwise, choose agent via simple strategy:
 *    - Requester's last handler (stub: not implemented)
 *    - Fallback to round-robin (stub: returns first admin/staff)
 */
export async function autoAssign(
  currentUser: policy.PolicyUser,
  ticket: TicketDTO
): Promise<TicketDTO> {
  // Check feature flag
  if (!config.AUTO_ASSIGN_ENABLED) {
    return ticket
  }

  // Skip if already assigned
  if (ticket.assigneeId) {
    return ticket
  }

  // Simple stub strategy: return a deterministic mock agent ID
  // In production, this would query for available agents
  const mockAgentId = 'auto-assigned-agent-1'

  // Update assignee via repository
  return repo.updateAssignee(ticket.id, mockAgentId)
}

/**
 * Assign a ticket to a specific agent
 *
 * @throws Error if user lacks permission
 */
export async function assign(
  currentUser: policy.PolicyUser,
  ticket: TicketDTO,
  assigneeId: string | null
): Promise<TicketDTO> {
  // Check if user can assign
  if (!policy.canAssign(currentUser, ticket, assigneeId)) {
    throw new Error('Forbidden: Cannot assign this ticket')
  }

  // Update assignee via repository
  return repo.updateAssignee(ticket.id, assigneeId)
}
