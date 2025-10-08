/**
 * Tickets Module - Public API
 * Phase 2 Scaffold
 */

export * from './domain'
export * as service from './service'
export * as policy from './policy'
export * as workflows from './workflows'
// repo exports interface only
export type { TicketRepository } from './repo'
