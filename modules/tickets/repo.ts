/**
 * Tickets Repository Interface
 * Phase 2 Scaffold - Phase 3 Implementation
 * NO Prisma imports - interface only
 */

import { CreateTicketDTO, TicketDTO, TicketFilters, UpdateTicketDTO } from './domain'

export interface TicketRepository {
  create(data: CreateTicketDTO): Promise<TicketDTO>
  findById(id: string): Promise<TicketDTO | null>
  findByNumber(ticketNumber: string): Promise<TicketDTO | null>
  list(filters: TicketFilters, skip: number, take: number): Promise<TicketDTO[]>
  count(filters: TicketFilters): Promise<number>
  update(id: string, data: UpdateTicketDTO): Promise<TicketDTO>
  delete(id: string): Promise<void>
}
