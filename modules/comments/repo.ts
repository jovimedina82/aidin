/**
 * Comments Repository Layer
 * Phase 7: Prisma data access for comments
 */

import { CommentDTO, CreateCommentDTO, UpdateCommentDTO, CommentVisibility, ListCommentsOptions } from './domain'
import { prisma } from '@/lib/prisma'

/**
 * Map Prisma TicketComment to CommentDTO
 */
function mapPrismaCommentToDTO(
  comment: any
): CommentDTO {
  const visibility: CommentVisibility = comment.isPublic ? 'public' : 'internal'

  return {
    id: comment.id,
    ticketId: comment.ticketId,
    userId: comment.userId,
    authorId: comment.userId, // Alias
    content: comment.content,
    body: comment.content, // Alias
    visibility,
    isPublic: comment.isPublic,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    user: comment.user ? {
      id: comment.user.id,
      firstName: comment.user.firstName,
      lastName: comment.user.lastName,
      email: comment.user.email,
    } : undefined,
  }
}

/**
 * Create a new comment
 */
export async function create(
  ticketId: string,
  authorId: string,
  body: string,
  visibility: CommentVisibility = 'public'
): Promise<CommentDTO> {
  const isPublic = visibility === 'public'

  const comment = await prisma.ticketComment.create({
    data: {
      ticketId,
      userId: authorId,
      content: body,
      isPublic,
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  })

  return mapPrismaCommentToDTO(comment)
}

/**
 * List comments for a ticket
 */
export async function listByTicket(
  ticketId: string,
  opts?: ListCommentsOptions
): Promise<CommentDTO[]> {
  const includeInternal = opts?.includeInternal ?? false

  const comments = await prisma.ticketComment.findMany({
    where: {
      ticketId,
      ...(includeInternal ? {} : { isPublic: true }),
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  })

  return comments.map(mapPrismaCommentToDTO)
}

// Legacy interface for backward compatibility
export interface CommentRepository {
  create(data: CreateCommentDTO): Promise<CommentDTO>
  findById(id: string): Promise<CommentDTO | null>
  listByTicketId(ticketId: string): Promise<CommentDTO[]>
  update(id: string, data: UpdateCommentDTO): Promise<CommentDTO>
  delete(id: string): Promise<void>
}
