/**
 * Comments Module - Public API
 * Phase 7: Service/Policy/Repo implementation
 */

export * from './domain'
export * as service from './service'
export * as policy from './policy'
export * as repo from './repo'

// Legacy exports
export type { CommentRepository } from './repo'
export { CommentVisibilityEnum as CommentVisibility } from './domain'
