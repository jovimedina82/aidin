/**
 * Comments Domain Types and DTOs
 * Phase 7: Comments service/policy/repo
 */

export type CommentVisibility = 'public' | 'internal'

export interface CommentDTO {
  id: string
  ticketId: string
  userId: string
  authorId: string // Alias for userId for clarity
  content: string
  body: string // Alias for content for clarity
  visibility: CommentVisibility
  isPublic: boolean // For Prisma compatibility
  createdAt: Date
  updatedAt: Date
  user?: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
}

export interface CreateCommentInput {
  content: string
  body?: string // Alias
  visibility?: CommentVisibility
  isInternal?: boolean // For backwards compatibility
}

export interface ListCommentsOptions {
  includeInternal?: boolean
}

// Legacy exports for backward compatibility
export enum CommentVisibilityEnum {
  PUBLIC = 'PUBLIC',
  INTERNAL = 'INTERNAL',
}

export interface CreateCommentDTO {
  ticketId: string
  userId: string
  content: string
  visibility?: CommentVisibilityEnum
}

export interface UpdateCommentDTO {
  content?: string
  visibility?: CommentVisibilityEnum
}
