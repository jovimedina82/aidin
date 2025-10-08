/**
 * Tickets Domain Types and DTOs
 * Phase 2 Scaffold
 */

export enum Status {
  NEW = 'NEW',
  OPEN = 'OPEN',
  PENDING = 'PENDING',
  ON_HOLD = 'ON_HOLD',
  SOLVED = 'SOLVED',
  CLOSED = 'CLOSED',
}

export enum Priority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export interface TicketDTO {
  id: string
  ticketNumber: string
  title: string
  description: string
  status: Status
  priority: Priority
  category?: string
  requesterId: string
  assigneeId?: string
  parentTicketId?: string
  createdAt: Date
  updatedAt: Date
  resolvedAt?: Date
}

export interface CreateTicketDTO {
  title: string
  description: string
  priority?: Priority
  category?: string
  requesterId: string
  assigneeId?: string
}

export interface UpdateTicketDTO {
  title?: string
  description?: string
  status?: Status
  priority?: Priority
  category?: string
  assigneeId?: string
}

export interface TicketFilters {
  status?: Status[]
  priority?: Priority[]
  assigneeId?: string
  requesterId?: string
  category?: string
  search?: string
}

// Phase 8: Workflow types
export interface StatusTransitionInput {
  status: Status
}

export interface AssignmentInput {
  assigneeId: string | null
}

export type StatusTransitionMap = {
  [K in Status]: Status[]
}
