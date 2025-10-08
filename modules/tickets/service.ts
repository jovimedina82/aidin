/**
 * Tickets Service
 * Phase 4 Implementation - Pure orchestration layer
 */

import { CreateTicketDTO, TicketDTO, TicketFilters, UpdateTicketDTO } from './domain'
import * as repo from './repo.impl'
import * as policy from './policy'

/**
 * Create a new ticket
 * Phase 4: Validates authorization and delegates to repository
 *
 * @param currentUser Authenticated user from auth middleware
 * @param input Ticket creation data
 * @returns Created ticket DTO
 * @throws Error if user cannot create tickets
 */
export async function create(
  currentUser: policy.PolicyUser,
  input: Omit<CreateTicketDTO, 'requesterId'> & { requesterId?: string }
): Promise<TicketDTO> {
  // Policy check: Can user create tickets?
  if (!policy.canCreate(currentUser)) {
    throw new Error('FORBIDDEN: User does not have permission to create tickets')
  }

  // For clients, always set requesterId to current user
  // For staff/admin, use provided requesterId or default to current user
  const hasStaffRole = currentUser.roles.some((r) =>
    ['Admin', 'Staff', 'Manager'].includes(r)
  )

  const requesterId = hasStaffRole && input.requesterId
    ? input.requesterId
    : currentUser.id

  const data: CreateTicketDTO & { requesterId: string } = {
    title: input.title,
    description: input.description,
    priority: input.priority,
    category: input.category,
    assigneeId: input.assigneeId,
    requesterId,
  }

  // Delegate to repository
  return await repo.create(data)
}

/**
 * Get ticket by ID
 * Phase 4: Validates authorization and delegates to repository
 *
 * @param currentUser Authenticated user from auth middleware
 * @param id Ticket ID
 * @returns Ticket DTO or null if not found
 * @throws Error if user cannot view the ticket
 */
export async function get(
  currentUser: policy.PolicyUser,
  id: string
): Promise<TicketDTO | null> {
  // Fetch ticket from repository
  const ticket = await repo.findById(id)

  if (!ticket) {
    return null
  }

  // Policy check: Can user view this ticket?
  if (!policy.canView(currentUser, ticket)) {
    throw new Error('FORBIDDEN: User does not have permission to view this ticket')
  }

  return ticket
}

// Legacy functions (still stubbed for future phases)
export async function createTicket(data: CreateTicketDTO): Promise<TicketDTO> {
  throw new Error('NotImplemented: Use create() instead - Phase 4')
}

export async function getTicketById(id: string): Promise<TicketDTO | null> {
  throw new Error('NotImplemented: Use get() instead - Phase 4')
}

export async function listTickets(
  filters: TicketFilters,
  page: number,
  pageSize: number
): Promise<{ tickets: TicketDTO[]; total: number; page: number; pageSize: number }> {
  throw new Error('NotImplemented: listTickets() - Future phase')
}

export async function updateTicket(id: string, data: UpdateTicketDTO): Promise<TicketDTO> {
  throw new Error('NotImplemented: updateTicket() - Future phase')
}

export async function assignTicket(id: string, assigneeId: string): Promise<TicketDTO> {
  throw new Error('NotImplemented: assignTicket() - Future phase')
}
