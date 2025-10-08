/**
 * Tickets Repository Interface
 * Phase 2 Scaffold - Phase 3 Implementation - Phase 8 Extensions
 * NO Prisma imports - interface only
 */

import { CreateTicketDTO, TicketDTO, TicketFilters, UpdateTicketDTO, Status } from './domain'

export interface TicketRepository {
  create(data: CreateTicketDTO): Promise<TicketDTO>
  findById(id: string): Promise<TicketDTO | null>
  findByNumber(ticketNumber: string): Promise<TicketDTO | null>
  list(filters: TicketFilters, skip: number, take: number): Promise<TicketDTO[]>
  count(filters: TicketFilters): Promise<number>
  update(id: string, data: UpdateTicketDTO): Promise<TicketDTO>
  delete(id: string): Promise<void>
}

// Phase 8: Re-export implementation functions
export { create, findById, updateStatus, updateAssignee } from './repo.impl'
