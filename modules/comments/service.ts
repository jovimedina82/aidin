/**
 * Comments Service
 * Phase 2 Scaffold - Phase 3 Implementation
 */

import { CommentDTO, CreateCommentDTO, UpdateCommentDTO } from './domain'

export async function addComment(data: CreateCommentDTO): Promise<CommentDTO> {
  throw new Error('NotImplemented: addComment() - Phase 3')
}

export async function listComments(ticketId: string): Promise<CommentDTO[]> {
  throw new Error('NotImplemented: listComments() - Phase 3')
}

export async function updateComment(id: string, data: UpdateCommentDTO): Promise<CommentDTO> {
  throw new Error('NotImplemented: updateComment() - Phase 3')
}

export async function deleteComment(id: string): Promise<void> {
  throw new Error('NotImplemented: deleteComment() - Phase 3')
}
