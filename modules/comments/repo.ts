/**
 * Comments Repository Interface
 * Phase 2 Scaffold - Phase 3 Implementation
 * NO Prisma imports - interface only
 */

import { CommentDTO, CreateCommentDTO, UpdateCommentDTO } from './domain'

export interface CommentRepository {
  create(data: CreateCommentDTO): Promise<CommentDTO>
  findById(id: string): Promise<CommentDTO | null>
  listByTicketId(ticketId: string): Promise<CommentDTO[]>
  update(id: string, data: UpdateCommentDTO): Promise<CommentDTO>
  delete(id: string): Promise<void>
}
