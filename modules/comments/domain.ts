/**
 * Comments Domain Types and DTOs
 * Phase 2 Scaffold
 */

export enum CommentVisibility {
  PUBLIC = 'PUBLIC',
  INTERNAL = 'INTERNAL',
}

export interface CommentDTO {
  id: string
  ticketId: string
  userId: string
  content: string
  visibility: CommentVisibility
  createdAt: Date
  updatedAt: Date
}

export interface CreateCommentDTO {
  ticketId: string
  userId: string
  content: string
  visibility?: CommentVisibility
}

export interface UpdateCommentDTO {
  content?: string
  visibility?: CommentVisibility
}
