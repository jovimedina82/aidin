/**
 * Tickets Repository Implementation
 * Phase 4 Implementation - Prisma data access layer
 */

import { prisma } from '@/lib/prisma.js'
import { CreateTicketDTO, TicketDTO, Status, Priority } from './domain'

// Phase 8: Status update options
interface UpdateStatusOptions {
  resolvedAt?: Date | null
}

/**
 * Generate next ticket number
 * Format: T-YYYYMMDD-XXXX (e.g., T-20251007-0001)
 */
async function generateTicketNumber(): Promise<string> {
  const today = new Date()
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')

  // Find the highest ticket number for today
  const latestTicket = await prisma.ticket.findFirst({
    where: {
      ticketNumber: {
        startsWith: `T-${dateStr}`,
      },
    },
    orderBy: {
      ticketNumber: 'desc',
    },
  })

  let sequence = 1
  if (latestTicket) {
    const parts = latestTicket.ticketNumber.split('-')
    if (parts.length === 3) {
      sequence = parseInt(parts[2], 10) + 1
    }
  }

  const sequenceStr = sequence.toString().padStart(4, '0')
  return `T-${dateStr}-${sequenceStr}`
}

/**
 * Map Prisma ticket to TicketDTO
 */
function mapPrismaTicketToDTO(ticket: any): TicketDTO {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    title: ticket.title,
    description: ticket.description,
    status: ticket.status as Status,
    priority: ticket.priority as Priority,
    category: ticket.category,
    requesterId: ticket.requesterId,
    assigneeId: ticket.assigneeId,
    parentTicketId: ticket.parentTicketId,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    resolvedAt: ticket.resolvedAt,
  }
}

/**
 * Create a new ticket
 * @param data Ticket creation data with requesterId
 * @returns Created ticket DTO
 */
export async function create(
  data: CreateTicketDTO & { requesterId: string }
): Promise<TicketDTO> {
  const ticketNumber = await generateTicketNumber()

  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber,
      title: data.title,
      description: data.description,
      priority: data.priority || 'NORMAL',
      category: data.category,
      requesterId: data.requesterId,
      assigneeId: data.assigneeId,
      status: 'NEW',
    },
  })

  return mapPrismaTicketToDTO(ticket)
}

/**
 * Find ticket by ID
 * @param id Ticket ID
 * @returns Ticket DTO or null if not found
 */
export async function findById(id: string): Promise<TicketDTO | null> {
  const ticket = await prisma.ticket.findUnique({
    where: { id },
  })

  if (!ticket) {
    return null
  }

  return mapPrismaTicketToDTO(ticket)
}

/**
 * Update ticket status
 * Phase 8: For workflow transitions with optional resolvedAt handling
 * @param id Ticket ID
 * @param status New status
 * @param opts Optional fields (resolvedAt)
 * @returns Updated ticket DTO
 */
export async function updateStatus(
  id: string,
  status: Status,
  opts?: UpdateStatusOptions
): Promise<TicketDTO> {
  const updateData: any = {
    status,
    updatedAt: new Date(),
  }

  // Handle resolvedAt if provided in options
  if (opts && 'resolvedAt' in opts) {
    updateData.resolvedAt = opts.resolvedAt
  }

  const ticket = await prisma.ticket.update({
    where: { id },
    data: updateData,
  })

  return mapPrismaTicketToDTO(ticket)
}

/**
 * Update ticket assignee
 * Phase 8: For assignment workflows
 * @param id Ticket ID
 * @param assigneeId New assignee ID or null to unassign
 * @returns Updated ticket DTO
 */
export async function updateAssignee(
  id: string,
  assigneeId: string | null
): Promise<TicketDTO> {
  const ticket = await prisma.ticket.update({
    where: { id },
    data: {
      assigneeId,
      updatedAt: new Date(),
    },
  })

  return mapPrismaTicketToDTO(ticket)
}
